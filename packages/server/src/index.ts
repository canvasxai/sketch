import { basename, join } from "node:path";
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
import { type Attachment, downloadSlackFile, downloadWhatsAppMedia, extensionToMime } from "./files";
import { createApp } from "./http";
import { createLogger } from "./logger";
import { QueueManager } from "./queue";
import { SlackBot } from "./slack/bot";
import type { BufferedMessage } from "./slack/thread-buffer";
import { ThreadBuffer } from "./slack/thread-buffer";
import { UserCache } from "./slack/user-cache";
import { WhatsAppBot } from "./whatsapp/bot";

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

// 5. Queue manager
const queueManager = new QueueManager();

// 6. Thread buffer + user cache (Slack)
const threadBuffer = new ThreadBuffer();
const userCache = new UserCache();

// 7. Slack bot — start only if tokens configured
let slack: SlackBot | null = null;
const hasSlack = config.SLACK_APP_TOKEN && config.SLACK_BOT_TOKEN;

if (hasSlack) {
	slack = new SlackBot({
		appToken: config.SLACK_APP_TOKEN as string,
		botToken: config.SLACK_BOT_TOKEN as string,
		logger,
	});

	// DM handler
	slack.onMessage(async (message) => {
		// Resolve or create user first — needed for queue key
		let user = await users.findBySlackId(message.userId);
		if (!user) {
			const userInfo = await slack!.getUserInfo(message.userId);
			user = await users.create({
				name: userInfo.realName,
				slackUserId: message.userId,
			});
			logger.info({ userId: user.id, name: user.name }, "New user created");
		}

		const queue = queueManager.getQueue(user.id);

		queue.enqueue(async () => {
			logger.info({ slackUserId: message.userId, channelId: message.channelId }, "Processing message");

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
			const thinkingTs = await slack!.postMessage(message.channelId, "_Thinking..._");

			try {
				const result = await runAgent({
					userMessage: message.text || "See attached files.",
					workspaceDir,
					userName: user.name,
					logger,
					platform: "slack",
					attachments: attachments.length > 0 ? attachments : undefined,
				});

				for (const filePath of result.pendingUploads) {
					try {
						await slack!.uploadFile(message.channelId, filePath);
					} catch (err) {
						logger.warn({ err, filePath }, "Failed to upload file to Slack");
					}
				}

				await slack!.updateMessage(message.channelId, thinkingTs, result.text ?? "_No response_");
			} catch (err) {
				logger.error({ err, userId: user.id }, "Agent run failed");
				await slack!.updateMessage(message.channelId, thinkingTs, "_Something went wrong, try again_");
			}
		});
	});

	// Passive thread message handler
	slack.onThreadMessage(async (message) => {
		if (!message.threadTs) return;
		if (!threadBuffer.hasThread(message.channelId, message.threadTs)) return;

		const userInfo = await userCache.resolve(message.userId, (id) => slack!.getUserInfo(id));

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

	// Channel mention handler
	slack.onChannelMention(async (message) => {
		const threadTs = message.threadTs ?? message.ts;
		const queue = queueManager.getQueue(`${message.channelId}:${threadTs}`);

		queue.enqueue(async () => {
			logger.info({ slackUserId: message.userId, channelId: message.channelId }, "Processing channel mention");

			let user = await users.findBySlackId(message.userId);
			if (!user) {
				const userInfo = await slack!.getUserInfo(message.userId);
				user = await users.create({
					name: userInfo.realName,
					slackUserId: message.userId,
				});
				logger.info({ userId: user.id, name: user.name }, "New user created");
			}

			let channel = await channels.findBySlackChannelId(message.channelId);
			if (!channel) {
				const channelInfo = await slack!.getChannelInfo(message.channelId);
				channel = await channels.create({
					slackChannelId: message.channelId,
					name: channelInfo.name,
					type: channelInfo.type,
				});
				logger.info({ channelId: channel.id, name: channel.name }, "New channel created");
			}

			const workspaceDir = await ensureChannelWorkspace(config, message.channelId);

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

			const existingSession = await getSessionId(workspaceDir, threadTs);
			let userMessage = message.text || "See attached files.";

			if (existingSession) {
				const buffered = threadBuffer.drain(message.channelId, threadTs);
				logger.debug({ threadTs, bufferedCount: buffered.length }, "Draining thread buffer for subsequent mention");
				if (buffered.length > 0) {
					userMessage = formatBufferedContext(buffered, user.name, userMessage);
				}
			} else {
				const history = message.threadTs
					? await slack!.getThreadReplies(message.channelId, message.threadTs, config.SLACK_THREAD_HISTORY_LIMIT)
					: await slack!.getChannelHistory(message.channelId, config.SLACK_CHANNEL_HISTORY_LIMIT);

				const filtered = history.filter((m) => m.ts !== message.ts);

				logger.debug(
					{ source: message.threadTs ? "thread" : "channel", messageCount: filtered.length },
					"Bootstrap history fetched",
				);

				const bootstrapMessages: BufferedMessage[] = [];
				for (const msg of filtered.reverse()) {
					const info = await userCache.resolve(msg.userId, (id) => slack!.getUserInfo(id));
					bootstrapMessages.push({ userName: info.realName, text: msg.text, ts: msg.ts });
				}
				if (bootstrapMessages.length > 0) {
					const header = message.threadTs
						? "[Thread context before you joined]"
						: "[Recent channel messages for context]";
					userMessage = formatBufferedContext(bootstrapMessages, user.name, userMessage, header);
				}
			}

			const thinkingTs = await slack!.postThreadReply(message.channelId, threadTs, "_Thinking..._");

			try {
				const result = await runAgent({
					userMessage,
					workspaceDir,
					userName: user.name,
					logger,
					platform: "slack",
					threadTs,
					attachments: attachments.length > 0 ? attachments : undefined,
					channelContext: {
						channelName: channel.name,
						recentMessages: [],
					},
				});

				for (const filePath of result.pendingUploads) {
					try {
						await slack!.uploadFile(message.channelId, filePath, threadTs);
					} catch (err) {
						logger.warn({ err, filePath }, "Failed to upload file to Slack");
					}
				}

				await slack!.updateMessage(message.channelId, thinkingTs, result.text ?? "_No response_");
			} catch (err) {
				logger.error({ err, userId: user.id, channelId: message.channelId }, "Agent run failed");
				await slack!.updateMessage(message.channelId, thinkingTs, "_Something went wrong, try again_");
			}
		});
	});
}

// 8. WhatsApp bot — always instantiate, connect only if creds exist in DB
const whatsapp = new WhatsAppBot({ db, logger });

whatsapp.onMessage(async (message) => {
	// Resolve user BEFORE enqueue — needed for queue key and access control
	const user = await users.findByWhatsappNumber(message.phoneNumber);
	if (!user) {
		await whatsapp.sendText(message.jid, "Sorry, you're not authorized to use this bot. Contact your admin to get access.");
		return;
	}

	// Queue by user.id — same key as Slack DMs for cross-platform serialization
	const queue = queueManager.getQueue(user.id);

	queue.enqueue(async () => {
		const workspaceDir = await ensureWorkspace(config, user.id);

		// Thinking indicator
		await whatsapp.reactThinking(message.jid, message.rawMessage.key!);
		await whatsapp.sendComposing(message.jid);

		try {
			// Download media if present
			const attachments: Attachment[] = [];
			if (message.mediaType && whatsapp.socket) {
				const attachDir = join(workspaceDir, "attachments");
				try {
					const attachment = await downloadWhatsAppMedia(
						message.rawMessage,
						whatsapp.socket,
						attachDir,
						config.MAX_FILE_SIZE_MB * 1024 * 1024,
						logger,
					);
					attachments.push(attachment);
				} catch (err) {
					logger.warn({ err, mediaType: message.mediaType }, "Failed to download WhatsApp media");
				}
			}

			const result = await runAgent({
				userMessage: message.text || "See attached files.",
				workspaceDir,
				userName: user.name,
				logger,
				platform: "whatsapp",
				attachments: attachments.length > 0 ? attachments : undefined,
			});

			// Remove thinking reaction
			if (whatsapp.isConnected) {
				await whatsapp.removeReaction(message.jid, message.rawMessage.key!);
			}

			// Upload pending files
			for (const filePath of result.pendingUploads) {
				try {
					if (whatsapp.isConnected) {
						const ext = filePath.split(".").pop() ?? "";
						const mime = extensionToMime(ext);
						await whatsapp.sendFile(message.jid, filePath, mime, basename(filePath));
					}
				} catch (err) {
					logger.warn({ err, filePath }, "Failed to send file via WhatsApp");
				}
			}

			// Send response
			if (result.text && whatsapp.isConnected) {
				await whatsapp.sendText(message.jid, result.text);
			}
		} catch (err) {
			logger.error({ err, userId: user.id }, "Agent run failed (WhatsApp)");
			if (whatsapp.isConnected) {
				await whatsapp.removeReaction(message.jid, message.rawMessage.key!);
				await whatsapp.sendText(message.jid, "Something went wrong, try again.");
			}
		}
	});
});

// 9. HTTP server — after WhatsApp instantiation so pairing endpoint has a reference
const app = createApp(db, { whatsapp });
const server = serve({ fetch: app.fetch, port: config.PORT });
logger.info({ port: config.PORT }, "HTTP server started");

// 10. Start platforms
if (slack) {
	await slack.start();
	logger.info("Slack bot connected");
}

const whatsappConnected = await whatsapp.start();
if (whatsappConnected) {
	logger.info("WhatsApp connected");
} else {
	logger.info("WhatsApp not paired — use GET /whatsapp/pair to connect");
}

if (!hasSlack && !whatsappConnected) {
	logger.info("No channels active — pair WhatsApp via GET /whatsapp/pair or configure Slack tokens");
}

// 11. Graceful shutdown
async function shutdown() {
	logger.info("Shutting down...");
	if (slack) await slack.stop();
	await whatsapp.stop();
	server.close();
	await db.destroy();
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
