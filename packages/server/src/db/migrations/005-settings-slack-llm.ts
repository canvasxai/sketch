import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("settings")
		.addColumn("slack_bot_token", "text")
		.addColumn("slack_app_token", "text")
		.addColumn("llm_provider", "text")
		.addColumn("anthropic_api_key", "text")
		.addColumn("aws_access_key_id", "text")
		.addColumn("aws_secret_access_key", "text")
		.addColumn("aws_region", "text")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("settings")
		.dropColumn("slack_bot_token")
		.dropColumn("slack_app_token")
		.dropColumn("llm_provider")
		.dropColumn("anthropic_api_key")
		.dropColumn("aws_access_key_id")
		.dropColumn("aws_secret_access_key")
		.dropColumn("aws_region")
		.execute();
}
