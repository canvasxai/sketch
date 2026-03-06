import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../schema.js";

export function createWaGroupRepository(db: Kysely<DB>) {
  return {
    async findByGroupJid(groupJid: string) {
      return db.selectFrom("wa_groups").selectAll().where("group_jid", "=", groupJid).executeTakeFirst();
    },

    async findById(id: string) {
      return db.selectFrom("wa_groups").selectAll().where("id", "=", id).executeTakeFirst();
    },

    async listAll() {
      return db.selectFrom("wa_groups").selectAll().orderBy("created_at", "desc").execute();
    },

    async upsert(data: { groupJid: string; name: string }) {
      const existing = await db
        .selectFrom("wa_groups")
        .selectAll()
        .where("group_jid", "=", data.groupJid)
        .executeTakeFirst();

      if (existing) {
        if (existing.name !== data.name) {
          await db.updateTable("wa_groups").set({ name: data.name }).where("id", "=", existing.id).execute();
          return db.selectFrom("wa_groups").selectAll().where("id", "=", existing.id).executeTakeFirstOrThrow();
        }
        return existing;
      }

      const id = randomUUID();
      await db
        .insertInto("wa_groups")
        .values({
          id,
          group_jid: data.groupJid,
          name: data.name,
          allowed_skills: null,
        })
        .execute();

      return db.selectFrom("wa_groups").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    },

    async updateAllowedSkills(id: string, allowedSkills: string[] | null) {
      const raw = allowedSkills === null ? null : JSON.stringify(allowedSkills);
      const result = await db
        .updateTable("wa_groups")
        .set({ allowed_skills: raw })
        .where("id", "=", id)
        .executeTakeFirst();

      return Number(result.numUpdatedRows) > 0;
    },
  };
}
