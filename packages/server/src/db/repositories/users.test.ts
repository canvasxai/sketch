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
