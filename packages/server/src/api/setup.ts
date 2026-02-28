/**
 * Setup API routes for the onboarding wizard.
 * Only status/account are public; subsequent setup steps require auth.
 */
import { Hono } from "hono";
import { z } from "zod";
import { hashPassword } from "../auth/password";
import type { createSettingsRepository } from "../db/repositories/settings";
import { slackApiCall } from "../slack/api";
import { createSession } from "./auth";

async function verifySlackTokens(botToken: string, appToken: string): Promise<{ workspaceName?: string }> {
	const auth = await slackApiCall(botToken, "auth.test");
	await slackApiCall(appToken, "apps.connections.open");
	return { workspaceName: auth.team };
}

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

async function verifyAnthropicApiKey(apiKey: string): Promise<void> {
	const response = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1,
			messages: [{ role: "user", content: "Ping" }],
		}),
	});

	if (response.status === 401 || response.status === 403) {
		throw new Error("invalid_auth");
	}

	if (!response.ok) {
		throw new Error("verification_failed");
	}
}

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
		const hasIdentity = Boolean(row?.org_name?.trim() && row?.bot_name?.trim());
		const hasSlack = Boolean(row?.slack_bot_token?.trim() && row?.slack_app_token?.trim());
		const hasAnthropic = row?.llm_provider === "anthropic" && Boolean(row?.anthropic_api_key?.trim());
		const hasBedrock =
			row?.llm_provider === "bedrock" &&
			Boolean(row?.aws_access_key_id?.trim() && row?.aws_secret_access_key?.trim() && row?.aws_region?.trim());
		const hasLlm = Boolean(hasAnthropic || hasBedrock);
		const isCompleted = Boolean(row?.onboarding_completed_at);
		const currentStep = isCompleted ? 5 : hasLlm ? 5 : hasSlack ? 4 : hasIdentity ? 3 : hasAdmin ? 2 : 0;
		return c.json({
			completed: isCompleted,
			currentStep,
			adminEmail: row?.admin_email ?? null,
			orgName: row?.org_name ?? null,
			botName: row?.bot_name ?? "Sketch",
			slackConnected: hasSlack,
			llmConnected: hasLlm,
			llmProvider: row?.llm_provider === "bedrock" ? "bedrock" : row?.llm_provider === "anthropic" ? "anthropic" : null,
		});
	});

	routes.post("/slack/verify", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const parsed = slackSchema.safeParse(body);
		if (!parsed.success) {
			const message = parsed.error.issues.map((i) => i.message).join(", ");
			return c.json({ error: { code: "BAD_REQUEST", message } }, 400);
		}

		try {
			const { workspaceName } = await verifySlackTokens(parsed.data.botToken.trim(), parsed.data.appToken.trim());
			return c.json({ success: true, workspaceName });
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
	});

	routes.post("/account", async (c) => {
		const existing = await settings.get();
		if (existing?.onboarding_completed_at) {
			return c.json({ error: { code: "ONBOARDING_COMPLETE", message: "Setup is already complete" } }, 409);
		}

		const body = await c.req.json().catch(() => ({}));
		const parsed = createAccountSchema.safeParse(body);
		if (!parsed.success) {
			const message = parsed.error.issues.map((i) => i.message).join(", ");
			return c.json({ error: { code: "BAD_REQUEST", message } }, 400);
		}

		const passwordHash = await hashPassword(parsed.data.password);
		if (!existing?.admin_email) {
			await settings.create({ adminEmail: parsed.data.email, adminPasswordHash: passwordHash });
		} else {
			await settings.update({
				adminEmail: parsed.data.email,
				adminPasswordHash: passwordHash,
			});
		}

		createSession(c, parsed.data.email);
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

	routes.post("/llm/verify", async (c) => {
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
			try {
				await verifyAnthropicApiKey(parsed.data.apiKey.trim());
			} catch {
				return c.json(
					{
						error: {
							code: "INVALID_LLM_SETTINGS",
							message: "Invalid LLM credentials. Check your API key and try again.",
						},
					},
					400,
				);
			}
		}

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
