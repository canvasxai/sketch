import type { proto } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";
import { extractText, hasMediaContent, jidToPhoneNumber } from "./bot";

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
});
