/**
 * Programmatic migration runner using static imports.
 * Static imports instead of FileMigrationProvider so it works with tsdown bundling.
 */
import { Migrator } from "kysely";
import type { Kysely } from "kysely";
import * as m001 from "./migrations/001-initial";
import * as m002 from "./migrations/002-channels";
import * as m003 from "./migrations/003-whatsapp-auth";
import * as m004 from "./migrations/004-settings";
import * as m005 from "./migrations/005-settings-slack-llm";
import * as m006 from "./migrations/006-settings-jwt-secret";
import * as m007 from "./migrations/007-rename-channels-allowed-skills";
import * as m008 from "./migrations/008-users-allowed-skills";
import * as m009 from "./migrations/009-wa-groups";
import type { DB } from "./schema";

export async function runMigrations(db: Kysely<DB>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return {
          "001-initial": m001,
          "002-channels": m002,
          "003-whatsapp-auth": m003,
          "004-settings": m004,
          "005-settings-slack-llm": m005,
          "006-settings-jwt-secret": m006,
          "007-rename-channels-allowed-skills": m007,
          "008-users-allowed-skills": m008,
          "009-wa-groups": m009,
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
