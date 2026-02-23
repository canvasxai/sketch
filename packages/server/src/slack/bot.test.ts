import { describe, expect, it } from "vitest";
import { SlackBot, resolveHistoryParams } from "./bot";
import type { SlackMessage } from "./bot";

describe("SlackBot.stripBotMention", () => {
	const botId = "U123BOT";

	it("strips mention at start of message", () => {
		expect(SlackBot.stripBotMention("<@U123BOT> hello", botId)).toBe("hello");
	});

	it("strips mention in middle of message", () => {
		expect(SlackBot.stripBotMention("hey <@U123BOT> hello", botId)).toBe("hey hello");
	});

	it("returns original text when no mention present", () => {
		expect(SlackBot.stripBotMention("hello", botId)).toBe("hello");
	});

	it("returns empty string when message is only a mention", () => {
		expect(SlackBot.stripBotMention("<@U123BOT>", botId)).toBe("");
	});

	it("strips multiple mentions", () => {
		expect(SlackBot.stripBotMention("<@U123BOT> do <@U123BOT> this", botId)).toBe("do this");
	});

	it("does not strip mentions of other users", () => {
		expect(SlackBot.stripBotMention("<@U999OTHER> hello", botId)).toBe("<@U999OTHER> hello");
	});
});

describe("resolveHistoryParams", () => {
	const baseMessage: SlackMessage = {
		text: "hello",
		userId: "U001",
		channelId: "C001",
		ts: "1234.5678",
		type: "channel_mention",
	};

	it("returns channel source when no threadTs", () => {
		const result = resolveHistoryParams(baseMessage, 5, 50);
		expect(result.source).toBe("channel");
		expect(result.channelId).toBe("C001");
		expect(result.limit).toBe(5);
		expect("threadTs" in result).toBe(false);
	});

	it("returns thread source when threadTs is present", () => {
		const result = resolveHistoryParams({ ...baseMessage, threadTs: "1111.2222" }, 5, 50);
		expect(result.source).toBe("thread");
		expect(result.channelId).toBe("C001");
		expect(result.limit).toBe(50);
		if (result.source === "thread") {
			expect(result.threadTs).toBe("1111.2222");
		}
	});

	it("uses provided channel limit for channel source", () => {
		const result = resolveHistoryParams(baseMessage, 10, 100);
		expect(result.limit).toBe(10);
	});

	it("uses provided thread limit for thread source", () => {
		const result = resolveHistoryParams({ ...baseMessage, threadTs: "1111.2222" }, 10, 100);
		expect(result.limit).toBe(100);
	});
});
