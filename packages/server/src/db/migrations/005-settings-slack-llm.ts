import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// SQLite only allows adding one column per ALTER TABLE statement,
	// so we apply each column addition separately.
	await db.schema.alterTable("settings").addColumn("slack_bot_token", "text").execute();
	await db.schema.alterTable("settings").addColumn("slack_app_token", "text").execute();
	await db.schema.alterTable("settings").addColumn("llm_provider", "text").execute();
	await db.schema.alterTable("settings").addColumn("anthropic_api_key", "text").execute();
	await db.schema.alterTable("settings").addColumn("aws_access_key_id", "text").execute();
	await db.schema.alterTable("settings").addColumn("aws_secret_access_key", "text").execute();
	await db.schema.alterTable("settings").addColumn("aws_region", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Similarly, drop columns one at a time.
	await db.schema.alterTable("settings").dropColumn("slack_bot_token").execute();
	await db.schema.alterTable("settings").dropColumn("slack_app_token").execute();
	await db.schema.alterTable("settings").dropColumn("llm_provider").execute();
	await db.schema.alterTable("settings").dropColumn("anthropic_api_key").execute();
	await db.schema.alterTable("settings").dropColumn("aws_access_key_id").execute();
	await db.schema.alterTable("settings").dropColumn("aws_secret_access_key").execute();
	await db.schema.alterTable("settings").dropColumn("aws_region").execute();
}
