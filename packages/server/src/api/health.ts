import { Hono } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../db/schema";

export function healthRoutes(db: Kysely<DB>) {
	const routes = new Hono();

	routes.get("/", async (c) => {
		try {
			await db.selectFrom("users").select("id").limit(1).execute();
			return c.json({ status: "ok", db: "ok", uptime: process.uptime() });
		} catch {
			return c.json({ status: "error", db: "error" }, 500);
		}
	});

	return routes;
}
