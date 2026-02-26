import type { Kysely } from "kysely";
import type { DB } from "../schema.js";

export function createSettingsRepository(db: Kysely<DB>) {
	return {
		async get() {
			const row = await db.selectFrom("settings").selectAll().where("id", "=", "default").executeTakeFirst();
			return row ?? null;
		},

		async create(data: { adminEmail: string; adminPasswordHash: string }) {
			await db
				.insertInto("settings")
				.values({
					id: "default",
					admin_email: data.adminEmail,
					admin_password_hash: data.adminPasswordHash,
				})
				.execute();

			return db.selectFrom("settings").selectAll().where("id", "=", "default").executeTakeFirstOrThrow();
		},

		async update(data: Partial<{ orgName: string; botName: string; onboardingCompletedAt: string }>) {
			const updates: Record<string, string> = {};
			if (data.orgName !== undefined) updates.org_name = data.orgName;
			if (data.botName !== undefined) updates.bot_name = data.botName;
			if (data.onboardingCompletedAt !== undefined) updates.onboarding_completed_at = data.onboardingCompletedAt;

			if (Object.keys(updates).length === 0) return;

			await db.updateTable("settings").set(updates).where("id", "=", "default").execute();
		},
	};
}
