/**
 * Programmatic migration runner using static imports.
 * Static imports instead of FileMigrationProvider so it works with tsdown bundling.
 */
import { Migrator } from "kysely";
import type { Kysely } from "kysely";
import * as m001 from "./migrations/001-initial";
import type { DB } from "./schema";

export async function runMigrations(db: Kysely<DB>): Promise<void> {
	const migrator = new Migrator({
		db,
		provider: {
			async getMigrations() {
				return {
					"001-initial": m001,
				};
			},
		},
	});

	const { error, results } = await migrator.migrateToLatest();

	for (const result of results ?? []) {
		if (result.status === "Success") {
			console.log(`Migration applied: ${result.migrationName}`);
		} else if (result.status === "Error") {
			console.error(`Migration failed: ${result.migrationName}`);
		}
	}

	if (error) {
		console.error("Migration run failed:", error);
		process.exit(1);
	}
}
