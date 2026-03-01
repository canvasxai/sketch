import { describe, expect, it, vi } from "vitest";
import { createWhatsAppMessageHandler } from "./message-handler";

function createMockWhatsApp(connected = true) {
	return {
		isConnected: connected,
		sendText: vi.fn().mockResolvedValue(undefined),
	};
}

describe("createWhatsAppMessageHandler", () => {
	it("sends text when connected", async () => {
		const bot = createMockWhatsApp();
		const onMessage = createWhatsAppMessageHandler(bot as never, "jid");

		await onMessage("Hello!");

		expect(bot.sendText).toHaveBeenCalledWith("jid", "Hello!");
	});

	it("sends multiple messages", async () => {
		const bot = createMockWhatsApp();
		const onMessage = createWhatsAppMessageHandler(bot as never, "jid");

		await onMessage("First");
		await onMessage("Second");

		expect(bot.sendText).toHaveBeenCalledTimes(2);
		expect(bot.sendText).toHaveBeenCalledWith("jid", "Second");
	});

	it("skips sendText when disconnected", async () => {
		const bot = createMockWhatsApp(false);
		const onMessage = createWhatsAppMessageHandler(bot as never, "jid");

		await onMessage("Hello!");

		expect(bot.sendText).not.toHaveBeenCalled();
	});
});
