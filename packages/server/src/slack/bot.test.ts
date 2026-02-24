import { describe, expect, it } from "vitest";
import { SlackBot } from "./bot";

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
