import { Hono } from "hono";
import type { SlackBot } from "../slack/bot";
import type { WhatsAppBot } from "../whatsapp/bot";

interface ChannelDeps {
	whatsapp?: WhatsAppBot;
	getSlack?: () => SlackBot | null;
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
			},
			{
				platform: "whatsapp" as const,
				configured: !!deps.whatsapp,
				connected: deps.whatsapp ? deps.whatsapp.isConnected : null,
			},
		];

		return c.json({ channels });
	});

	return routes;
}
