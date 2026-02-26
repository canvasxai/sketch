/**
 * Setup API routes for the onboarding wizard.
 * These routes are always public (no auth required) and are the only
 * API routes available when onboarding is incomplete.
 */
import { Hono } from "hono";
import { z } from "zod";
import { hashPassword } from "../auth/password";
import type { createSettingsRepository } from "../db/repositories/settings";

const createAccountSchema = z.object({
	email: z.email("Invalid email format"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

export function setupRoutes(settings: SettingsRepo) {
	const routes = new Hono();

	routes.get("/status", async (c) => {
		const row = await settings.get();
		const hasAdmin = Boolean(row?.admin_email);
		return c.json({
			completed: hasAdmin,
			currentStep: hasAdmin ? 1 : 0,
		});
	});

	routes.post("/account", async (c) => {
		const existing = await settings.get();
		if (existing?.admin_email) {
			return c.json({ error: { code: "CONFLICT", message: "Admin account already exists" } }, 409);
		}

		const body = await c.req.json().catch(() => ({}));
		const parsed = createAccountSchema.safeParse(body);
		if (!parsed.success) {
			const message = parsed.error.issues.map((i) => i.message).join(", ");
			return c.json({ error: { code: "BAD_REQUEST", message } }, 400);
		}

		const passwordHash = await hashPassword(parsed.data.password);
		await settings.create({ adminEmail: parsed.data.email, adminPasswordHash: passwordHash });

		return c.json({ success: true });
	});

	return routes;
}
