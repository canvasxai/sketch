export interface SlackAuthTestResponse {
	ok?: boolean;
	error?: string;
	team?: string;
}

export async function slackApiCall(
	token: string,
	endpoint: "auth.test" | "apps.connections.open",
): Promise<SlackAuthTestResponse> {
	const response = await fetch(`https://slack.com/api/${endpoint}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
	});

	const body = (await response.json().catch(() => ({}))) as SlackAuthTestResponse;

	if (!response.ok || !body.ok) {
		throw new Error(body.error ?? "invalid_auth");
	}

	return body;
}
