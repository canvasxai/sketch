import { Hono } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "./db/schema";
import type { WhatsAppBot } from "./whatsapp/bot";

export function createApp(db: Kysely<DB>, deps?: { whatsapp?: WhatsAppBot }) {
	const app = new Hono();

	app.get("/health", async (c) => {
		try {
			await db.selectFrom("users").select("id").limit(1).execute();
			return c.json({ status: "ok", db: "ok", uptime: process.uptime() });
		} catch {
			return c.json({ status: "error", db: "error" }, 500);
		}
	});

	if (deps?.whatsapp) {
		const whatsapp = deps.whatsapp;
		let pairingInProgress = false;

		app.get("/whatsapp/pair", async (c) => {
			if (whatsapp.isConnected) {
				return c.json({ status: "already_connected" });
			}
			if (pairingInProgress) {
				return c.json({ status: "pairing_in_progress", message: "A pairing attempt is already active" }, 409);
			}
			pairingInProgress = true;

			return new Promise<Response>((resolve) => {
				let responded = false;
				const timeout = setTimeout(() => {
					if (!responded) {
						responded = true;
						pairingInProgress = false;
						resolve(c.json({ status: "timeout", message: "No QR generated within 30s" }, 408));
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

		app.get("/whatsapp/status", (c) => {
			return c.json({ connected: whatsapp.isConnected });
		});
	}

	return app;
}
