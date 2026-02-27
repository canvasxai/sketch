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

	http.post("/api/setup/complete", async () => {
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
