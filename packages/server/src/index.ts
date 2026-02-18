import { serve } from "@hono/node-server";
import { runAgent } from "./agent/runner";
import { ensureWorkspace } from "./agent/workspace";
import { loadConfig, validateConfig } from "./config";
import { createDatabase } from "./db/index";
import { runMigrations } from "./db/migrate";
import { createUserRepository } from "./db/repositories/users";
import { createApp } from "./http";
import { createLogger } from "./logger";
import { QueueManager } from "./queue";
import { SlackBot } from "./slack/bot";

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

// 9. Start Slack bot
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
