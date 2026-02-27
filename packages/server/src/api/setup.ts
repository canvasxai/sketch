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

const identitySchema = z.object({
	orgName: z.string().min(1, "Organization name is required").max(200, "Organization name is too long"),
	botName: z.string().min(1, "Bot name is required").max(100, "Bot name is too long"),
});

const slackSchema = z.object({
	botToken: z
		.string()
		.min(1, "Bot token is required")
		.refine((value) => value.startsWith("xoxb-"), {
			message: "Bot token must start with xoxb-",
		}),
	appToken: z
		.string()
		.min(1, "App-level token is required")
		.refine((value) => value.startsWith("xapp-"), {
			message: "App-level token must start with xapp-",
		}),
});

const llmSchema = z.discriminatedUnion("provider", [
	z.object({
		provider: z.literal("anthropic"),
		apiKey: z
			.string()
			.min(1, "API key is required")
			.refine((value) => value.startsWith("sk-ant-"), {
				message: "API key must start with sk-ant-",
			}),
	}),
	z.object({
		provider: z.literal("bedrock"),
		awsAccessKeyId: z.string().min(1, "AWS Access Key ID is required"),
		awsSecretAccessKey: z.string().min(1, "AWS Secret Access Key is required"),
		awsRegion: z.string().min(1, "AWS Region is required"),
	}),
]);

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

interface SetupDeps {
	onSlackTokensUpdated?: (tokens?: { botToken: string; appToken: string }) => Promise<void>;
	onLlmSettingsUpdated?: () => Promise<void>;
}

export function setupRoutes(settings: SettingsRepo, deps: SetupDeps = {}) {
	const routes = new Hono();

	routes.get("/status", async (c) => {
		const row = await settings.get();
		const hasAdmin = Boolean(row?.admin_email);
		const isCompleted = Boolean(row?.onboarding_completed_at);
		return c.json({
			completed: isCompleted,
			currentStep: isCompleted ? 7 : hasAdmin ? 1 : 0,
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

	routes.post("/identity", async (c) => {
		const existing = await settings.get();
		if (!existing?.admin_email) {
			return c.json(
				{ error: { code: "SETUP_INCOMPLETE", message: "Admin account must be created before setting identity" } },
				409,
			);
		}

		const body = await c.req.json().catch(() => ({}));
		const parsed = identitySchema.safeParse(body);
		if (!parsed.success) {
			const message = parsed.error.issues.map((i) => i.message).join(", ");
			return c.json({ error: { code: "BAD_REQUEST", message } }, 400);
		}

		await settings.update({
			orgName: parsed.data.orgName.trim(),
			botName: parsed.data.botName.trim(),
		});

		return c.json({ success: true });
	});

	routes.post("/slack", async (c) => {
		const existing = await settings.get();
		if (!existing?.admin_email) {
			return c.json(
				{ error: { code: "SETUP_INCOMPLETE", message: "Admin account must be created before configuring Slack" } },
				409,
			);
		}

		const body = await c.req.json().catch(() => ({}));
		const parsed = slackSchema.safeParse(body);
		if (!parsed.success) {
			const message = parsed.error.issues.map((i) => i.message).join(", ");
			return c.json({ error: { code: "BAD_REQUEST", message } }, 400);
		}

		const botToken = parsed.data.botToken.trim();
		const appToken = parsed.data.appToken.trim();
		if (deps.onSlackTokensUpdated) {
			try {
				await deps.onSlackTokensUpdated({ botToken, appToken });
			} catch {
				return c.json(
					{
						error: {
							code: "INVALID_SLACK_TOKENS",
							message: "Invalid Slack tokens. Check Bot Token and App-Level Token, then try again.",
						},
					},
					400,
				);
			}
		}
		await settings.update({
			slackBotToken: botToken,
			slackAppToken: appToken,
		});

		return c.json({ success: true });
	});

	routes.post("/llm", async (c) => {
		const existing = await settings.get();
		if (!existing?.admin_email) {
			return c.json(
				{ error: { code: "SETUP_INCOMPLETE", message: "Admin account must be created before configuring LLM" } },
				409,
			);
		}

		const body = await c.req.json().catch(() => ({}));
		const parsed = llmSchema.safeParse(body);
		if (!parsed.success) {
			const message = parsed.error.issues.map((i) => i.message).join(", ");
			return c.json({ error: { code: "BAD_REQUEST", message } }, 400);
		}

		if (parsed.data.provider === "anthropic") {
			await settings.update({
				llmProvider: "anthropic",
				anthropicApiKey: parsed.data.apiKey.trim(),
				awsAccessKeyId: null,
				awsSecretAccessKey: null,
				awsRegion: null,
			});
		} else {
			await settings.update({
				llmProvider: "bedrock",
				anthropicApiKey: null,
				awsAccessKeyId: parsed.data.awsAccessKeyId.trim(),
				awsSecretAccessKey: parsed.data.awsSecretAccessKey.trim(),
				awsRegion: parsed.data.awsRegion.trim(),
			});
		}

		if (deps.onLlmSettingsUpdated) {
			await deps.onLlmSettingsUpdated();
		}

		return c.json({ success: true });
	});

	routes.post("/complete", async (c) => {
		const existing = await settings.get();
		if (!existing?.admin_email) {
			return c.json(
				{ error: { code: "SETUP_INCOMPLETE", message: "Admin account must be created before completing setup" } },
				409,
			);
		}

		await settings.update({
			onboardingCompletedAt: new Date().toISOString(),
		});

		return c.json({ success: true });
	});

	return routes;
}
