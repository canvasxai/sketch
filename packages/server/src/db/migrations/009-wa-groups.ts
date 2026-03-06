import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("wa_groups")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("group_jid", "text", (col) => col.unique().notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("allowed_skills", "text")
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("wa_groups").execute();
}
