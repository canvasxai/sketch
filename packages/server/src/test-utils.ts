import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import pino from "pino";
import { runMigrations } from "./db/migrate";
import type { DB } from "./db/schema";

/**
 * Creates an in-memory SQLite database with all migrations applied.
 * Each call returns a fresh, isolated database.
 */
export async function createTestDb(): Promise<Kysely<DB>> {
	const db = new Kysely<DB>({
		dialect: new SqliteDialect({
			database: new Database(":memory:"),
		}),
	});
	await runMigrations(db);
	return db;
}

/** Silent logger for tests — no output noise. */
export function createTestLogger() {
	return pino({ level: "silent" });
}
