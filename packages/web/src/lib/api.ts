/**
 * Typed API client for the control plane backend.
 * All methods throw on non-2xx responses with the standard error shape.
 */

interface ApiError {
	error: { code: string; message: string };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});

	if (!res.ok) {
		const body = (await res.json().catch(() => ({ error: { code: "UNKNOWN", message: res.statusText } }))) as ApiError;
		throw new Error(body.error.message);
	}

	return res.json() as Promise<T>;
}

export interface ChannelStatus {
	platform: "slack" | "whatsapp";
	configured: boolean;
	connected: boolean | null;
	phoneNumber: string | null;
}

export interface SetupStatus {
	completed: boolean;
	currentStep: number;
	adminEmail: string | null;
	orgName: string | null;
	botName: string;
	slackConnected: boolean;
	llmConnected: boolean;
	llmProvider: "anthropic" | "bedrock" | null;
}

export const api = {
	setup: {
		status() {
			return request<SetupStatus>("/api/setup/status");
		},
		verifySlack(botToken: string, appToken: string) {
			return request<{ success: boolean; workspaceName?: string }>("/api/setup/slack/verify", {
				method: "POST",
				body: JSON.stringify({ botToken, appToken }),
			});
		},
		verifyLlm(
			data:
				| { provider: "anthropic"; apiKey: string }
				| { provider: "bedrock"; awsAccessKeyId: string; awsSecretAccessKey: string; awsRegion: string },
		) {
			return request<{ success: boolean }>("/api/setup/llm/verify", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		createAccount(email: string, password: string) {
			return request<{ success: boolean }>("/api/setup/account", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			});
		},
		identity(orgName: string, botName: string) {
			return request<{ success: boolean }>("/api/setup/identity", {
				method: "POST",
				body: JSON.stringify({ orgName, botName }),
			});
		},
		slack(botToken: string, appToken: string) {
			return request<{ success: boolean }>("/api/setup/slack", {
				method: "POST",
				body: JSON.stringify({ botToken, appToken }),
			});
		},
		llm(
			data:
				| { provider: "anthropic"; apiKey: string }
				| { provider: "bedrock"; awsAccessKeyId: string; awsSecretAccessKey: string; awsRegion: string },
		) {
			return request<{ success: boolean }>("/api/setup/llm", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		complete() {
			return request<{ success: boolean }>("/api/setup/complete", {
				method: "POST",
			});
		},
	},
	auth: {
		login(email: string, password: string) {
			return request<{ authenticated: boolean; email: string }>("/api/auth/login", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			});
		},
		logout() {
			return request<{ authenticated: boolean }>("/api/auth/logout", { method: "POST" });
		},
		session() {
			return request<{ authenticated: boolean; email?: string }>("/api/auth/session");
		},
	},
	channels: {
		status() {
			return request<{ channels: ChannelStatus[] }>("/api/channels/status");
		},
		disconnectSlack() {
			return request<{ success: boolean }>("/api/channels/slack", { method: "DELETE" });
		},
	},
	whatsapp: {
		status() {
			return request<{ connected: boolean; phoneNumber: string | null }>("/api/channels/whatsapp");
		},
		cancelPairing() {
			return request<{ success: boolean }>("/api/channels/whatsapp/pair", { method: "DELETE" });
		},
		disconnect() {
			return request<{ success: boolean }>("/api/channels/whatsapp", { method: "DELETE" });
		},
	},
	settings: {
		identity() {
			return request<{ orgName: string | null; botName: string }>("/api/settings/identity");
		},
	},
};
