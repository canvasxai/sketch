import type { proto } from "@whiskeysockets/baileys";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "../db/schema";
import { createTestDb, createTestLogger } from "../test-utils";
import { WhatsAppBot, extractText, hasMediaContent, jidToPhoneNumber } from "./bot";

describe("extractText", () => {
	it("returns text from conversation field", () => {
		const msg = { message: { conversation: "hello" } } as proto.IWebMessageInfo;
		expect(extractText(msg)).toBe("hello");
	});

	it("returns text from extendedTextMessage", () => {
		const msg = {
			message: { extendedTextMessage: { text: "quoted reply" } },
		} as proto.IWebMessageInfo;
		expect(extractText(msg)).toBe("quoted reply");
	});

	it("returns caption from imageMessage", () => {
		const msg = {
			message: { imageMessage: { caption: "photo caption" } },
		} as proto.IWebMessageInfo;
		expect(extractText(msg)).toBe("photo caption");
	});

	it("returns caption from videoMessage", () => {
		const msg = {
			message: { videoMessage: { caption: "video caption" } },
		} as proto.IWebMessageInfo;
		expect(extractText(msg)).toBe("video caption");
	});

	it("returns caption from documentMessage", () => {
		const msg = {
			message: { documentMessage: { caption: "doc caption" } },
		} as proto.IWebMessageInfo;
		expect(extractText(msg)).toBe("doc caption");
	});

	it("returns null for media-only messages without caption", () => {
		const msg = {
			message: { imageMessage: { url: "https://example.com/img.jpg" } },
		} as proto.IWebMessageInfo;
		expect(extractText(msg)).toBeNull();
	});

	it("returns null when message is undefined", () => {
		const msg = {} as proto.IWebMessageInfo;
		expect(extractText(msg)).toBeNull();
	});
});

describe("hasMediaContent", () => {
	it("returns true for imageMessage", () => {
		expect(hasMediaContent("imageMessage")).toBe(true);
	});

	it("returns true for videoMessage", () => {
		expect(hasMediaContent("videoMessage")).toBe(true);
	});

	it("returns true for audioMessage", () => {
		expect(hasMediaContent("audioMessage")).toBe(true);
	});

	it("returns true for documentMessage", () => {
		expect(hasMediaContent("documentMessage")).toBe(true);
	});

	it("returns true for stickerMessage", () => {
		expect(hasMediaContent("stickerMessage")).toBe(true);
	});

	it("returns false for conversation", () => {
		expect(hasMediaContent("conversation")).toBe(false);
	});

	it("returns false for extendedTextMessage", () => {
		expect(hasMediaContent("extendedTextMessage")).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(hasMediaContent(undefined)).toBe(false);
	});
});

describe("jidToPhoneNumber", () => {
	it("strips @s.whatsapp.net and prepends +", () => {
		expect(jidToPhoneNumber("14155238886@s.whatsapp.net")).toBe("+14155238886");
	});

	it("handles LID format (number:device@s.whatsapp.net)", () => {
		expect(jidToPhoneNumber("919876543210:0@s.whatsapp.net")).toBe("+919876543210");
	});

	it("handles number with device suffix > 0", () => {
		expect(jidToPhoneNumber("14155238886:2@s.whatsapp.net")).toBe("+14155238886");
	});

	it("handles @lid JID format", () => {
		expect(jidToPhoneNumber("86702773280883@lid")).toBe("+86702773280883");
	});

	it("handles @lid JID with device suffix", () => {
		expect(jidToPhoneNumber("86702773280883:0@lid")).toBe("+86702773280883");
	});
});

describe("WhatsAppBot.phoneNumber", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("returns null when not connected (no socket)", () => {
		const bot = new WhatsAppBot({ db, logger: createTestLogger() });
		expect(bot.phoneNumber).toBeNull();
	});

	it("returns null when socket has no user", () => {
		const bot = new WhatsAppBot({ db, logger: createTestLogger() });
		// Access private sock field via cast to set up the test scenario
		(bot as unknown as { sock: { user: undefined } }).sock = { user: undefined };
		expect(bot.phoneNumber).toBeNull();
	});

	it("extracts phone number from sock.user.id (simple format)", () => {
		const bot = new WhatsAppBot({ db, logger: createTestLogger() });
		(bot as unknown as { sock: { user: { id: string } } }).sock = {
			user: { id: "919876543210@s.whatsapp.net" },
		};
		expect(bot.phoneNumber).toBe("+919876543210");
	});

	it("extracts phone number from sock.user.id (LID format with device)", () => {
		const bot = new WhatsAppBot({ db, logger: createTestLogger() });
		(bot as unknown as { sock: { user: { id: string } } }).sock = {
			user: { id: "14155238886:0@s.whatsapp.net" },
		};
		expect(bot.phoneNumber).toBe("+14155238886");
	});
});

describe("WhatsAppBot.disconnect", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("clears credentials from DB", async () => {
		const bot = new WhatsAppBot({ db, logger: createTestLogger() });

		// Seed some creds so there's something to clear
		await db.insertInto("whatsapp_creds").values({ id: "default", creds: "{}" }).execute();
		await db.insertInto("whatsapp_keys").values({ type: "pre-key", key_id: "1", value: "{}" }).execute();

		// Verify creds exist before disconnect
		const before = await db.selectFrom("whatsapp_creds").selectAll().execute();
		expect(before).toHaveLength(1);

		await bot.disconnect();

		// Verify creds and keys are cleared
		const credsAfter = await db.selectFrom("whatsapp_creds").selectAll().execute();
		const keysAfter = await db.selectFrom("whatsapp_keys").selectAll().execute();
		expect(credsAfter).toHaveLength(0);
		expect(keysAfter).toHaveLength(0);
	});

	it("is safe to call when not connected", async () => {
		const bot = new WhatsAppBot({ db, logger: createTestLogger() });
		// Should not throw
		await bot.disconnect();
		expect(bot.isConnected).toBe(false);
	});
});
