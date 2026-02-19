import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("channels")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("slack_channel_id", "text", (col) => col.unique().notNull())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("type", "text", (col) => col.notNull())
		.addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("channels").execute();
}
