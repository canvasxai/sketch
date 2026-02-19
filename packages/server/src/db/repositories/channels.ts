import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../schema.js";

export function createChannelRepository(db: Kysely<DB>) {
	return {
		async findBySlackChannelId(slackChannelId: string) {
			return db.selectFrom("channels").selectAll().where("slack_channel_id", "=", slackChannelId).executeTakeFirst();
		},

		async findById(id: string) {
			return db.selectFrom("channels").selectAll().where("id", "=", id).executeTakeFirst();
		},

		async create(data: { slackChannelId: string; name: string; type: string }) {
			const id = randomUUID();
			await db
				.insertInto("channels")
				.values({
					id,
					slack_channel_id: data.slackChannelId,
					name: data.name,
					type: data.type,
				})
				.execute();

			return db.selectFrom("channels").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
		},
	};
}
