import { Hono } from "hono";
import type { WhatsAppBot } from "../whatsapp/bot";

export function whatsappRoutes(whatsapp: WhatsAppBot) {
	const routes = new Hono();
	let pairingInProgress = false;

	routes.get("/pair", async (c) => {
		if (whatsapp.isConnected) {
			return c.json({ status: "already_connected" });
		}
		if (pairingInProgress) {
			return c.json({ error: { code: "CONFLICT", message: "A pairing attempt is already active" } }, 409);
		}
		pairingInProgress = true;

		return new Promise<Response>((resolve) => {
			let responded = false;
			const timeout = setTimeout(() => {
				if (!responded) {
					responded = true;
					pairingInProgress = false;
					resolve(c.json({ error: { code: "TIMEOUT", message: "No QR generated within 30s" } }, 408));
				}
			}, 30000);

			whatsapp
				.startPairing((qr) => {
					if (!responded) {
						responded = true;
						clearTimeout(timeout);
						pairingInProgress = false;
						resolve(c.json({ status: "pairing", qr }));
					}
				})
				.catch(() => {
					pairingInProgress = false;
				});
		});
	});

	routes.get("/status", (c) => {
		return c.json({ connected: whatsapp.isConnected });
	});

	return routes;
}
