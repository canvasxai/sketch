import { Hono } from "hono";
import type { SlackBot } from "../slack/bot";
import type { WhatsAppBot } from "../whatsapp/bot";

interface ChannelDeps {
	whatsapp?: WhatsAppBot;
	getSlack?: () => SlackBot | null;
	onSlackDisconnect?: () => Promise<void>;
}

export function channelRoutes(deps: ChannelDeps) {
	const routes = new Hono();

	routes.get("/status", (c) => {
		const slackBot = deps.getSlack?.() ?? null;
		const slackConfigured = !!slackBot;

		const channels = [
			{
				platform: "slack" as const,
				configured: slackConfigured,
				connected: slackConfigured ? true : null,
				phoneNumber: null,
			},
			{
				platform: "whatsapp" as const,
				configured: deps.whatsapp?.isConnected ?? false,
				connected: deps.whatsapp?.isConnected ? true : null,
				phoneNumber: deps.whatsapp?.phoneNumber ?? null,
			},
		];

		return c.json({ channels });
	});

	routes.delete("/slack", async (c) => {
		const slackBot = deps.getSlack?.() ?? null;
		if (!slackBot) {
			return c.json({ error: { code: "NOT_CONFIGURED", message: "Slack is not configured" } }, 400);
		}
		await deps.onSlackDisconnect?.();
		return c.json({ success: true });
	});

	return routes;
}
