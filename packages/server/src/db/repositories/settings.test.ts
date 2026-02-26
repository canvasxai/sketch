import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test-utils";
import type { DB } from "../schema";
import { createSettingsRepository } from "./settings";

describe("Settings repository", () => {
	let db: Kysely<DB>;
	let settings: ReturnType<typeof createSettingsRepository>;

	beforeEach(async () => {
		db = await createTestDb();
		settings = createSettingsRepository(db);
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("get() returns null when no settings exist", async () => {
		const result = await settings.get();
		expect(result).toBeNull();
	});

	it("create() inserts a row and get() returns it", async () => {
		await settings.create({ adminEmail: "admin@test.com", adminPasswordHash: "hash123" });
		const row = await settings.get();
		expect(row).not.toBeNull();
		expect(row?.admin_email).toBe("admin@test.com");
		expect(row?.admin_password_hash).toBe("hash123");
		expect(row?.bot_name).toBe("Sketch");
		expect(row?.org_name).toBeNull();
	});

	it("create() rejects duplicate settings row", async () => {
		await settings.create({ adminEmail: "a@b.com", adminPasswordHash: "hash" });
		await expect(settings.create({ adminEmail: "c@d.com", adminPasswordHash: "hash2" })).rejects.toThrow();
	});

	it("update() changes specific columns", async () => {
		await settings.create({ adminEmail: "a@b.com", adminPasswordHash: "hash" });
		await settings.update({ orgName: "Acme Corp", botName: "Helper" });

		const row = await settings.get();
		expect(row?.org_name).toBe("Acme Corp");
		expect(row?.bot_name).toBe("Helper");
		expect(row?.admin_email).toBe("a@b.com");
	});

	it("update() with empty data is a no-op", async () => {
		await settings.create({ adminEmail: "a@b.com", adminPasswordHash: "hash" });
		await settings.update({});
		const row = await settings.get();
		expect(row?.admin_email).toBe("a@b.com");
	});
});
