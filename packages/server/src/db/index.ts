import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type { Config } from "../config";
import type { DB } from "./schema";

export function createDatabase(config: Config): Kysely<DB> {
	mkdirSync(dirname(config.SQLITE_PATH), { recursive: true });
	const sqlite = new Database(config.SQLITE_PATH);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");

	return new Kysely<DB>({
		dialect: new SqliteDialect({ database: sqlite }),
	});
}
