import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test-utils";
import type { DB } from "../schema";
import { createUserRepository } from "./users";

let db: Kysely<DB>;
let users: ReturnType<typeof createUserRepository>;

beforeEach(async () => {
	db = await createTestDb();
	users = createUserRepository(db);
});

afterEach(async () => {
	await db.destroy();
});

describe("create()", () => {
	it("returns user with generated UUID id", async () => {
		const user = await users.create({ name: "Alice", slackUserId: "U001" });
		expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	it("returned user has correct name and slack_user_id", async () => {
		const user = await users.create({ name: "Bob", slackUserId: "U002" });
		expect(user.name).toBe("Bob");
		expect(user.slack_user_id).toBe("U002");
	});

	it("created_at is populated automatically", async () => {
		const user = await users.create({ name: "Carol", slackUserId: "U003" });
		expect(user.created_at).toBeDefined();
		expect(typeof user.created_at).toBe("string");
		expect(user.created_at.length).toBeGreaterThan(0);
	});

	it("second create with different slack_user_id succeeds", async () => {
		await users.create({ name: "Dave", slackUserId: "U004" });
		const second = await users.create({ name: "Eve", slackUserId: "U005" });
		expect(second.name).toBe("Eve");
		expect(second.slack_user_id).toBe("U005");
	});

	it("duplicate slack_user_id throws", async () => {
		await users.create({ name: "Frank", slackUserId: "U006" });
		await expect(users.create({ name: "Grace", slackUserId: "U006" })).rejects.toThrow();
	});

	it("creates user with whatsappNumber only (no slackUserId)", async () => {
		const user = await users.create({ name: "Liam", whatsappNumber: "+919876543210" });
		expect(user.name).toBe("Liam");
		expect(user.whatsapp_number).toBe("+919876543210");
		expect(user.slack_user_id).toBeNull();
	});

	it("creates user with both slackUserId and whatsappNumber", async () => {
		const user = await users.create({ name: "Maya", slackUserId: "U100", whatsappNumber: "+14155551234" });
		expect(user.slack_user_id).toBe("U100");
		expect(user.whatsapp_number).toBe("+14155551234");
	});

	it("duplicate whatsapp_number throws", async () => {
		await users.create({ name: "Noah", whatsappNumber: "+14155559999" });
		await expect(users.create({ name: "Olivia", whatsappNumber: "+14155559999" })).rejects.toThrow();
	});
});

describe("findBySlackId()", () => {
	it("returns the user when found", async () => {
		const created = await users.create({ name: "Hank", slackUserId: "U007" });
		const found = await users.findBySlackId("U007");
		expect(found).toBeDefined();
		expect(found?.id).toBe(created.id);
		expect(found?.name).toBe("Hank");
		expect(found?.slack_user_id).toBe("U007");
	});

	it("returns undefined when not found", async () => {
		const found = await users.findBySlackId("U999");
		expect(found).toBeUndefined();
	});
});

describe("findByWhatsappNumber()", () => {
	it("returns user when found", async () => {
		const created = await users.create({ name: "Kim", whatsappNumber: "+14155238886" });
		const found = await users.findByWhatsappNumber("+14155238886");
		expect(found).toBeDefined();
		expect(found?.id).toBe(created.id);
		expect(found?.name).toBe("Kim");
		expect(found?.whatsapp_number).toBe("+14155238886");
	});

	it("returns undefined when not found", async () => {
		const found = await users.findByWhatsappNumber("+10000000000");
		expect(found).toBeUndefined();
	});
});

describe("findById()", () => {
	it("returns the user when found", async () => {
		const created = await users.create({ name: "Ivy", slackUserId: "U008" });
		const found = await users.findById(created.id);
		expect(found).toBeDefined();
		expect(found?.id).toBe(created.id);
		expect(found?.name).toBe("Ivy");
		expect(found?.slack_user_id).toBe("U008");
	});

	it("returns undefined when not found", async () => {
		const found = await users.findById("nonexistent-id");
		expect(found).toBeUndefined();
	});
});

describe("list()", () => {
	it("returns all users", async () => {
		await users.create({ name: "Alice", slackUserId: "U001" });
		await users.create({ name: "Bob", whatsappNumber: "+919876543210" });
		await users.create({ name: "Carol", slackUserId: "U003" });

		const list = await users.list();
		expect(list).toHaveLength(3);
		const names = list.map((u) => u.name);
		expect(names).toContain("Alice");
		expect(names).toContain("Bob");
		expect(names).toContain("Carol");
	});

	it("returns empty array when no users", async () => {
		const list = await users.list();
		expect(list).toEqual([]);
	});
});

describe("update()", () => {
	it("updates name", async () => {
		const created = await users.create({ name: "Dave", slackUserId: "U010" });
		const updated = await users.update(created.id, { name: "David" });
		expect(updated.name).toBe("David");
		expect(updated.slack_user_id).toBe("U010");
	});

	it("updates whatsapp_number", async () => {
		const created = await users.create({ name: "Eve", slackUserId: "U011" });
		const updated = await users.update(created.id, { whatsappNumber: "+14155551234" });
		expect(updated.whatsapp_number).toBe("+14155551234");
		expect(updated.name).toBe("Eve");
	});

	it("clears whatsapp_number when set to null", async () => {
		const created = await users.create({ name: "Frank", whatsappNumber: "+14155559999" });
		const updated = await users.update(created.id, { whatsappNumber: null });
		expect(updated.whatsapp_number).toBeNull();
	});

	it("throws on duplicate whatsapp_number", async () => {
		await users.create({ name: "Grace", whatsappNumber: "+14155550001" });
		const other = await users.create({ name: "Hank", whatsappNumber: "+14155550002" });
		await expect(users.update(other.id, { whatsappNumber: "+14155550001" })).rejects.toThrow();
	});

	it("returns unchanged user when no fields provided", async () => {
		const created = await users.create({ name: "Ivy", slackUserId: "U012" });
		const updated = await users.update(created.id, {});
		expect(updated.name).toBe("Ivy");
		expect(updated.slack_user_id).toBe("U012");
	});
});

describe("remove()", () => {
	it("deletes user", async () => {
		const created = await users.create({ name: "Jack", slackUserId: "U013" });
		await users.remove(created.id);
		const found = await users.findById(created.id);
		expect(found).toBeUndefined();
	});

	it("does not throw on non-existent id", async () => {
		await expect(users.remove("nonexistent-id")).resolves.not.toThrow();
	});
});
