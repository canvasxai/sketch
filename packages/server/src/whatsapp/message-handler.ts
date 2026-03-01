/**
 * Factory for the onMessage callback passed to runAgent().
 * Sends each text chunk via WhatsApp, skipping if disconnected.
 */
import type { WhatsAppBot } from "./bot";

export function createWhatsAppMessageHandler(whatsapp: WhatsAppBot, jid: string): (text: string) => Promise<void> {
	return async (text: string) => {
		if (whatsapp.isConnected) {
			await whatsapp.sendText(jid, text);
		}
	};
}
