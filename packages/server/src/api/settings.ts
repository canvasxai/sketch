import { Hono } from "hono";
import type { createSettingsRepository } from "../db/repositories/settings";

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

export function settingsRoutes(settings: SettingsRepo) {
	const routes = new Hono();

	routes.get("/identity", async (c) => {
		const row = await settings.get();

		return c.json({
			orgName: row?.org_name ?? null,
			botName: row?.bot_name ?? "Sketch",
		});
	});

	return routes;
}
