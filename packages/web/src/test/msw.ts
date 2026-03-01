import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/**
 * Default MSW handlers — happy-path responses for all API endpoints.
 * Override per-test with server.use(...) for error/edge cases.
 */
export const handlers = [
	http.get("/api/setup/status", () => {
		return HttpResponse.json({
			completed: false,
			currentStep: 0,
			adminEmail: null,
			orgName: null,
			botName: "Sketch",
			slackConnected: false,
			llmConnected: false,
			llmProvider: null,
		});
	}),

	http.post("/api/setup/account", async ({ request }) => {
		const body = (await request.json()) as { email?: string; password?: string };
		if (!body.email || !body.password) {
			return HttpResponse.json(
				{ error: { code: "BAD_REQUEST", message: "Email and password required" } },
				{ status: 400 },
			);
		}
		return HttpResponse.json({ success: true });
	}),

	http.post("/api/setup/slack", async ({ request }) => {
		const body = (await request.json()) as { botToken?: string; appToken?: string };
		if (!body.botToken || !body.appToken) {
			return HttpResponse.json(
				{ error: { code: "BAD_REQUEST", message: "Bot token and app token required" } },
				{ status: 400 },
			);
		}
		return HttpResponse.json({ success: true });
	}),

	http.post("/api/setup/identity", async ({ request }) => {
		const body = (await request.json()) as { orgName?: string; botName?: string };
		if (!body.orgName || !body.botName) {
			return HttpResponse.json(
				{ error: { code: "BAD_REQUEST", message: "Organization and bot name required" } },
				{ status: 400 },
			);
		}
		return HttpResponse.json({ success: true });
	}),

	http.post("/api/setup/llm", async ({ request }) => {
		const body = (await request.json()) as
			| { provider: "anthropic"; apiKey?: string }
			| { provider: "bedrock"; awsAccessKeyId?: string; awsSecretAccessKey?: string; awsRegion?: string };

		if (body.provider === "anthropic") {
			if (!body.apiKey) {
				return HttpResponse.json({ error: { code: "BAD_REQUEST", message: "API key required" } }, { status: 400 });
			}
			return HttpResponse.json({ success: true });
		}

		if (!body.awsAccessKeyId || !body.awsSecretAccessKey || !body.awsRegion) {
			return HttpResponse.json(
				{ error: { code: "BAD_REQUEST", message: "AWS credentials required" } },
				{ status: 400 },
			);
		}
		return HttpResponse.json({ success: true });
	}),

	http.post("/api/setup/slack/verify", async ({ request }) => {
		const body = (await request.json()) as { botToken?: string; appToken?: string };
		if (!body.botToken || !body.appToken) {
			return HttpResponse.json(
				{ error: { code: "BAD_REQUEST", message: "Bot token and app token required" } },
				{ status: 400 },
			);
		}
		return HttpResponse.json({ success: true, workspaceName: "Test Workspace" });
	}),

	http.post("/api/setup/complete", async () => {
		return HttpResponse.json({ success: true });
	}),

	http.delete("/api/channels/slack", () => {
		return HttpResponse.json({ success: true });
	}),

	http.get("/api/channels/status", () => {
		return HttpResponse.json({
			channels: [
				{ platform: "slack", configured: false, connected: null, phoneNumber: null },
				{ platform: "whatsapp", configured: false, connected: null, phoneNumber: null },
			],
		});
	}),

	http.get("/api/users", () => {
		return HttpResponse.json({
			users: [
				{
					id: "u1",
					name: "Alice Smith",
					email: null,
					slack_user_id: "U001",
					whatsapp_number: null,
					created_at: "2026-01-01T00:00:00Z",
				},
				{
					id: "u2",
					name: "Bob Jones",
					email: null,
					slack_user_id: null,
					whatsapp_number: "+919876543210",
					created_at: "2026-01-02T00:00:00Z",
				},
			],
		});
	}),

	http.post("/api/users", async ({ request }) => {
		const body = (await request.json()) as { name?: string; whatsappNumber?: string };
		if (!body.name || !body.whatsappNumber) {
			return HttpResponse.json(
				{ error: { code: "VALIDATION_ERROR", message: "Name and WhatsApp number required" } },
				{ status: 400 },
			);
		}
		return HttpResponse.json(
			{
				user: {
					id: "u-new",
					name: body.name,
					email: null,
					slack_user_id: null,
					whatsapp_number: body.whatsappNumber,
					created_at: new Date().toISOString(),
				},
			},
			{ status: 201 },
		);
	}),

	http.patch("/api/users/:id", async ({ request }) => {
		const body = (await request.json()) as { name?: string; whatsappNumber?: string | null };
		return HttpResponse.json({
			user: {
				id: "u1",
				name: body.name ?? "Alice Smith",
				email: null,
				slack_user_id: "U001",
				whatsapp_number: body.whatsappNumber ?? null,
				created_at: "2026-01-01T00:00:00Z",
			},
		});
	}),

	http.delete("/api/users/:id", () => {
		return HttpResponse.json({ success: true });
	}),

	http.get("/api/auth/session", () => {
		return HttpResponse.json({ authenticated: false });
	}),

	http.post("/api/auth/login", async ({ request }) => {
		const body = (await request.json()) as { email?: string; password?: string };
		if (!body.email || !body.password) {
			return HttpResponse.json(
				{ error: { code: "BAD_REQUEST", message: "Email and password required" } },
				{ status: 400 },
			);
		}
		return HttpResponse.json({ authenticated: true, email: body.email });
	}),
];

export const server = setupServer(...handlers);
