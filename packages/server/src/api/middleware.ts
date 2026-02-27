/**
 * API middleware — setup mode detection and auth enforcement.
 *
 * Setup mode:
 * - Before an admin account exists, only setup status/account + public paths
 *   are accessible. All other API routes return 503.
 * - After an admin exists but onboarding is incomplete, only /api/setup/*
 *   routes are accessible, and non-public setup routes require auth.
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
const PUBLIC_SETUP_PATHS = new Set(["/api/setup/status", "/api/setup/account"]);

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

export function createAuthMiddleware(settings: SettingsRepo) {
	return async (c: Context, next: Next) => {
		const path = c.req.path;
		const isSetupPath = path.startsWith(SETUP_PATHS_PREFIX);
		const isPublicPath = PUBLIC_PATHS.has(path);
		const isPublicSetupPath = PUBLIC_SETUP_PATHS.has(path);

		// Setup bootstrap paths are always accessible.
		if (isPublicSetupPath) {
			return next();
		}

		let setupComplete = false;
		let hasAdmin = false;
		try {
			const row = await settings.get();
			setupComplete = Boolean(row?.onboarding_completed_at);
			hasAdmin = Boolean(row?.admin_email);
		} catch {
			// DB unavailable — let public paths through, block everything else
		}

		// Setup bootstrap mode (no admin yet): only public paths + setup bootstrap.
		if (!setupComplete && !hasAdmin) {
			if (isPublicPath) {
				return next();
			}
			return c.json({ error: { code: "SETUP_REQUIRED", message: "Onboarding not complete" } }, 503);
		}

		// During onboarding after admin exists, block non-setup API routes.
		if (!setupComplete && !isSetupPath) {
			if (isPublicPath) {
				return next();
			}
			return c.json({ error: { code: "SETUP_REQUIRED", message: "Onboarding not complete" } }, 503);
		}

		// Public paths pass through.
		if (isPublicPath) {
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
