import { describe, expect, it, vi } from "vitest";
import { createSlackMessageHandler } from "./message-handler";

function createMockSlackBot() {
	return {
		updateMessage: vi.fn().mockResolvedValue(undefined),
		postMessage: vi.fn().mockResolvedValue("new-ts"),
		postThreadReply: vi.fn().mockResolvedValue("reply-ts"),
	};
}

describe("createSlackMessageHandler", () => {
	describe("DM mode (no threadTs)", () => {
		it("first call updates the thinking message", async () => {
			const bot = createMockSlackBot();
			const handler = createSlackMessageHandler(bot as never, "C123", "thinking-ts");

			await handler("Hello!");

			expect(bot.updateMessage).toHaveBeenCalledWith("C123", "thinking-ts", "Hello!");
			expect(bot.postMessage).not.toHaveBeenCalled();
		});

		it("second call posts a new DM message", async () => {
			const bot = createMockSlackBot();
			const handler = createSlackMessageHandler(bot as never, "C123", "thinking-ts");

			await handler("First");
			await handler("Second");

			expect(bot.updateMessage).toHaveBeenCalledTimes(1);
			expect(bot.postMessage).toHaveBeenCalledWith("C123", "Second");
			expect(bot.postThreadReply).not.toHaveBeenCalled();
		});

		it("third+ calls continue posting new DM messages", async () => {
			const bot = createMockSlackBot();
			const handler = createSlackMessageHandler(bot as never, "C123", "thinking-ts");

			await handler("First");
			await handler("Second");
			await handler("Third");

			expect(bot.updateMessage).toHaveBeenCalledTimes(1);
			expect(bot.postMessage).toHaveBeenCalledTimes(2);
			expect(bot.postMessage).toHaveBeenCalledWith("C123", "Second");
			expect(bot.postMessage).toHaveBeenCalledWith("C123", "Third");
		});
	});

	describe("channel mode (with threadTs)", () => {
		it("first call updates the thinking message", async () => {
			const bot = createMockSlackBot();
			const handler = createSlackMessageHandler(bot as never, "C123", "thinking-ts", "thread-ts");

			await handler("Hello!");

			expect(bot.updateMessage).toHaveBeenCalledWith("C123", "thinking-ts", "Hello!");
			expect(bot.postThreadReply).not.toHaveBeenCalled();
		});

		it("second call posts a thread reply", async () => {
			const bot = createMockSlackBot();
			const handler = createSlackMessageHandler(bot as never, "C123", "thinking-ts", "thread-ts");

			await handler("First");
			await handler("Second");

			expect(bot.updateMessage).toHaveBeenCalledTimes(1);
			expect(bot.postThreadReply).toHaveBeenCalledWith("C123", "thread-ts", "Second");
			expect(bot.postMessage).not.toHaveBeenCalled();
		});

		it("third+ calls continue posting thread replies", async () => {
			const bot = createMockSlackBot();
			const handler = createSlackMessageHandler(bot as never, "C123", "thinking-ts", "thread-ts");

			await handler("First");
			await handler("Second");
			await handler("Third");

			expect(bot.postThreadReply).toHaveBeenCalledTimes(2);
			expect(bot.postThreadReply).toHaveBeenCalledWith("C123", "thread-ts", "Second");
			expect(bot.postThreadReply).toHaveBeenCalledWith("C123", "thread-ts", "Third");
		});
	});
});
