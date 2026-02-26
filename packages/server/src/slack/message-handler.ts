/**
 * Factory for the onMessage callback passed to runAgent(). Handles the
 * first-message-replaces-thinking / subsequent-messages-are-new pattern
 * for both DMs (new top-level message) and channel threads (thread reply).
 */
import type { SlackBot } from "./bot";

export function createSlackMessageHandler(
	slackBot: SlackBot,
	channelId: string,
	thinkingTs: string,
	threadTs?: string,
): (text: string) => Promise<void> {
	let firstCall = true;

	return async (text: string) => {
		if (firstCall) {
			await slackBot.updateMessage(channelId, thinkingTs, text);
			firstCall = false;
		} else if (threadTs) {
			await slackBot.postThreadReply(channelId, threadTs, text);
		} else {
			await slackBot.postMessage(channelId, text);
		}
	};
}
