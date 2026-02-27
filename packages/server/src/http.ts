/**
 * HTTP app factory — API routes, auth middleware, static file serving.
 * Route registration order: API routes → static assets → SPA catch-all.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Kysely } from "kysely";
import { authRoutes } from "./api/auth";
import { channelRoutes } from "./api/channels";
import { healthRoutes } from "./api/health";
import { createAuthMiddleware } from "./api/middleware";
import { settingsRoutes } from "./api/settings";
import { setupRoutes } from "./api/setup";
import { whatsappRoutes } from "./api/whatsapp";
import type { Config } from "./config";
import { createSettingsRepository } from "./db/repositories/settings";
import type { DB } from "./db/schema";
import type { SlackBot } from "./slack/bot";
import type { WhatsAppBot } from "./whatsapp/bot";

interface AppDeps {
	whatsapp?: WhatsAppBot;
	getSlack?: () => SlackBot | null;
	onSlackTokensUpdated?: (tokens?: { botToken: string; appToken: string }) => Promise<void>;
	onLlmSettingsUpdated?: () => Promise<void>;
}

export function createApp(db: Kysely<DB>, _config: Config, deps?: AppDeps) {
	const app = new Hono();
	const settings = createSettingsRepository(db);

	// Auth middleware on all /api/* routes (with setup mode + auth checks)
	app.use("/api/*", createAuthMiddleware(settings));

	// API routes
	app.route("/api/health", healthRoutes(db));
	app.route("/api/auth", authRoutes(settings));
	app.route(
		"/api/setup",
		setupRoutes(settings, {
			onSlackTokensUpdated: deps?.onSlackTokensUpdated,
			onLlmSettingsUpdated: deps?.onLlmSettingsUpdated,
		}),
	);
	app.route("/api/settings", settingsRoutes(settings));
	app.route("/api/channels", channelRoutes({ whatsapp: deps?.whatsapp, getSlack: deps?.getSlack }));

	if (deps?.whatsapp) {
		app.route("/api/whatsapp", whatsappRoutes(deps.whatsapp));
	}

	// Static file serving for the SPA (production only — dev uses Vite dev server)
	// Resolve path relative to this file's location (works with both tsx and tsdown bundle)
	const webDistDir = resolve(import.meta.dirname, "../../web/dist");

	if (existsSync(webDistDir)) {
		// Serve hashed assets (JS, CSS, images)
		app.use("/assets/*", serveStatic({ root: webDistDir }));

		// SPA catch-all: any non-API route returns index.html for client-side routing
		const indexHtml = readFileSync(join(webDistDir, "index.html"), "utf-8");
		app.get("*", (c) => {
			if (c.req.path.startsWith("/api/")) {
				return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
			}
			return c.html(indexHtml);
		});
	}

	return app;
}
