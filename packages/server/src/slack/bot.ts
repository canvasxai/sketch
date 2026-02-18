/**
 * Slack adapter wrapping @slack/bolt in Socket Mode.
 * Listens for DMs, filters bot messages, exposes send/update methods.
 * Bot message filtering uses bot_id check instead of ignoreSelf (bolt-js#580).
 */
import { App } from "@slack/bolt";
import type { Logger } from "../logger.js";

export interface SlackMessage {
	text: string;
	userId: string;
	channelId: string;
	ts: string;
}

export type SlackMessageHandler = (message: SlackMessage) => Promise<void>;

export interface SlackBotConfig {
	appToken: string;
	botToken: string;
	logger: Logger;
}

export class SlackBot {
	private app: App;
	private logger: Logger;
	private handler: SlackMessageHandler | null = null;

	constructor(config: SlackBotConfig) {
		this.logger = config.logger;
		this.app = new App({
			token: config.botToken,
			appToken: config.appToken,
			socketMode: true,
		});
	}

	onMessage(handler: SlackMessageHandler): void {
		this.handler = handler;
	}

	async start(): Promise<void> {
		this.app.message(async ({ message }) => {
			if ("bot_id" in message && message.bot_id) return;
			if (!("channel_type" in message) || message.channel_type !== "im") return;
			if (!("text" in message) || !message.text) return;
			if (!("user" in message) || !message.user) return;

			if (this.handler) {
				await this.handler({
					text: message.text,
					userId: message.user,
					channelId: message.channel,
					ts: message.ts,
				});
			}
		});

		await this.app.start();
		this.logger.info("Slack bot connected (Socket Mode)");
	}

	async postMessage(channelId: string, text: string): Promise<string> {
		const result = await this.app.client.chat.postMessage({
			channel: channelId,
			text,
		});
		return result.ts ?? "";
	}

	async updateMessage(channelId: string, ts: string, text: string): Promise<void> {
		await this.app.client.chat.update({
			channel: channelId,
			ts,
			text,
		});
	}

	async getUserInfo(userId: string): Promise<{ name: string; realName: string }> {
		const result = await this.app.client.users.info({ user: userId });
		return {
			name: result.user?.name ?? "unknown",
			realName: result.user?.real_name ?? result.user?.name ?? "unknown",
		};
	}

	async stop(): Promise<void> {
		await this.app.stop();
	}
}
