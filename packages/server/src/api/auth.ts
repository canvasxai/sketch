/**
 * Admin auth routes — DB-backed credentials, JWT session tokens.
 * JWTs are signed with a per-deployment secret stored in the settings table,
 * so sessions survive server restarts. Cookie-based with httpOnly, sameSite=lax.
 */
import { randomBytes } from "node:crypto";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { signJwt, verifyJwt } from "../auth/jwt";
import { verifyPassword } from "../auth/password";
import type { createSettingsRepository } from "../db/repositories/settings";

export const SESSION_COOKIE = "sketch_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

function isSecure(c: Context): boolean {
	return new URL(c.req.url).protocol === "https:";
}

function setSessionCookie(c: Context, token: string, secure: boolean) {
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure,
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_MAX_AGE,
	});
}

export async function createSession(c: Context, email: string, jwtSecret: string): Promise<void> {
	const token = await signJwt(email, jwtSecret);
	setSessionCookie(c, token, isSecure(c));
}

export function authRoutes(settings: SettingsRepo) {
	const routes = new Hono();

	routes.post("/login", async (c) => {
		const row = await settings.get();
		if (!row?.admin_email || !row?.admin_password_hash) {
			return c.json({ error: { code: "SETUP_REQUIRED", message: "Admin account not configured" } }, 503);
		}

		const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
		if (!body.email || !body.password) {
			return c.json({ error: { code: "BAD_REQUEST", message: "Email and password required" } }, 400);
		}

		const emailMatch = body.email.toLowerCase() === row.admin_email.toLowerCase();
		const passwordMatch = emailMatch && (await verifyPassword(body.password, row.admin_password_hash));

		if (!emailMatch || !passwordMatch) {
			return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }, 401);
		}

		// Backfill jwt_secret for accounts created before the JWT migration
		let jwtSecret = row.jwt_secret;
		if (!jwtSecret) {
			jwtSecret = randomBytes(32).toString("hex");
			await settings.update({ jwtSecret });
		}

		await createSession(c, row.admin_email, jwtSecret);
		return c.json({ authenticated: true, email: row.admin_email });
	});

	routes.post("/logout", (c) => {
		deleteCookie(c, SESSION_COOKIE, { path: "/" });
		return c.json({ authenticated: false });
	});

	routes.get("/session", async (c) => {
		const token = getCookie(c, SESSION_COOKIE);
		if (!token) {
			return c.json({ authenticated: false });
		}

		const row = await settings.get();
		if (!row?.jwt_secret) {
			deleteCookie(c, SESSION_COOKIE, { path: "/" });
			return c.json({ authenticated: false });
		}

		const payload = await verifyJwt(token, row.jwt_secret);
		if (!payload) {
			deleteCookie(c, SESSION_COOKIE, { path: "/" });
			return c.json({ authenticated: false });
		}

		// Sliding renewal — issue a fresh JWT to extend the session
		await createSession(c, payload.email, row.jwt_secret);
		return c.json({ authenticated: true, email: payload.email });
	});

	return routes;
}
