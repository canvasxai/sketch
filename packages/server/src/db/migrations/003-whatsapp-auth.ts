import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("whatsapp_creds")
		.addColumn("id", "text", (col) => col.primaryKey().defaultTo("default"))
		.addColumn("creds", "text", (col) => col.notNull())
		.addColumn("updated_at", "timestamp", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	await db.schema
		.createTable("whatsapp_keys")
		.addColumn("type", "text", (col) => col.notNull())
		.addColumn("key_id", "text", (col) => col.notNull())
		.addColumn("value", "text", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("whatsapp_keys_type_key_id")
		.on("whatsapp_keys")
		.columns(["type", "key_id"])
		.unique()
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("whatsapp_keys").execute();
	await db.schema.dropTable("whatsapp_creds").execute();
}
