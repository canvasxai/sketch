/**
 * Auth middleware for API routes.
 * Exempts: /api/auth/login, /api/auth/session, /api/health
 * When admin auth is not configured (no ADMIN_EMAIL/ADMIN_PASSWORD), all routes pass through.
 */
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Config } from "../config";
import { validateSession } from "./auth";

const PUBLIC_PATHS = new Set(["/api/auth/login", "/api/auth/session", "/api/health"]);

export function createAuthMiddleware(config: Config) {
	return async (c: Context, next: Next) => {
		// No auth enforcement when admin credentials aren't configured
		if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
			return next();
		}

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
