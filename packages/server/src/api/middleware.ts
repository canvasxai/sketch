/**
 * API middleware — setup mode detection and auth enforcement.
 *
 * Setup mode: when onboarding is incomplete (no admin account), only setup
 * routes and health are accessible. All other API routes return 503.
 *
 * Auth: when an admin account exists, all non-public API routes require
 * a valid session cookie.
 */
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { createSettingsRepository } from "../db/repositories/settings";
import { validateSession } from "./auth";

const PUBLIC_PATHS = new Set(["/api/auth/login", "/api/auth/session", "/api/health"]);
const SETUP_PATHS_PREFIX = "/api/setup";

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

export function createAuthMiddleware(settings: SettingsRepo) {
	return async (c: Context, next: Next) => {
		// Setup routes are always accessible
		if (c.req.path.startsWith(SETUP_PATHS_PREFIX)) {
			return next();
		}

		let setupComplete = false;
		try {
			const row = await settings.get();
			setupComplete = Boolean(row?.onboarding_completed_at);
		} catch {
			// DB unavailable — let public paths through, block everything else
		}

		// Setup mode — block everything except setup, health, and public paths
		if (!setupComplete) {
			if (PUBLIC_PATHS.has(c.req.path)) {
				return next();
			}
			return c.json({ error: { code: "SETUP_REQUIRED", message: "Onboarding not complete" } }, 503);
		}

		// Normal auth — public paths pass through
		if (PUBLIC_PATHS.has(c.req.path)) {
			return next();
		}

		const token = getCookie(c, "sketch_session");
		if (!token) {
			return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
		}

		const session = validateSession(token);
		if (!session) {
			return c.json({ error: { code: "UNAUTHORIZED", message: "Session expired" } }, 401);
		}

		return next();
	};
}
