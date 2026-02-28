import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import pino from "pino";
import type { Config } from "./config";
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

/** Minimal config for tests — only fields needed by the component under test. */
export function createTestConfig(overrides: Partial<Config> = {}): Config {
	return {
		DB_TYPE: "sqlite",
		SQLITE_PATH: ":memory:",
		SLACK_CHANNEL_HISTORY_LIMIT: 5,
		SLACK_THREAD_HISTORY_LIMIT: 50,
		MAX_FILE_SIZE_MB: 20,
		DATA_DIR: "./data",
		PORT: 3000,
		LOG_LEVEL: "info",
		...overrides,
	} as Config;
}
