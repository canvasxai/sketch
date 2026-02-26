import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("settings")
		.addColumn("id", "text", (col) => col.primaryKey().defaultTo("default"))
		.addColumn("admin_email", "text")
		.addColumn("admin_password_hash", "text")
		.addColumn("org_name", "text")
		.addColumn("bot_name", "text", (col) => col.defaultTo("Sketch"))
		.addColumn("onboarding_completed_at", "text")
		.addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("settings").execute();
}
