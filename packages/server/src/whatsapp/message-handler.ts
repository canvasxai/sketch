/**
 * Factory for the onMessage callback passed to runAgent(). Removes the
 * thinking reaction on first message, then sends each text via WhatsApp.
 * Returns { onMessage, reactionRemoved } so the caller can do a fallback
 * removal if the agent produced no text at all.
 */
import type { proto } from "@whiskeysockets/baileys";
import type { WhatsAppBot } from "./bot";

export function createWhatsAppMessageHandler(
	whatsapp: WhatsAppBot,
	jid: string,
	msgKey: proto.IMessageKey,
): { onMessage: (text: string) => Promise<void>; isReactionRemoved: () => boolean } {
	let reactionRemoved = false;

	const onMessage = async (text: string) => {
		if (!reactionRemoved && whatsapp.isConnected) {
			await whatsapp.removeReaction(jid, msgKey);
			reactionRemoved = true;
		}
		if (whatsapp.isConnected) {
			await whatsapp.sendText(jid, text);
		}
	};

	return { onMessage, isReactionRemoved: () => reactionRemoved };
}
