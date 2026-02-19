import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "./db/schema";
import { createApp } from "./http";
import { createTestDb } from "./test-utils";

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
