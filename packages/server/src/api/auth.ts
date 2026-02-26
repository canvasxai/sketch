/**
 * Admin auth routes — DB-backed credentials, in-memory session store.
 * Sessions are lost on server restart; admin simply re-logs in.
 * Cookie-based with httpOnly, sameSite=lax, 7-day sliding expiry.
 */
import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { verifyPassword } from "../auth/password";
import type { createSettingsRepository } from "../db/repositories/settings";

const SESSION_COOKIE = "sketch_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Session {
	email: string;
	expiresAt: number;
}

const sessions = new Map<string, Session>();

function isSecure(c: { req: { url: string } }): boolean {
	return new URL(c.req.url).protocol === "https:";
}

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string, secure: boolean) {
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure,
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_TTL_MS / 1000,
	});
}

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

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

		const token = randomBytes(32).toString("hex");
		sessions.set(token, { email: row.admin_email, expiresAt: Date.now() + SESSION_TTL_MS });

		setSessionCookie(c, token, isSecure(c));
		return c.json({ authenticated: true, email: row.admin_email });
	});

	routes.post("/logout", (c) => {
		const token = getCookie(c, SESSION_COOKIE);
		if (token) {
			sessions.delete(token);
		}
		deleteCookie(c, SESSION_COOKIE, { path: "/" });
		return c.json({ authenticated: false });
	});

	routes.get("/session", (c) => {
		const token = getCookie(c, SESSION_COOKIE);
		if (!token) {
			return c.json({ authenticated: false });
		}

		const session = sessions.get(token);
		if (!session || session.expiresAt < Date.now()) {
			if (session) sessions.delete(token);
			deleteCookie(c, SESSION_COOKIE, { path: "/" });
			return c.json({ authenticated: false });
		}

		// Sliding renewal
		session.expiresAt = Date.now() + SESSION_TTL_MS;
		setSessionCookie(c, token, isSecure(c));

		return c.json({ authenticated: true, email: session.email });
	});

	return routes;
}

export function validateSession(token: string): Session | null {
	const session = sessions.get(token);
	if (!session || session.expiresAt < Date.now()) {
		if (session) sessions.delete(token);
		return null;
	}
	return session;
}

/** Exported for testing — clears all sessions. */
export function clearSessions() {
	sessions.clear();
}
