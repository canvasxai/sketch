import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../schema.js";

export function createChannelRepository(db: Kysely<DB>) {
  return {
    async findBySlackChannelId(slackChannelId: string) {
      return db
        .selectFrom("slack_channels")
        .selectAll()
        .where("slack_channel_id", "=", slackChannelId)
        .executeTakeFirst();
    },

    async findById(id: string) {
      return db.selectFrom("slack_channels").selectAll().where("id", "=", id).executeTakeFirst();
    },

    async listAll() {
      return db.selectFrom("slack_channels").selectAll().orderBy("created_at", "desc").execute();
    },

    async create(data: { slackChannelId: string; name: string; type: string }) {
      const id = randomUUID();
      await db
        .insertInto("slack_channels")
        .values({
          id,
          slack_channel_id: data.slackChannelId,
          name: data.name,
          type: data.type,
          allowed_skills: null,
        })
        .execute();

      return db.selectFrom("slack_channels").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    },

    async updateAllowedSkills(id: string, allowedSkills: string[] | null) {
      const raw = allowedSkills === null ? null : JSON.stringify(allowedSkills);
      const result = await db
        .updateTable("slack_channels")
        .set({ allowed_skills: raw })
        .where("id", "=", id)
        .executeTakeFirst();

      return Number(result.numUpdatedRows) > 0;
    },
  };
}
