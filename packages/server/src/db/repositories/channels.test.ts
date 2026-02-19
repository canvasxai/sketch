import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test-utils";
import type { DB } from "../schema";
import { createChannelRepository } from "./channels";

let db: Kysely<DB>;
let channels: ReturnType<typeof createChannelRepository>;

beforeEach(async () => {
	db = await createTestDb();
	channels = createChannelRepository(db);
});

afterEach(async () => {
	await db.destroy();
});

describe("create()", () => {
	it("returns channel with generated UUID id", async () => {
		const channel = await channels.create({ slackChannelId: "C001", name: "general", type: "public_channel" });
		expect(channel.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	it("returned channel has correct fields", async () => {
		const channel = await channels.create({ slackChannelId: "C002", name: "random", type: "private_channel" });
		expect(channel.slack_channel_id).toBe("C002");
		expect(channel.name).toBe("random");
		expect(channel.type).toBe("private_channel");
	});

	it("created_at is populated automatically", async () => {
		const channel = await channels.create({ slackChannelId: "C003", name: "dev", type: "public_channel" });
		expect(channel.created_at).toBeDefined();
		expect(typeof channel.created_at).toBe("string");
		expect(channel.created_at.length).toBeGreaterThan(0);
	});

	it("duplicate slack_channel_id throws", async () => {
		await channels.create({ slackChannelId: "C004", name: "ops", type: "public_channel" });
		await expect(
			channels.create({ slackChannelId: "C004", name: "ops-dupe", type: "public_channel" }),
		).rejects.toThrow();
	});
});

describe("findBySlackChannelId()", () => {
	it("returns the channel when found", async () => {
		const created = await channels.create({ slackChannelId: "C005", name: "support", type: "public_channel" });
		const found = await channels.findBySlackChannelId("C005");
		expect(found).toBeDefined();
		expect(found?.id).toBe(created.id);
		expect(found?.name).toBe("support");
		expect(found?.slack_channel_id).toBe("C005");
	});

	it("returns undefined when not found", async () => {
		const found = await channels.findBySlackChannelId("C999");
		expect(found).toBeUndefined();
	});
});

describe("findById()", () => {
	it("returns the channel when found", async () => {
		const created = await channels.create({ slackChannelId: "C006", name: "design", type: "group" });
		const found = await channels.findById(created.id);
		expect(found).toBeDefined();
		expect(found?.id).toBe(created.id);
		expect(found?.name).toBe("design");
		expect(found?.type).toBe("group");
	});

	it("returns undefined when not found", async () => {
		const found = await channels.findById("nonexistent-id");
		expect(found).toBeUndefined();
	});
});
