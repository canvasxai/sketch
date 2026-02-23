import { serve } from "@hono/node-server";
import { runAgent } from "./agent/runner";
import { ensureChannelWorkspace, ensureWorkspace } from "./agent/workspace";
import { loadConfig, validateConfig } from "./config";
import { createDatabase } from "./db/index";
import { runMigrations } from "./db/migrate";
import { createChannelRepository } from "./db/repositories/channels";
import { createUserRepository } from "./db/repositories/users";
import { createApp } from "./http";
import { createLogger } from "./logger";
import { QueueManager } from "./queue";
import { SlackBot, resolveHistoryParams } from "./slack/bot";

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

// 7. Slack bot
const slack = new SlackBot({
	appToken: config.SLACK_APP_TOKEN as string,
	botToken: config.SLACK_BOT_TOKEN as string,
	logger,
});

// 8. Message handler
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

		// Post thinking indicator
		const thinkingTs = await slack.postMessage(message.channelId, "_Thinking..._");

		try {
			const result = await runAgent({
				userMessage: message.text,
				workspaceDir,
				userName: user.name,
				logger,
			});

			await slack.updateMessage(message.channelId, thinkingTs, result.text ?? "_No response_");
		} catch (err) {
			logger.error({ err, userId: user.id }, "Agent run failed");
			await slack.updateMessage(message.channelId, thinkingTs, "_Something went wrong, try again_");
		}
	});
});

// 9. Channel mention handler
slack.onChannelMention(async (message) => {
	const queue = queueManager.getQueue(message.channelId);

	queue.enqueue(async () => {
		logger.info(
			{ slackUserId: message.userId, channelId: message.channelId },
			"Processing channel mention",
		);

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

		// Fetch context: thread replies if in a thread, otherwise top-level channel messages
		const historyParams = resolveHistoryParams(message, config.SLACK_CHANNEL_HISTORY_LIMIT, config.SLACK_THREAD_HISTORY_LIMIT);
		logger.debug(
			{ source: historyParams.source, limit: historyParams.limit, threadTs: message.threadTs },
			"Fetching context history",
		);
		const history = historyParams.source === "thread"
			? await slack.getThreadReplies(historyParams.channelId, historyParams.threadTs, historyParams.limit)
			: await slack.getChannelHistory(historyParams.channelId, historyParams.limit);
		logger.debug({ messageCount: history.length }, "Raw history fetched");
		const recentMessages: Array<{ userName: string; text: string }> = [];
		for (const msg of history.reverse()) {
			try {
				const info = await slack.getUserInfo(msg.userId);
				recentMessages.push({ userName: info.realName, text: msg.text });
			} catch {
				recentMessages.push({ userName: "Unknown", text: msg.text });
			}
		}
		logger.debug(
			{ messageCount: recentMessages.length, messages: recentMessages.map((m) => `[${m.userName}]: ${m.text.slice(0, 80)}`) },
			"Context messages resolved",
		);

		// Post thinking indicator in thread (use existing thread or start new one)
		const threadTs = message.threadTs ?? message.ts;
		const thinkingTs = await slack.postThreadReply(message.channelId, threadTs, "_Thinking..._");

		try {
			const result = await runAgent({
				userMessage: message.text,
				workspaceDir,
				userName: user.name,
				logger,
				channelContext: {
					channelName: channel.name,
					recentMessages,
				},
			});

			await slack.updateMessage(message.channelId, thinkingTs, result.text ?? "_No response_");
		} catch (err) {
			logger.error({ err, userId: user.id, channelId: message.channelId }, "Agent run failed");
			await slack.updateMessage(message.channelId, thinkingTs, "_Something went wrong, try again_");
		}
	});
});

// 10. Start Slack bot
await slack.start();
logger.info("Sketch is running");

// 10. Graceful shutdown
async function shutdown() {
	logger.info("Shutting down...");
	await slack.stop();
	server.close();
	await db.destroy();
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
