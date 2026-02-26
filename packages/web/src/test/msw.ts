import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/**
 * Default MSW handlers — happy-path responses for all API endpoints.
 * Override per-test with server.use(...) for error/edge cases.
 */
export const handlers = [
	http.get("/api/setup/status", () => {
		return HttpResponse.json({ completed: false, currentStep: 0 });
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

	http.get("/api/auth/session", () => {
		return HttpResponse.json({ authenticated: false });
	}),
];

export const server = setupServer(...handlers);
