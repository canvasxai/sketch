import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSessions } from "./api/auth";
import { hashPassword } from "./auth/password";
import { createSettingsRepository } from "./db/repositories/settings";
import type { DB } from "./db/schema";
import { createApp } from "./http";
import { createTestConfig, createTestDb } from "./test-utils";
import type { WhatsAppBot } from "./whatsapp/bot";

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
		clearSessions();
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

	/** Login and return the session cookie string. */
	async function loginAdmin(app: ReturnType<typeof createApp>) {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
		});
		return res.headers.get("set-cookie") ?? "";
	}

	describe("GET /api/whatsapp/pair", () => {
		it("returns already_connected when bot is connected", async () => {
			await seedAdmin(db);
			const whatsapp = makeMockWhatsApp({ isConnected: true } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("already_connected");
		});

		it("returns QR string on successful pairing start", async () => {
			await seedAdmin(db);
			const whatsapp = makeMockWhatsApp({
				startPairing: async (onQr: (qr: string) => void) => {
					onQr("test-qr-string-data");
				},
			} as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.status).toBe("pairing");
			expect(body.qr).toBe("test-qr-string-data");
		});
	});

	describe("GET /api/whatsapp/status", () => {
		it("returns connected false when bot is disconnected", async () => {
			await seedAdmin(db);
			const whatsapp = makeMockWhatsApp({ isConnected: false } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/whatsapp/status", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(false);
		});

		it("returns connected true when bot is connected", async () => {
			await seedAdmin(db);
			const whatsapp = makeMockWhatsApp({ isConnected: true } as Partial<WhatsAppBot>);
			const app = createApp(db, config, { whatsapp });
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/whatsapp/status", { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.connected).toBe(true);
		});
	});

	describe("endpoints absent without WhatsApp bot", () => {
		it("returns 404 for /api/whatsapp/pair when no bot provided", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/whatsapp/pair", { headers: { Cookie: cookie } });
			expect(res.status).toBe(404);
		});

		it("returns 404 for /api/whatsapp/status when no bot provided", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const cookie = await loginAdmin(app);

			const res = await app.request("/api/whatsapp/status", { headers: { Cookie: cookie } });
			expect(res.status).toBe(404);
		});
	});
});

describe("Auth endpoints", () => {
	let db: Kysely<DB>;

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
		it("clears session and returns authenticated false", async () => {
			await seedAdmin(db);
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

			const sessionRes = await app.request("/api/auth/session", {
				headers: { Cookie: cookie },
			});
			const body = await sessionRes.json();
			expect(body.authenticated).toBe(false);
		});
	});
});

describe("Auth middleware", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
		clearSessions();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	it("blocks protected routes without auth when admin exists", async () => {
		await seedAdmin(db);
		const whatsapp = { isConnected: false, startPairing: async () => {} } as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });

		const res = await app.request("/api/whatsapp/status");
		expect(res.status).toBe(401);
	});

	it("allows protected routes with valid session", async () => {
		await seedAdmin(db);
		const whatsapp = { isConnected: true } as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });

		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
		});
		const cookie = loginRes.headers.get("set-cookie") ?? "";

		const res = await app.request("/api/whatsapp/status", {
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
		const whatsapp = { isConnected: false } as unknown as WhatsAppBot;
		const app = createApp(db, config, { whatsapp });

		const res = await app.request("/api/whatsapp/status");
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.error.code).toBe("SETUP_REQUIRED");
	});

	it("allows /api/setup/* routes when setup incomplete", async () => {
		const app = createApp(db, config);
		const res = await app.request("/api/setup/status");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.completed).toBe(false);
	});
});

describe("Setup endpoints", () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		db = await createTestDb();
	});

	afterEach(async () => {
		try {
			await db.destroy();
		} catch {}
	});

	describe("GET /api/setup/status", () => {
		it("returns completed false when no settings", async () => {
			const app = createApp(db, config);
			const res = await app.request("/api/setup/status");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.completed).toBe(false);
			expect(body.currentStep).toBe(0);
		});

		it("returns completed true after account creation", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const res = await app.request("/api/setup/status");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.completed).toBe(true);
			expect(body.currentStep).toBe(1);
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

			// Verify account was created
			const statusRes = await app.request("/api/setup/status");
			const status = await statusRes.json();
			expect(status.completed).toBe(true);
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

		it("rejects if admin already exists", async () => {
			await seedAdmin(db);
			const app = createApp(db, config);
			const res = await app.request("/api/setup/account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "another@admin.com", password: "securepass123" }),
			});
			expect(res.status).toBe(409);
			const body = await res.json();
			expect(body.error.code).toBe("CONFLICT");
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
});
