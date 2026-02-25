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
}

export const api = {
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
	},
};
