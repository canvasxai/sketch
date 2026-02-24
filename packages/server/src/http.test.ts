import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "./db/schema";
import { createApp } from "./http";
import { createTestDb } from "./test-utils";
import type { WhatsAppBot } from "./whatsapp/bot";

describe("HTTP health endpoint", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {
			// Already destroyed in some tests
		}
	});

	describe("GET /health", () => {
		it("returns 200 with ok status when DB is working", async () => {
			const app = createApp(db);
			const res = await app.request("/health");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("ok");
			expect(body.db).toBe("ok");
			expect(typeof body.uptime).toBe("number");
		});

		it("returns 500 with error status when DB is destroyed", async () => {
			const app = createApp(db);
			await db.destroy();

			const res = await app.request("/health");
			expect(res.status).toBe(500);

			const body = await res.json();
			expect(body.status).toBe("error");
			expect(body.db).toBe("error");
		});
	});

	describe("GET /nonexistent", () => {
		it("returns 404", async () => {
			const app = createApp(db);
			const res = await app.request("/nonexistent");
			expect(res.status).toBe(404);
		});
	});
});

describe("WhatsApp endpoints", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	function makeMockWhatsApp(overrides: Partial<WhatsAppBot> = {}): WhatsAppBot {
		return {
			isConnected: false,
			startPairing: async () => {},
			...overrides,
		} as WhatsAppBot;
	}

	describe("GET /whatsapp/pair", () => {
		it("returns already_connected when bot is connected", async () => {
			const whatsapp = makeMockWhatsApp({ isConnected: true } as any);
			const app = createApp(db, { whatsapp });

			const res = await app.request("/whatsapp/pair");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("already_connected");
		});

		it("returns QR string on successful pairing start", async () => {
			const whatsapp = makeMockWhatsApp({
				startPairing: async (onQr: (qr: string) => void) => {
					onQr("test-qr-string-data");
				},
			} as any);
			const app = createApp(db, { whatsapp });

			const res = await app.request("/whatsapp/pair");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("pairing");
			expect(body.qr).toBe("test-qr-string-data");
		});
	});

	describe("GET /whatsapp/status", () => {
		it("returns connected false when bot is disconnected", async () => {
			const whatsapp = makeMockWhatsApp({ isConnected: false } as any);
			const app = createApp(db, { whatsapp });

			const res = await app.request("/whatsapp/status");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(false);
		});

		it("returns connected true when bot is connected", async () => {
			const whatsapp = makeMockWhatsApp({ isConnected: true } as any);
			const app = createApp(db, { whatsapp });

			const res = await app.request("/whatsapp/status");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(true);
		});
	});

	describe("endpoints absent without WhatsApp bot", () => {
		it("returns 404 for /whatsapp/pair when no bot provided", async () => {
			const app = createApp(db);
			const res = await app.request("/whatsapp/pair");
			expect(res.status).toBe(404);
		});

		it("returns 404 for /whatsapp/status when no bot provided", async () => {
			const app = createApp(db);
			const res = await app.request("/whatsapp/status");
			expect(res.status).toBe(404);
		});
	});
});
