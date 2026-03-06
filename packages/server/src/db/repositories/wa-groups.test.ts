import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test-utils";
import type { DB } from "../schema";
import { createWaGroupRepository } from "./wa-groups";

let db: Kysely<DB>;
let waGroups: ReturnType<typeof createWaGroupRepository>;

beforeEach(async () => {
  db = await createTestDb();
  waGroups = createWaGroupRepository(db);
});

afterEach(async () => {
  await db.destroy();
});

describe("upsert()", () => {
  it("creates a new group on first call", async () => {
    const group = await waGroups.upsert({ groupJid: "g1@g.us", name: "Test Group" });
    expect(group.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(group.group_jid).toBe("g1@g.us");
    expect(group.name).toBe("Test Group");
    expect(group.allowed_skills).toBeNull();
  });

  it("returns existing group on subsequent calls", async () => {
    const first = await waGroups.upsert({ groupJid: "g2@g.us", name: "Group A" });
    const second = await waGroups.upsert({ groupJid: "g2@g.us", name: "Group A" });
    expect(second.id).toBe(first.id);
  });

  it("updates name if changed", async () => {
    await waGroups.upsert({ groupJid: "g3@g.us", name: "Old Name" });
    await waGroups.upsert({ groupJid: "g3@g.us", name: "New Name" });

    const found = await waGroups.findByGroupJid("g3@g.us");
    expect(found?.name).toBe("New Name");
  });
});

describe("findByGroupJid()", () => {
  it("returns the group when found", async () => {
    await waGroups.upsert({ groupJid: "g4@g.us", name: "Found Group" });
    const found = await waGroups.findByGroupJid("g4@g.us");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Found Group");
  });

  it("returns undefined when not found", async () => {
    const found = await waGroups.findByGroupJid("nonexistent@g.us");
    expect(found).toBeUndefined();
  });
});

describe("listAll()", () => {
  it("returns empty array when no groups exist", async () => {
    const all = await waGroups.listAll();
    expect(all).toEqual([]);
  });

  it("returns all groups", async () => {
    await waGroups.upsert({ groupJid: "g5@g.us", name: "Group 1" });
    await waGroups.upsert({ groupJid: "g6@g.us", name: "Group 2" });
    const all = await waGroups.listAll();
    expect(all).toHaveLength(2);
  });
});

describe("updateAllowedSkills()", () => {
  it("sets allowed_skills to a JSON array", async () => {
    const group = await waGroups.upsert({ groupJid: "g7@g.us", name: "Skills Group" });
    const updated = await waGroups.updateAllowedSkills(group.id, ["canvas", "crm"]);
    expect(updated).toBe(true);

    const found = await waGroups.findById(group.id);
    expect(found?.allowed_skills).toBe('["canvas","crm"]');
  });

  it("sets allowed_skills to null (unrestricted)", async () => {
    const group = await waGroups.upsert({ groupJid: "g8@g.us", name: "Null Group" });
    await waGroups.updateAllowedSkills(group.id, ["canvas"]);
    await waGroups.updateAllowedSkills(group.id, null);

    const found = await waGroups.findById(group.id);
    expect(found?.allowed_skills).toBeNull();
  });

  it("returns false for non-existent group", async () => {
    const updated = await waGroups.updateAllowedSkills("nonexistent-id", ["canvas"]);
    expect(updated).toBe(false);
  });
});
