import { afterEach, describe, expect, it, vi } from "vitest";
import { slackApiCall } from "./api";

declare const global: typeof globalThis & { fetch: typeof fetch };

describe("slackApiCall", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns parsed body when Slack auth.test succeeds", async () => {
		const token = "xoxb-valid";
		const responseBody = { ok: true, team: "Test Workspace" };

		const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify(responseBody), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}) as Response,
		);

		const result = await slackApiCall(token, "auth.test");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://slack.com/api/auth.test");
		expect(options.method).toBe("POST");
		expect(options.headers).toMatchObject({
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/x-www-form-urlencoded",
		});
		expect(result).toEqual(responseBody);
	});

	it("throws when Slack responds with ok: false", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ ok: false, error: "invalid_auth" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}) as Response,
		);

		await expect(slackApiCall("xoxb-invalid", "auth.test")).rejects.toThrowError("invalid_auth");
	});

	it("throws with default error when response is not ok and has no error message", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(
			new Response("unavailable", {
				status: 500,
				headers: { "Content-Type": "text/plain" },
			}) as Response,
		);

		await expect(slackApiCall("xoxb-unavailable", "auth.test")).rejects.toThrowError("invalid_auth");
	});
});
