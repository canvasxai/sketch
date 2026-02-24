/**
 * In-memory buffer for thread messages in channels where the bot is participating.
 *
 * When the bot responds in a thread, it registers that thread. Subsequent messages
 * in the thread (without @mention) are buffered here. When the bot is next @mentioned,
 * the buffer is drained and prepended to the user prompt so the agent has full
 * context of what happened since its last response — without re-fetching from Slack.
 */

import type { Attachment } from "../files";

export interface BufferedMessage {
	userName: string;
	text: string;
	ts: string;
	attachments?: Attachment[];
}

export class ThreadBuffer {
	private buffers = new Map<string, BufferedMessage[]>();

	private key(channelId: string, threadTs: string): string {
		return `${channelId}:${threadTs}`;
	}

	register(channelId: string, threadTs: string): void {
		const k = this.key(channelId, threadTs);
		if (!this.buffers.has(k)) {
			this.buffers.set(k, []);
		}
	}

	hasThread(channelId: string, threadTs: string): boolean {
		return this.buffers.has(this.key(channelId, threadTs));
	}

	append(channelId: string, threadTs: string, message: BufferedMessage): void {
		const buf = this.buffers.get(this.key(channelId, threadTs));
		if (!buf) return;
		buf.push(message);
	}

	drain(channelId: string, threadTs: string): BufferedMessage[] {
		const k = this.key(channelId, threadTs);
		const buf = this.buffers.get(k);
		if (!buf) return [];
		const messages = [...buf];
		buf.length = 0;
		return messages;
	}
}
