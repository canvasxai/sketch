import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../schema.js";

export function createUserRepository(db: Kysely<DB>) {
	return {
		async findBySlackId(slackUserId: string) {
			return db.selectFrom("users").selectAll().where("slack_user_id", "=", slackUserId).executeTakeFirst();
		},

		async findById(id: string) {
			return db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
		},

		async create(data: { name: string; slackUserId: string }) {
			const id = randomUUID();
			await db
				.insertInto("users")
				.values({
					id,
					name: data.name,
					slack_user_id: data.slackUserId,
				})
				.execute();

			return db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
		},
	};
}
