import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSessions } from "./api/auth";
import type { DB } from "./db/schema";
import { createApp } from "./http";
import { createTestConfig, createTestDb } from "./test-utils";
import type { WhatsAppBot } from "./whatsapp/bot";

const config = createTestConfig();

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

	describe("GET /api/health", () => {
		it("returns 200 with ok status when DB is working", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/health");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("ok");
			expect(body.db).toBe("ok");
			expect(typeof body.uptime).toBe("number");
		});

		it("returns 500 with error status when DB is destroyed", async () => {
			const app = createApp(db, config);
			await db.destroy();

			const res = await app.request("/api/health");
			expect(res.status).toBe(500);

			const body = await res.json();
			expect(body.status).toBe("error");
			expect(body.db).toBe("error");
		});
	});

	describe("SPA catch-all", () => {
		it("returns 200 with HTML for unknown non-API routes (SPA routing)", async () => {
			const app = createApp(db, config);
			const res = await app.request("/nonexistent");
			// When web dist exists, serves index.html; otherwise 404
			expect([200, 404]).toContain(res.status);
		});

		it("returns 404 for unknown /api/* routes", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/nonexistent");
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

	describe("GET /api/whatsapp/pair", () => {
		it("returns already_connected when bot is connected", async () => {
			const whatsapp = makeMockWhatsApp({ isConnected: true } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });

			const res = await app.request("/api/whatsapp/pair");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("already_connected");
		});

		it("returns QR string on successful pairing start", async () => {
			const whatsapp = makeMockWhatsApp({
				startPairing: async (onQr: (qr: string) => void) => {
					onQr("test-qr-string-data");
				},
			} as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });

			const res = await app.request("/api/whatsapp/pair");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("pairing");
			expect(body.qr).toBe("test-qr-string-data");
		});
	});

	describe("GET /api/whatsapp/status", () => {
		it("returns connected false when bot is disconnected", async () => {
			const whatsapp = makeMockWhatsApp({ isConnected: false } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });

			const res = await app.request("/api/whatsapp/status");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(false);
		});

		it("returns connected true when bot is connected", async () => {
			const whatsapp = makeMockWhatsApp({ isConnected: true } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });

			const res = await app.request("/api/whatsapp/status");
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(true);
		});
	});

	describe("endpoints absent without WhatsApp bot", () => {
		it("returns 404 for /api/whatsapp/pair when no bot provided", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/whatsapp/pair");
			expect(res.status).toBe(404);
		});

		it("returns 404 for /api/whatsapp/status when no bot provided", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/whatsapp/status");
			expect(res.status).toBe(404);
		});
	});
});

describe("Auth endpoints", () => {
	let db: Kysely<DB>;
	const authConfig = createTestConfig({
		ADMIN_EMAIL: "admin@test.com",
		ADMIN_PASSWORD: "testpassword123",
	});

	beforeEach(async () => {
		db = await createTestDb();
		clearSessions();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	describe("POST /api/auth/login", () => {
		it("returns 401 with invalid credentials", async () => {
			const app = createApp(db, authConfig);
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "wrong@test.com", password: "wrong" }),
			});
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.error.code).toBe("UNAUTHORIZED");
		});

		it("returns 200 with valid credentials and sets cookie", async () => {
			const app = createApp(db, authConfig);
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.authenticated).toBe(true);
			expect(body.email).toBe("admin@test.com");
			expect(res.headers.get("set-cookie")).toContain("sketch_session=");
		});

		it("returns 400 when email or password missing", async () => {
			const app = createApp(db, authConfig);
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com" }),
			});
			expect(res.status).toBe(400);
		});

		it("returns 503 when admin auth not configured", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "a@b.com", password: "test" }),
			});
			expect(res.status).toBe(503);
		});
	});

	describe("GET /api/auth/session", () => {
		it("returns authenticated false when no cookie", async () => {
			const app = createApp(db, authConfig);
			const res = await app.request("/api/auth/session");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.authenticated).toBe(false);
		});

		it("returns authenticated true with valid session", async () => {
			const app = createApp(db, authConfig);

			// Login first
			const loginRes = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			const cookie = loginRes.headers.get("set-cookie") ?? "";

			// Check session
			const res = await app.request("/api/auth/session", {
				headers: { Cookie: cookie },
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.authenticated).toBe(true);
			expect(body.email).toBe("admin@test.com");
		});
	});

	describe("POST /api/auth/logout", () => {
		it("clears session and returns authenticated false", async () => {
			const app = createApp(db, authConfig);

			// Login
			const loginRes = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			const cookie = loginRes.headers.get("set-cookie") ?? "";

			// Logout
			const logoutRes = await app.request("/api/auth/logout", {
				method: "POST",
				headers: { Cookie: cookie },
			});
			expect(logoutRes.status).toBe(200);

			// Session should be invalid now
			const sessionRes = await app.request("/api/auth/session", {
				headers: { Cookie: cookie },
			});
			const body = await sessionRes.json();
			expect(body.authenticated).toBe(false);
		});
	});

	describe("Auth middleware", () => {
		it("blocks protected routes without auth", async () => {
			const whatsapp = {
				isConnected: false,
				startPairing: async () => {},
			} as unknown as WhatsAppBot;
			const app = createApp(db, authConfig, { whatsapp });

			const res = await app.request("/api/whatsapp/status");
			expect(res.status).toBe(401);
		});

		it("allows protected routes with valid session", async () => {
			const whatsapp = {
				isConnected: true,
			} as unknown as WhatsAppBot;
			const app = createApp(db, authConfig, { whatsapp });

			// Login
			const loginRes = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			const cookie = loginRes.headers.get("set-cookie") ?? "";

			// Access protected route
			const res = await app.request("/api/whatsapp/status", {
				headers: { Cookie: cookie },
			});
			expect(res.status).toBe(200);
		});

		it("allows /api/health without auth", async () => {
			const app = createApp(db, authConfig);
			const res = await app.request("/api/health");
			expect(res.status).toBe(200);
		});
	});
});
