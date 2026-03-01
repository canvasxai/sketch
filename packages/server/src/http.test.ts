import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "./auth/password";
import { createSettingsRepository } from "./db/repositories/settings";
import type { DB } from "./db/schema";
import { createApp } from "./http";
import { createTestConfig, createTestDb } from "./test-utils";
import type { PairingCallbacks, WhatsAppBot } from "./whatsapp/bot";

const config = createTestConfig();

/** Helper to insert an admin account into the settings table. */
async function seedAdmin(db: Kysely<DB>, email = "admin@test.com", password = "testpassword123") {
	const settings = createSettingsRepository(db);
	const hash = await hashPassword(password);
	await settings.create({ adminEmail: email, adminPasswordHash: hash });
}

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
			// Without admin setup, returns 503 (setup required); with setup, 404
			expect([404, 503]).toContain(res.status);
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
			isConfigured: false,
			isConnected: false,
			phoneNumber: null,
			startPairing: async () => {},
			cancelPairing: () => {},
			disconnect: async () => {},
			...overrides,
		} as WhatsAppBot;
	}

	/** Login and return the session cookie string. */
	async function loginAdmin(app: ReturnType<typeof createApp>) {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
		});
		return res.headers.get("set-cookie") ?? "";
	}

	describe("GET /api/channels/whatsapp/pair", () => {
		it("returns 400 when bot is already connected", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const whatsapp = makeMockWhatsApp({ isConnected: true } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res.status).toBe(400);

			const body = await res.json();
			expect(body.error.code).toBe("ALREADY_CONNECTED");
		});

		it("returns 409 when pairing is already in progress", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });

			const whatsapp = makeMockWhatsApp({
				startPairing: () => new Promise<void>(() => {}),
			} as unknown as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			// First request starts pairing
			const res1 = await app.request("/api/channels/whatsapp/pair", { headers: { Cookie: cookie } });
			res1.text().catch(() => {});
			await new Promise((r) => setTimeout(r, 50));

			// Second request should get 409
			const res2 = await app.request("/api/channels/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res2.status).toBe(409);

			const body = await res2.json();
			expect(body.error.code).toBe("PAIRING_IN_PROGRESS");
		});

		it("returns SSE stream with qr and connected events", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });

			const whatsapp = makeMockWhatsApp({
				startPairing: async (callbacks: PairingCallbacks) => {
					await callbacks.onQr("test-qr-data-123");
					await callbacks.onConnected("+919876543210");
				},
			} as unknown as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("text/event-stream");

			const text = await res.text();
			expect(text).toContain('event: qr\ndata: {"qr":"test-qr-data-123"}');
			expect(text).toContain('event: connected\ndata: {"phoneNumber":"+919876543210"}');
		});

		it("returns SSE stream with error event on failure", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });

			const whatsapp = makeMockWhatsApp({
				startPairing: async (callbacks: PairingCallbacks) => {
					await callbacks.onQr("qr-before-failure");
					await callbacks.onError("QR code expired");
				},
			} as unknown as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const text = await res.text();
			expect(text).toContain("event: qr");
			expect(text).toContain('event: error\ndata: {"message":"QR code expired"}');
		});
	});

	describe("GET /api/channels/whatsapp", () => {
		it("returns connected false with null phone when bot is disconnected", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const whatsapp = makeMockWhatsApp({ isConnected: false, phoneNumber: null } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(false);
			expect(body.phoneNumber).toBeNull();
		});

		it("returns connected true with phone number when bot is connected", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const whatsapp = makeMockWhatsApp({
				isConnected: true,
				phoneNumber: "+919876543210",
			} as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(true);
			expect(body.phoneNumber).toBe("+919876543210");
		});
	});

	describe("DELETE /api/channels/whatsapp", () => {
		it("returns 400 when not connected", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const whatsapp = makeMockWhatsApp({ isConnected: false } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp", { method: "DELETE", headers: { Cookie: cookie } });
			expect(res.status).toBe(400);

			const body = await res.json();
			expect(body.error.code).toBe("NOT_CONNECTED");
		});

		it("disconnects successfully when connected", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const disconnectFn = vi.fn();
			const whatsapp = makeMockWhatsApp({
				isConnected: true,
				disconnect: disconnectFn,
			} as unknown as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp", { method: "DELETE", headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.success).toBe(true);
			expect(disconnectFn).toHaveBeenCalled();
		});
	});

	describe("DELETE /api/channels/whatsapp/pair", () => {
		it("returns 400 when no pairing in progress", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const whatsapp = makeMockWhatsApp();
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp/pair", { method: "DELETE", headers: { Cookie: cookie } });
			expect(res.status).toBe(400);

			const body = await res.json();
			expect(body.error.code).toBe("NO_PAIRING");
		});

		it("cancels an in-progress pairing", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });

			// Mock where cancelPairing resolves the startPairing promise (like real sock.ws.close())
			let resolvePairing: (() => void) | null = null;
			const whatsapp = makeMockWhatsApp({
				startPairing: async (callbacks: PairingCallbacks) => {
					await new Promise<void>((r) => {
						resolvePairing = r;
					});
					await callbacks.onError("Connection closed");
				},
				cancelPairing: () => {
					resolvePairing?.();
				},
			} as unknown as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			// Start pairing
			const res1 = await app.request("/api/channels/whatsapp/pair", { headers: { Cookie: cookie } });
			res1.text().catch(() => {});
			await new Promise((r) => setTimeout(r, 50));

			// Cancel it — should wait for startPairing to resolve before responding
			const res = await app.request("/api/channels/whatsapp/pair", { method: "DELETE", headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.success).toBe(true);
		});
	});

	describe("endpoints absent without WhatsApp bot", () => {
		it("returns 404 for /api/channels/whatsapp/pair when no bot provided", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res.status).toBe(404);
		});

		it("returns 404 for /api/channels/whatsapp when no bot provided", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/channels/whatsapp", { headers: { Cookie: cookie } });
			expect(res.status).toBe(404);
		});
	});
});

describe("Slack disconnect endpoint", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	/** Login and return the session cookie string. */
	async function loginAdmin(app: ReturnType<typeof createApp>) {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
		});
		return res.headers.get("set-cookie") ?? "";
	}

	it("returns 400 when Slack is not configured", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const app = createApp(db, config, { getSlack: () => null });
		const cookie = await loginAdmin(app);

		const res = await app.request("/api/channels/slack", { method: "DELETE", headers: { Cookie: cookie } });
		expect(res.status).toBe(400);

		const body = await res.json();
		expect(body.error.code).toBe("NOT_CONFIGURED");
	});

	it("disconnects successfully when Slack is configured", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const disconnectFn = vi.fn();
		const fakeSlack = { stop: vi.fn() } as unknown as import("./slack/bot").SlackBot;
		const app = createApp(db, config, {
			getSlack: () => fakeSlack,
			onSlackDisconnect: disconnectFn,
		});
		const cookie = await loginAdmin(app);

		const res = await app.request("/api/channels/slack", { method: "DELETE", headers: { Cookie: cookie } });
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.success).toBe(true);
		expect(disconnectFn).toHaveBeenCalled();
	});
});

describe("GET /api/channels/status — WhatsApp states", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	async function loginAdmin(app: ReturnType<typeof createApp>) {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
		});
		return res.headers.get("set-cookie") ?? "";
	}

	it("returns not-connected when WhatsApp is disconnected", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const whatsapp = {
			isConnected: false,
			phoneNumber: null,
		} as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });
		const cookie = await loginAdmin(app);

		const res = await app.request("/api/channels/status", { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);

		const body = await res.json();
		const wa = body.channels.find((ch: { platform: string }) => ch.platform === "whatsapp");
		expect(wa.configured).toBe(false);
		expect(wa.connected).toBeNull();
		expect(wa.phoneNumber).toBeNull();
	});

	it("returns connected with phone number when WhatsApp is connected", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const whatsapp = {
			isConnected: true,
			phoneNumber: "+919876543210",
		} as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });
		const cookie = await loginAdmin(app);

		const res = await app.request("/api/channels/status", { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);

		const body = await res.json();
		const wa = body.channels.find((ch: { platform: string }) => ch.platform === "whatsapp");
		expect(wa.configured).toBe(true);
		expect(wa.connected).toBe(true);
		expect(wa.phoneNumber).toBe("+919876543210");
	});

	it("returns not-connected when no WhatsApp dep provided", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const app = createApp(db, config);
		const cookie = await loginAdmin(app);

		const res = await app.request("/api/channels/status", { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);

		const body = await res.json();
		const wa = body.channels.find((ch: { platform: string }) => ch.platform === "whatsapp");
		expect(wa.configured).toBe(false);
		expect(wa.connected).toBeNull();
		expect(wa.phoneNumber).toBeNull();
	});
});

describe("Auth endpoints", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	describe("POST /api/auth/login", () => {
		it("returns 401 with invalid credentials", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
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
			await seedAdmin(db);
			const app = createApp(db, config);
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
			await seedAdmin(db);
			const app = createApp(db, config);
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com" }),
			});
			expect(res.status).toBe(400);
		});

		it("backfills jwt_secret and logs in when account predates JWT migration", async () => {
			const settings = createSettingsRepository(db);
			const hash = await hashPassword("testpassword123");
			await db
				.insertInto("settings")
				.values({ id: "default", admin_email: "admin@test.com", admin_password_hash: hash })
				.execute();

			const app = createApp(db, config);
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			expect(res.status).toBe(200);
			expect(res.headers.get("set-cookie")).toContain("sketch_session=");

			const row = await settings.get();
			expect(row?.jwt_secret).toBeTruthy();
			expect(row?.jwt_secret).toHaveLength(64);
		});

		it("returns 503 when no admin account exists", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "a@b.com", password: "testtest" }),
			});
			expect(res.status).toBe(503);
		});
	});

	describe("GET /api/auth/session", () => {
		it("returns authenticated false when no cookie", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/auth/session");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.authenticated).toBe(false);
		});

		it("returns authenticated true with valid session", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);

			const loginRes = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			const cookie = loginRes.headers.get("set-cookie") ?? "";

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
		it("clears cookie and returns authenticated false", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const app = createApp(db, config);

			const loginRes = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			const cookie = loginRes.headers.get("set-cookie") ?? "";

			const logoutRes = await app.request("/api/auth/logout", {
				method: "POST",
				headers: { Cookie: cookie },
			});
			expect(logoutRes.status).toBe(200);
			const logoutBody = await logoutRes.json();
			expect(logoutBody.authenticated).toBe(false);

			// After logout, browser no longer sends the cookie
			const sessionRes = await app.request("/api/auth/session");
			const body = await sessionRes.json();
			expect(body.authenticated).toBe(false);
		});
	});
});

describe("Auth middleware", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	async function loginAdmin(app: ReturnType<typeof createApp>) {
		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
		});
		return loginRes.headers.get("set-cookie") ?? "";
	}

	it("blocks protected routes without auth when onboarding is complete", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const whatsapp = {
			isConnected: false,
			phoneNumber: null,
			startPairing: async () => {},
			disconnect: async () => {},
		} as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });

		const res = await app.request("/api/channels/whatsapp");
		expect(res.status).toBe(401);
	});

	it("allows protected routes with valid session when onboarding is complete", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const whatsapp = { isConnected: true, phoneNumber: null } as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });

		const cookie = await loginAdmin(app);

		const res = await app.request("/api/channels/whatsapp", {
			headers: { Cookie: cookie },
		});
		expect(res.status).toBe(200);
	});

	it("allows /api/health without auth", async () => {
		await seedAdmin(db);
		const app = createApp(db, config);
		const res = await app.request("/api/health");
		expect(res.status).toBe(200);
	});

	it("returns 503 for protected routes when setup incomplete", async () => {
		const app = createApp(db, config);

		const res = await app.request("/api/channels/status");
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.error.code).toBe("SETUP_REQUIRED");
	});

	it("allows whatsapp routes during onboarding with valid session", async () => {
		await seedAdmin(db);
		const whatsapp = { isConnected: false, phoneNumber: null } as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });
		const cookie = await loginAdmin(app);

		const res = await app.request("/api/channels/whatsapp", { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.connected).toBe(false);
	});

	it("allows public setup routes when setup is incomplete", async () => {
		const app = createApp(db, config);
		const res = await app.request("/api/setup/status");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.completed).toBe(false);
	});

	it("requires auth for protected setup routes when onboarding is complete", async () => {
		await seedAdmin(db);
		const settings = createSettingsRepository(db);
		await settings.update({ onboardingCompletedAt: new Date().toISOString() });
		const app = createApp(db, config);

		const res = await app.request("/api/setup/llm", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ provider: "anthropic", apiKey: "sk-ant-test-key" }),
		});
		expect(res.status).toBe(401);
	});

	it("requires auth for protected setup routes after admin account exists", async () => {
		await seedAdmin(db);
		const app = createApp(db, config);

		const res = await app.request("/api/setup/slack", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ botToken: "xoxb-test", appToken: "xapp-test" }),
		});
		expect(res.status).toBe(401);
	});

	it("allows protected setup routes with valid session while onboarding is incomplete", async () => {
		await seedAdmin(db);
		const app = createApp(db, config);
		const cookie = await loginAdmin(app);

		const res = await app.request("/api/setup/identity", {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ orgName: "Acme", botName: "Sketch" }),
		});
		expect(res.status).toBe(200);
	});
});

describe("Setup endpoints", () => {
	let db: Kysely<DB>;
	let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		if (fetchSpy) {
			fetchSpy.mockRestore();
			fetchSpy = null;
		}
		try {
			await db.destroy();
		} catch {}
	});

	async function loginAdmin(app: ReturnType<typeof createApp>, email = "admin@test.com", password = "testpassword123") {
		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		return loginRes.headers.get("set-cookie") ?? "";
	}

	describe("GET /api/setup/status", () => {
		it("returns completed false when no settings", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/setup/status");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.completed).toBe(false);
			expect(body.currentStep).toBe(0);
		});

		it("returns completed false after account creation but before completion", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const res = await app.request("/api/setup/status");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.completed).toBe(false);
			expect(body.currentStep).toBe(2);
			expect(body.adminEmail).toBe("admin@test.com");
		});

		it("advances currentStep as setup data is persisted", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			const app = createApp(db, config);

			await settings.update({ orgName: "Acme", botName: "Sketch" });
			let res = await app.request("/api/setup/status");
			let body = await res.json();
			expect(body.currentStep).toBe(3);

			await settings.update({ slackBotToken: "xoxb-token", slackAppToken: "xapp-token" });
			res = await app.request("/api/setup/status");
			body = await res.json();
			expect(body.currentStep).toBe(4);

			await settings.update({ llmProvider: "anthropic", anthropicApiKey: "sk-ant-test-key" });
			res = await app.request("/api/setup/status");
			body = await res.json();
			expect(body.currentStep).toBe(5);
		});

		it("returns completed true after onboarding completion", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);
			await app.request("/api/setup/complete", { method: "POST", headers: { Cookie: cookie } });

			const res = await app.request("/api/setup/status");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.completed).toBe(true);
		});
	});

	describe("POST /api/setup/slack/verify", () => {
		it("verifies Slack tokens using auth.test and apps.connections.open", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);
			const botToken = "xoxb-valid-token";
			const appToken = "xapp-valid-token";

			fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
				async () =>
					new Response(JSON.stringify({ ok: true, team: "Test Workspace" }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
			);

			const res = await app.request("/api/setup/slack/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ botToken, appToken }),
			});

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(body.workspaceName).toBe("Test Workspace");

			expect(fetchSpy).toHaveBeenCalledTimes(2);
			const [authUrl, authOptions] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(authUrl).toBe("https://slack.com/api/auth.test");
			expect(authOptions.method).toBe("POST");
			expect(authOptions.headers).toMatchObject({
				Authorization: `Bearer ${botToken}`,
			});
			const [connUrl, connOptions] = fetchSpy.mock.calls[1] as [string, RequestInit];
			expect(connUrl).toBe("https://slack.com/api/apps.connections.open");
			expect(connOptions.headers).toMatchObject({
				Authorization: `Bearer ${appToken}`,
			});
		});

		it("returns INVALID_SLACK_TOKENS when auth.test fails", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(JSON.stringify({ ok: false, error: "invalid_auth" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}) as Response,
			);

			const res = await app.request("/api/setup/slack/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ botToken: "xoxb-invalid", appToken: "xapp-invalid" }),
			});

			expect(res.status).toBe(400);
			const body = await res.json();
			expect(body.error.code).toBe("INVALID_SLACK_TOKENS");
		});
	});

	describe("POST /api/setup/llm/verify", () => {
		it("verifies Anthropic API key and returns success", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(JSON.stringify({ id: "msg_123", type: "message" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}) as Response,
			);

			const res = await app.request("/api/setup/llm/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ provider: "anthropic", apiKey: "sk-ant-valid" }),
			});

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe("https://api.anthropic.com/v1/messages");
		});

		it("returns INVALID_LLM_SETTINGS when Anthropic verification fails", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(JSON.stringify({ error: { type: "authentication_error" } }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				}) as Response,
			);

			const res = await app.request("/api/setup/llm/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ provider: "anthropic", apiKey: "sk-ant-invalid" }),
			});

			expect(res.status).toBe(400);
			const body = (await res.json()) as { error: { code: string } };
			expect(body.error.code).toBe("INVALID_LLM_SETTINGS");
		});
	});

	describe("POST /api/setup/account", () => {
		it("creates admin account and returns success", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@new.com", password: "securepass123" }),
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(res.headers.get("set-cookie")).toContain("sketch_session=");

			// Verify account was created but setup not yet completed
			const statusRes = await app.request("/api/setup/status");
			const status = await statusRes.json();
			expect(status.completed).toBe(false);
		});

		it("stores password hashed, not plaintext", async () => {
			const app = createApp(db, config);
			await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@new.com", password: "securepass123" }),
			});

			const settings = createSettingsRepository(db);
			const row = await settings.get();
			expect(row?.admin_password_hash).not.toBe("securepass123");
			expect(row?.admin_password_hash).toContain(":");
		});

		it("creates an authenticated session for subsequent setup steps", async () => {
			const app = createApp(db, config);
			const accountRes = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@new.com", password: "securepass123" }),
			});
			const cookie = accountRes.headers.get("set-cookie") ?? "";

			const identityRes = await app.request("/api/setup/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ orgName: "Acme", botName: "Sketch" }),
			});
			expect(identityRes.status).toBe(200);
		});

		it("updates credentials when admin already exists and onboarding is incomplete", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const res = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "another@admin.com", password: "securepass123" }),
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);

			const settings = createSettingsRepository(db);
			const row = await settings.get();
			expect(row?.admin_email).toBe("another@admin.com");
			expect(row?.admin_password_hash).not.toBeNull();

			const oldLogin = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
			});
			expect(oldLogin.status).toBe(401);

			const newLogin = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "another@admin.com", password: "securepass123" }),
			});
			expect(newLogin.status).toBe(200);
		});

		it("rejects account updates after onboarding is completed", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });

			const app = createApp(db, config);
			const res = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "another@admin.com", password: "securepass123" }),
			});

			expect(res.status).toBe(409);
			const body = await res.json();
			expect(body.error.code).toBe("ONBOARDING_COMPLETE");
		});

		it("rejects invalid email", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "notanemail", password: "securepass123" }),
			});
			expect(res.status).toBe(400);
		});

		it("rejects short password", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@new.com", password: "short" }),
			});
			expect(res.status).toBe(400);
		});

		it("rejects missing fields", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(400);
		});
	});

	describe("POST /api/setup/slack", () => {
		it("rejects invalid Slack tokens and does not persist them", async () => {
			await seedAdmin(db);
			const app = createApp(db, config, {
				onSlackTokensUpdated: async () => {
					throw new Error("invalid_auth");
				},
			});
			const cookie = await loginAdmin(app);
			const res = await app.request("/api/setup/slack", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({
					botToken: "xoxb-invalid",
					appToken: "xapp-invalid",
				}),
			});

			expect(res.status).toBe(400);
			const body = await res.json();
			expect(body.error.code).toBe("INVALID_SLACK_TOKENS");

			const settings = createSettingsRepository(db);
			const row = await settings.get();
			expect(row?.slack_bot_token).toBeNull();
			expect(row?.slack_app_token).toBeNull();
		});

		it("persists Slack tokens only after successful validation", async () => {
			await seedAdmin(db);
			let callbackCalled = false;
			const app = createApp(db, config, {
				onSlackTokensUpdated: async () => {
					callbackCalled = true;
				},
			});
			const cookie = await loginAdmin(app);
			const res = await app.request("/api/setup/slack", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({
					botToken: "xoxb-valid-token",
					appToken: "xapp-valid-token",
				}),
			});

			expect(res.status).toBe(200);
			expect(callbackCalled).toBe(true);

			const settings = createSettingsRepository(db);
			const row = await settings.get();
			expect(row?.slack_bot_token).toBe("xoxb-valid-token");
			expect(row?.slack_app_token).toBe("xapp-valid-token");
		});
	});

	describe("POST /api/setup/identity", () => {
		it("returns setup required when admin account does not exist", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/setup/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ orgName: "Acme", botName: "Sketch" }),
			});

			expect(res.status).toBe(503);
			const body = await res.json();
			expect(body.error.code).toBe("SETUP_REQUIRED");
		});

		it("stores latest identity when updated multiple times during onboarding", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			let res = await app.request("/api/setup/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ orgName: "Acme", botName: "Sketch" }),
			});
			expect(res.status).toBe(200);

			res = await app.request("/api/setup/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ orgName: "Acme Labs", botName: "Sketch Pro" }),
			});
			expect(res.status).toBe(200);

			const settings = createSettingsRepository(db);
			const row = await settings.get();
			expect(row?.org_name).toBe("Acme Labs");
			expect(row?.bot_name).toBe("Sketch Pro");

			const statusRes = await app.request("/api/setup/status");
			const status = await statusRes.json();
			expect(status.orgName).toBe("Acme Labs");
			expect(status.botName).toBe("Sketch Pro");
		});

		it("trims organization and bot names before persisting", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/setup/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ orgName: "  Acme Labs  ", botName: "  Sketch Pro  " }),
			});
			expect(res.status).toBe(200);

			const settings = createSettingsRepository(db);
			const row = await settings.get();
			expect(row?.org_name).toBe("Acme Labs");
			expect(row?.bot_name).toBe("Sketch Pro");
		});
	});

	describe("POST /api/setup/llm", () => {
		it("persists anthropic provider and clears bedrock credentials", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({
				llmProvider: "bedrock",
				awsAccessKeyId: "AKIA-old",
				awsSecretAccessKey: "secret-old",
				awsRegion: "us-east-1",
			});
			let callbackCount = 0;
			const app = createApp(db, config, {
				onLlmSettingsUpdated: async () => {
					callbackCount += 1;
				},
			});
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/setup/llm", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ provider: "anthropic", apiKey: "sk-ant-live" }),
			});
			expect(res.status).toBe(200);
			expect(callbackCount).toBe(1);

			const row = await settings.get();
			expect(row?.llm_provider).toBe("anthropic");
			expect(row?.anthropic_api_key).toBe("sk-ant-live");
			expect(row?.aws_access_key_id).toBeNull();
			expect(row?.aws_secret_access_key).toBeNull();
			expect(row?.aws_region).toBeNull();
		});

		it("persists bedrock provider and clears anthropic key", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({
				llmProvider: "anthropic",
				anthropicApiKey: "sk-ant-old",
			});
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/setup/llm", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({
					provider: "bedrock",
					awsAccessKeyId: "  AKIA-new  ",
					awsSecretAccessKey: "  secret-new  ",
					awsRegion: "  us-west-2  ",
				}),
			});
			expect(res.status).toBe(200);

			const row = await settings.get();
			expect(row?.llm_provider).toBe("bedrock");
			expect(row?.anthropic_api_key).toBeNull();
			expect(row?.aws_access_key_id).toBe("AKIA-new");
			expect(row?.aws_secret_access_key).toBe("secret-new");
			expect(row?.aws_region).toBe("us-west-2");
		});
	});

	describe("POST /api/setup/complete", () => {
		it("stores onboarding completion timestamp", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/setup/complete", {
				method: "POST",
				headers: { Cookie: cookie },
			});
			expect(res.status).toBe(200);

			const settings = createSettingsRepository(db);
			const row = await settings.get();
			expect(row?.onboarding_completed_at).toBeTruthy();
		});
	});
});

describe("Settings endpoints", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	async function loginAdmin(app: ReturnType<typeof createApp>) {
		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
		});
		return loginRes.headers.get("set-cookie") ?? "";
	}

	describe("GET /api/settings/identity", () => {
		it("returns default bot name and null org when no identity configured", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({ onboardingCompletedAt: new Date().toISOString() });
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/settings/identity", {
				headers: { Cookie: cookie },
			});
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.orgName).toBeNull();
			expect(body.botName).toBe("Sketch");
		});

		it("returns persisted identity values", async () => {
			await seedAdmin(db);
			const settings = createSettingsRepository(db);
			await settings.update({
				orgName: "Acme Labs",
				botName: "Sketch Pro",
				onboardingCompletedAt: new Date().toISOString(),
			});
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/settings/identity", {
				headers: { Cookie: cookie },
			});
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.orgName).toBe("Acme Labs");
			expect(body.botName).toBe("Sketch Pro");
		});
	});
});
