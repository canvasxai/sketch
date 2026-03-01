import { randomBytes } from "node:crypto";
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
					jwt_secret: randomBytes(32).toString("hex"),
				})
				.execute();

			return db.selectFrom("settings").selectAll().where("id", "=", "default").executeTakeFirstOrThrow();
		},

		async update(
			data: Partial<{
				adminEmail: string;
				adminPasswordHash: string;
				orgName: string;
				botName: string;
				onboardingCompletedAt: string;
				slackBotToken: string | null;
				slackAppToken: string | null;
				llmProvider: string | null;
				anthropicApiKey: string | null;
				awsAccessKeyId: string | null;
				awsSecretAccessKey: string | null;
				awsRegion: string | null;
				jwtSecret: string;
			}>,
		) {
			const updates: Record<string, string | null> = {};
			if (data.adminEmail !== undefined) updates.admin_email = data.adminEmail;
			if (data.adminPasswordHash !== undefined) updates.admin_password_hash = data.adminPasswordHash;
			if (data.jwtSecret !== undefined) updates.jwt_secret = data.jwtSecret;
			if (data.orgName !== undefined) updates.org_name = data.orgName;
			if (data.botName !== undefined) updates.bot_name = data.botName;
			if (data.onboardingCompletedAt !== undefined) updates.onboarding_completed_at = data.onboardingCompletedAt;
			if (data.slackBotToken !== undefined) updates.slack_bot_token = data.slackBotToken;
			if (data.slackAppToken !== undefined) updates.slack_app_token = data.slackAppToken;
			if (data.llmProvider !== undefined) updates.llm_provider = data.llmProvider;
			if (data.anthropicApiKey !== undefined) updates.anthropic_api_key = data.anthropicApiKey;
			if (data.awsAccessKeyId !== undefined) updates.aws_access_key_id = data.awsAccessKeyId;
			if (data.awsSecretAccessKey !== undefined) updates.aws_secret_access_key = data.awsSecretAccessKey;
			if (data.awsRegion !== undefined) updates.aws_region = data.awsRegion;

			if (Object.keys(updates).length === 0) return;

			await db.updateTable("settings").set(updates).where("id", "=", "default").execute();
		},
	};
}
