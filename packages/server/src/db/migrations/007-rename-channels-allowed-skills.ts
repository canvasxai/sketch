import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("channels").renameTo("slack_channels").execute();
  await db.schema.alterTable("slack_channels").addColumn("allowed_skills", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("slack_channels").dropColumn("allowed_skills").execute();
  await db.schema.alterTable("slack_channels").renameTo("channels").execute();
}
