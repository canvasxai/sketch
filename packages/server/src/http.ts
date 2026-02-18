import { Hono } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "./db/schema.js";

export function createApp(db: Kysely<DB>) {
	const app = new Hono();

	app.get("/health", async (c) => {
		try {
			await db.selectFrom("users").select("id").limit(1).execute();
			return c.json({ status: "ok", db: "ok", uptime: process.uptime() });
		} catch {
			return c.json({ status: "error", db: "error" }, 500);
		}
	});

	return app;
}
