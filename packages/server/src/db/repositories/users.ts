import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../schema.js";

export function createUserRepository(db: Kysely<DB>) {
	return {
		async list() {
			return db.selectFrom("users").selectAll().orderBy("created_at", "desc").execute();
		},

		async findBySlackId(slackUserId: string) {
			return db.selectFrom("users").selectAll().where("slack_user_id", "=", slackUserId).executeTakeFirst();
		},

		async findByWhatsappNumber(whatsappNumber: string) {
			return db.selectFrom("users").selectAll().where("whatsapp_number", "=", whatsappNumber).executeTakeFirst();
		},

		async findById(id: string) {
			return db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
		},

		async create(data: { name: string; slackUserId?: string; whatsappNumber?: string }) {
			const id = randomUUID();
			await db
				.insertInto("users")
				.values({
					id,
					name: data.name,
					slack_user_id: data.slackUserId ?? null,
					whatsapp_number: data.whatsappNumber ?? null,
				})
				.execute();

			return db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
		},

		async update(id: string, data: { name?: string; whatsappNumber?: string | null }) {
			const values: Record<string, unknown> = {};
			if (data.name !== undefined) values.name = data.name;
			if (data.whatsappNumber !== undefined) values.whatsapp_number = data.whatsappNumber;

			if (Object.keys(values).length > 0) {
				await db.updateTable("users").set(values).where("id", "=", id).execute();
			}

			return db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
		},

		async remove(id: string) {
			return db.deleteFrom("users").where("id", "=", id).execute();
		},
	};
}
