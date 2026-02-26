import { describe, expect, it, vi } from "vitest";
import { createWhatsAppMessageHandler } from "./message-handler";

function createMockWhatsApp(connected = true) {
	return {
		isConnected: connected,
		sendText: vi.fn().mockResolvedValue(undefined),
		removeReaction: vi.fn().mockResolvedValue(undefined),
	};
}

const mockMsgKey = { remoteJid: "123@s.whatsapp.net", id: "msg-1" };

describe("createWhatsAppMessageHandler", () => {
	it("first call removes thinking reaction and sends text", async () => {
		const bot = createMockWhatsApp();
		const { onMessage } = createWhatsAppMessageHandler(bot as never, "jid", mockMsgKey);

		await onMessage("Hello!");

		expect(bot.removeReaction).toHaveBeenCalledWith("jid", mockMsgKey);
		expect(bot.sendText).toHaveBeenCalledWith("jid", "Hello!");
	});

	it("second call only sends text (reaction already removed)", async () => {
		const bot = createMockWhatsApp();
		const { onMessage } = createWhatsAppMessageHandler(bot as never, "jid", mockMsgKey);

		await onMessage("First");
		await onMessage("Second");

		expect(bot.removeReaction).toHaveBeenCalledTimes(1);
		expect(bot.sendText).toHaveBeenCalledTimes(2);
		expect(bot.sendText).toHaveBeenCalledWith("jid", "Second");
	});

	it("isReactionRemoved returns false before any calls", () => {
		const bot = createMockWhatsApp();
		const { isReactionRemoved } = createWhatsAppMessageHandler(bot as never, "jid", mockMsgKey);

		expect(isReactionRemoved()).toBe(false);
	});

	it("isReactionRemoved returns true after first call", async () => {
		const bot = createMockWhatsApp();
		const { onMessage, isReactionRemoved } = createWhatsAppMessageHandler(bot as never, "jid", mockMsgKey);

		await onMessage("Hello!");

		expect(isReactionRemoved()).toBe(true);
	});

	it("skips removeReaction and sendText when disconnected", async () => {
		const bot = createMockWhatsApp(false);
		const { onMessage, isReactionRemoved } = createWhatsAppMessageHandler(bot as never, "jid", mockMsgKey);

		await onMessage("Hello!");

		expect(bot.removeReaction).not.toHaveBeenCalled();
		expect(bot.sendText).not.toHaveBeenCalled();
		expect(isReactionRemoved()).toBe(false);
	});
});
