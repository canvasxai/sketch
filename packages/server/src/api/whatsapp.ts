/**
 * WhatsApp API routes — SSE-based QR pairing, connection status, disconnect.
 *
 * GET    /           — connection status + phone number
 * GET    /pair       — SSE stream for QR pairing (events: qr, connected, error)
 * DELETE /pair       — cancel an in-progress pairing session
 * DELETE /           — disconnect and clear credentials
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { WhatsAppBot } from "../whatsapp/bot";

export function whatsappRoutes(whatsapp: WhatsAppBot) {
	const routes = new Hono();
	let pairingInProgress = false;
	let pairingSettled: Promise<void> | null = null;

	routes.get("/", (c) => {
		return c.json({
			connected: whatsapp.isConnected,
			phoneNumber: whatsapp.phoneNumber,
		});
	});

	routes.get("/pair", async (c) => {
		if (whatsapp.isConnected) {
			return c.json({ error: { code: "ALREADY_CONNECTED", message: "WhatsApp is already connected" } }, 400);
		}
		if (pairingInProgress) {
			return c.json({ error: { code: "PAIRING_IN_PROGRESS", message: "A pairing attempt is already active" } }, 409);
		}
		pairingInProgress = true;

		return streamSSE(c, async (stream) => {
			try {
				pairingSettled = whatsapp.startPairing({
					onQr: async (qr) => {
						await stream.writeSSE({ event: "qr", data: JSON.stringify({ qr }) });
					},
					onConnected: async (phoneNumber) => {
						await stream.writeSSE({ event: "connected", data: JSON.stringify({ phoneNumber }) });
					},
					onError: async (message) => {
						await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) });
					},
				});
				await pairingSettled;
			} finally {
				pairingInProgress = false;
				pairingSettled = null;
			}
		});
	});

	routes.delete("/pair", async (c) => {
		if (!pairingInProgress) {
			return c.json({ error: { code: "NO_PAIRING", message: "No pairing in progress" } }, 400);
		}
		whatsapp.cancelPairing();
		if (pairingSettled) await pairingSettled;
		return c.json({ success: true });
	});

	routes.delete("/", async (c) => {
		if (!whatsapp.isConfigured) {
			return c.json({ error: { code: "NOT_CONFIGURED", message: "WhatsApp is not configured" } }, 400);
		}
		await whatsapp.disconnect();
		return c.json({ success: true });
	});

	return routes;
}
