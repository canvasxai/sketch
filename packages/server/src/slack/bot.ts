/**
 * Slack adapter wrapping @slack/bolt in Socket Mode.
 * Handles DMs via message event and channel @mentions via app_mention event.
 * Bot self-ID resolved at startup via auth.test for mention stripping.
 */
import { App } from "@slack/bolt";
import type { Logger } from "../logger.js";

export interface SlackMessage {
	text: string;
	userId: string;
	channelId: string;
	ts: string;
	type: "dm" | "channel_mention";
	threadTs?: string;
}

export type SlackMessageHandler = (message: SlackMessage) => Promise<void>;

/**
 * Determines whether to fetch thread replies or channel history based on
 * whether the mention is inside a thread.
 */
export function resolveHistoryParams(
	message: SlackMessage,
	channelLimit: number,
	threadLimit: number,
): { source: "thread"; channelId: string; threadTs: string; limit: number } | { source: "channel"; channelId: string; limit: number } {
	if (message.threadTs) {
		return { source: "thread", channelId: message.channelId, threadTs: message.threadTs, limit: threadLimit };
	}
	return { source: "channel", channelId: message.channelId, limit: channelLimit };
}

export interface SlackBotConfig {
	appToken: string;
	botToken: string;
	logger: Logger;
}

export class SlackBot {
	private app: App;
	private logger: Logger;
	private handler: SlackMessageHandler | null = null;
	private mentionHandler: SlackMessageHandler | null = null;
	private botUserId: string | null = null;

	constructor(config: SlackBotConfig) {
		this.logger = config.logger;
		this.app = new App({
			token: config.botToken,
			appToken: config.appToken,
			socketMode: true,
		});
	}

	static stripBotMention(text: string, botUserId: string): string {
		return text.replace(new RegExp(`<@${botUserId}>`, "g"), "").replace(/\s+/g, " ").trim();
	}

	onMessage(handler: SlackMessageHandler): void {
		this.handler = handler;
	}

	onChannelMention(handler: SlackMessageHandler): void {
		this.mentionHandler = handler;
	}

	async start(): Promise<void> {
		const auth = await this.app.client.auth.test();
		this.botUserId = auth.user_id ?? null;
		this.logger.info({ botUserId: this.botUserId }, "Resolved bot user ID");

		this.app.message(async ({ message }) => {
			if ("bot_id" in message && message.bot_id) return;
			if (!("channel_type" in message) || message.channel_type !== "im") return;
			if (!("text" in message) || !message.text) return;
			if (!("user" in message) || !message.user) return;

			if (this.handler) {
				await this.handler({
					type: "dm",
					text: message.text,
					userId: message.user,
					channelId: message.channel,
					ts: message.ts,
				});
			}
		});

		this.app.event("app_mention", async ({ event }) => {
			if (!this.mentionHandler) return;
			if (!event.text || !event.user) return;

			const cleanText = SlackBot.stripBotMention(event.text, this.botUserId!);
			if (!cleanText) return;

			await this.mentionHandler({
				type: "channel_mention",
				text: cleanText,
				userId: event.user,
				channelId: event.channel,
				ts: event.ts,
				threadTs: event.thread_ts,
			});
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

	async postThreadReply(channelId: string, threadTs: string, text: string): Promise<string> {
		const result = await this.app.client.chat.postMessage({
			channel: channelId,
			thread_ts: threadTs,
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

	async getChannelInfo(channelId: string): Promise<{ name: string; type: string }> {
		const result = await this.app.client.conversations.info({ channel: channelId });
		const channel = result.channel;
		let type = "public_channel";
		if (channel?.is_group) type = "group";
		else if (channel?.is_private) type = "private_channel";
		return {
			name: channel?.name ?? "unknown",
			type,
		};
	}

	async getChannelHistory(channelId: string, limit = 5): Promise<Array<{ userId: string; text: string; ts: string }>> {
		const result = await this.app.client.conversations.history({ channel: channelId, limit });
		return (result.messages ?? [])
			.filter((m) => m.text && m.user && !m.bot_id)
			.map((m) => ({
				userId: m.user!,
				text: m.text!,
				ts: m.ts!,
			}));
	}

	async getThreadReplies(channelId: string, threadTs: string, limit = 50): Promise<Array<{ userId: string; text: string; ts: string }>> {
		const result = await this.app.client.conversations.replies({ channel: channelId, ts: threadTs, limit });
		return (result.messages ?? [])
			.filter((m) => m.text && m.user && !m.bot_id)
			.map((m) => ({
				userId: m.user!,
				text: m.text!,
				ts: m.ts!,
			}));
	}

	async stop(): Promise<void> {
		await this.app.stop();
	}
}
