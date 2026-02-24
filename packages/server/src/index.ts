import { join } from "node:path";
import { serve } from "@hono/node-server";
import { formatBufferedContext } from "./agent/prompt";
import { runAgent } from "./agent/runner";
import { getSessionId } from "./agent/sessions";
import { ensureChannelWorkspace, ensureWorkspace } from "./agent/workspace";
import { loadConfig, validateConfig } from "./config";
import { createDatabase } from "./db/index";
import { runMigrations } from "./db/migrate";
import { createChannelRepository } from "./db/repositories/channels";
import { createUserRepository } from "./db/repositories/users";
import { type Attachment, downloadSlackFile } from "./files";
import { createApp } from "./http";
import { createLogger } from "./logger";
import { QueueManager } from "./queue";
import { SlackBot } from "./slack/bot";
import type { BufferedMessage } from "./slack/thread-buffer";
import { ThreadBuffer } from "./slack/thread-buffer";
import { UserCache } from "./slack/user-cache";

// 1. Config
const config = loadConfig();
validateConfig(config);

// 2. Logger
const logger = createLogger(config);

// 3. Database
const db = createDatabase(config);
await runMigrations(db);
logger.info("Database ready");

// 4. Repositories
const users = createUserRepository(db);
const channels = createChannelRepository(db);

// 5. HTTP server
const app = createApp(db);
const server = serve({ fetch: app.fetch, port: config.PORT });
logger.info({ port: config.PORT }, "HTTP server started");

// 6. Queue manager
const queueManager = new QueueManager();

// 7. Thread buffer + user cache
const threadBuffer = new ThreadBuffer();
const userCache = new UserCache();

// 8. Slack bot
const slack = new SlackBot({
	appToken: config.SLACK_APP_TOKEN as string,
	botToken: config.SLACK_BOT_TOKEN as string,
	logger,
});

// 9. DM handler (unchanged)
slack.onMessage(async (message) => {
	const queue = queueManager.getQueue(message.channelId);

	queue.enqueue(async () => {
		logger.info({ slackUserId: message.userId, channelId: message.channelId }, "Processing message");

		// Resolve or create user
		let user = await users.findBySlackId(message.userId);
		if (!user) {
			const userInfo = await slack.getUserInfo(message.userId);
			user = await users.create({
				name: userInfo.realName,
				slackUserId: message.userId,
			});
			logger.info({ userId: user.id, name: user.name }, "New user created");
		}

		// Ensure workspace
		const workspaceDir = await ensureWorkspace(config, user.id);

		// Download any attached files
		const attachments: Attachment[] = [];
		if (message.files?.length) {
			logger.debug(
				{
					fileCount: message.files.length,
					files: message.files.map((f) => ({
						name: f.name,
						mime: f.mimetype,
						size: f.size,
						url: f.urlPrivate?.slice(0, 80),
					})),
				},
				"Files received from Slack",
			);
			const attachDir = join(workspaceDir, "attachments");
			const maxBytes = config.MAX_FILE_SIZE_MB * 1024 * 1024;
			for (const file of message.files) {
				try {
					const downloaded = await downloadSlackFile(
						file.urlPrivate,
						config.SLACK_BOT_TOKEN as string,
						attachDir,
						maxBytes,
						logger,
					);
					attachments.push(downloaded);
				} catch (err) {
					logger.warn({ err, fileName: file.name }, "Failed to download file");
				}
			}
			logger.debug(
				{
					attachmentCount: attachments.length,
					attachments: attachments.map((a) => ({ name: a.originalName, mime: a.mimeType, size: a.sizeBytes })),
				},
				"Files downloaded",
			);
		}

		// Post thinking indicator
		const thinkingTs = await slack.postMessage(message.channelId, "_Thinking..._");

		try {
			const result = await runAgent({
				userMessage: message.text || "See attached files.",
				workspaceDir,
				userName: user.name,
				logger,
				attachments: attachments.length > 0 ? attachments : undefined,
			});

			for (const filePath of result.pendingUploads) {
				try {
					await slack.uploadFile(message.channelId, filePath);
				} catch (err) {
					logger.warn({ err, filePath }, "Failed to upload file to Slack");
				}
			}

			await slack.updateMessage(message.channelId, thinkingTs, result.text ?? "_No response_");
		} catch (err) {
			logger.error({ err, userId: user.id }, "Agent run failed");
			await slack.updateMessage(message.channelId, thinkingTs, "_Something went wrong, try again_");
		}
	});
});

// 10. Passive thread message handler — buffer messages for context, no agent run
slack.onThreadMessage(async (message) => {
	if (!message.threadTs) return;
	if (!threadBuffer.hasThread(message.channelId, message.threadTs)) return;

	const userInfo = await userCache.resolve(message.userId, (id) => slack.getUserInfo(id));

	// Download any attached files to the channel workspace so the agent can read them later
	const downloadedAttachments: Attachment[] = [];
	if (message.files?.length) {
		const workspaceDir = await ensureChannelWorkspace(config, message.channelId);
		const attachDir = join(workspaceDir, "attachments");
		const maxBytes = config.MAX_FILE_SIZE_MB * 1024 * 1024;
		for (const file of message.files) {
			try {
				const downloaded = await downloadSlackFile(
					file.urlPrivate,
					config.SLACK_BOT_TOKEN as string,
					attachDir,
					maxBytes,
					logger,
				);
				downloadedAttachments.push(downloaded);
			} catch (err) {
				logger.warn({ err, fileName: file.name }, "Failed to download passive thread file");
			}
		}
	}

	threadBuffer.append(message.channelId, message.threadTs, {
		userName: userInfo.realName,
		text: message.text,
		ts: message.ts,
		...(downloadedAttachments.length > 0 && { attachments: downloadedAttachments }),
	});

	logger.debug(
		{ channelId: message.channelId, threadTs: message.threadTs, user: userInfo.realName },
		"Buffered thread message",
	);
});

// 11. Channel mention handler — unified flow for top-level and thread mentions
slack.onChannelMention(async (message) => {
	const queue = queueManager.getQueue(message.channelId);

	queue.enqueue(async () => {
		logger.info({ slackUserId: message.userId, channelId: message.channelId }, "Processing channel mention");

		// Resolve or create user
		let user = await users.findBySlackId(message.userId);
		if (!user) {
			const userInfo = await slack.getUserInfo(message.userId);
			user = await users.create({
				name: userInfo.realName,
				slackUserId: message.userId,
			});
			logger.info({ userId: user.id, name: user.name }, "New user created");
		}

		// Resolve or create channel
		let channel = await channels.findBySlackChannelId(message.channelId);
		if (!channel) {
			const channelInfo = await slack.getChannelInfo(message.channelId);
			channel = await channels.create({
				slackChannelId: message.channelId,
				name: channelInfo.name,
				type: channelInfo.type,
			});
			logger.info({ channelId: channel.id, name: channel.name }, "New channel created");
		}

		// Ensure channel workspace
		const workspaceDir = await ensureChannelWorkspace(config, message.channelId);

		// Determine thread — top-level mentions use message.ts (bot reply creates thread there)
		const threadTs = message.threadTs ?? message.ts;

		// Register thread for passive buffering before agent run
		threadBuffer.register(message.channelId, threadTs);

		// Download any attached files
		const attachments: Attachment[] = [];
		if (message.files?.length) {
			logger.debug(
				{
					fileCount: message.files.length,
					files: message.files.map((f) => ({
						name: f.name,
						mime: f.mimetype,
						size: f.size,
						url: f.urlPrivate?.slice(0, 80),
					})),
				},
				"Files received from Slack",
			);
			const attachDir = join(workspaceDir, "attachments");
			const maxBytes = config.MAX_FILE_SIZE_MB * 1024 * 1024;
			for (const file of message.files) {
				try {
					const downloaded = await downloadSlackFile(
						file.urlPrivate,
						config.SLACK_BOT_TOKEN as string,
						attachDir,
						maxBytes,
						logger,
					);
					attachments.push(downloaded);
				} catch (err) {
					logger.warn({ err, fileName: file.name }, "Failed to download file");
				}
			}
			logger.debug(
				{
					attachmentCount: attachments.length,
					attachments: attachments.map((a) => ({ name: a.originalName, mime: a.mimeType, size: a.sizeBytes })),
				},
				"Files downloaded",
			);
		}

		// Check for existing thread session
		const existingSession = await getSessionId(workspaceDir, threadTs);

		let userMessage = message.text || "See attached files.";

		if (existingSession) {
			// Subsequent mention — drain buffer for context since last bot response
			const buffered = threadBuffer.drain(message.channelId, threadTs);
			logger.debug({ threadTs, bufferedCount: buffered.length }, "Draining thread buffer for subsequent mention");
			if (buffered.length > 0) {
				userMessage = formatBufferedContext(buffered, user.name, userMessage);
			}
		} else {
			// First mention — bootstrap with history, injected into user message so it
			// persists across SDK session resumes (system prompt content does not survive resume)
			const history = message.threadTs
				? await slack.getThreadReplies(message.channelId, message.threadTs, config.SLACK_THREAD_HISTORY_LIMIT)
				: await slack.getChannelHistory(message.channelId, config.SLACK_CHANNEL_HISTORY_LIMIT);

			const filtered = history.filter((m) => m.ts !== message.ts);

			logger.debug(
				{ source: message.threadTs ? "thread" : "channel", messageCount: filtered.length },
				"Bootstrap history fetched",
			);

			const bootstrapMessages: BufferedMessage[] = [];
			for (const msg of filtered.reverse()) {
				const info = await userCache.resolve(msg.userId, (id) => slack.getUserInfo(id));
				bootstrapMessages.push({ userName: info.realName, text: msg.text, ts: msg.ts });
			}
			if (bootstrapMessages.length > 0) {
				const header = message.threadTs
					? "[Thread context before you joined]"
					: "[Recent channel messages for context]";
				userMessage = formatBufferedContext(bootstrapMessages, user.name, userMessage, header);
			}
		}

		// Post thinking indicator in thread
		const thinkingTs = await slack.postThreadReply(message.channelId, threadTs, "_Thinking..._");

		try {
			const result = await runAgent({
				userMessage,
				workspaceDir,
				userName: user.name,
				logger,
				threadTs,
				attachments: attachments.length > 0 ? attachments : undefined,
				channelContext: {
					channelName: channel.name,
					recentMessages: [],
				},
			});

			for (const filePath of result.pendingUploads) {
				try {
					await slack.uploadFile(message.channelId, filePath, threadTs);
				} catch (err) {
					logger.warn({ err, filePath }, "Failed to upload file to Slack");
				}
			}

			await slack.updateMessage(message.channelId, thinkingTs, result.text ?? "_No response_");
		} catch (err) {
			logger.error({ err, userId: user.id, channelId: message.channelId }, "Agent run failed");
			await slack.updateMessage(message.channelId, thinkingTs, "_Something went wrong, try again_");
		}
	});
});

// 12. Start Slack bot
await slack.start();
logger.info("Sketch is running");

// 13. Graceful shutdown
async function shutdown() {
	logger.info("Shutting down...");
	await slack.stop();
	server.close();
	await db.destroy();
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
