const WHATSAPP_TEXT_LIMIT = 4000;

/**
 * Splits text into chunks that fit within WhatsApp's message limit.
 * Strategy: fill a window up to the limit, split at the last \n within
 * the window. Fallback to last whitespace, then hard cut.
 * Only activates when text exceeds the limit — short messages pass through unchanged.
 */
export function chunkText(text: string, limit = WHATSAPP_TEXT_LIMIT): string[] {
	if (text.length <= limit) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > limit) {
		const window = remaining.slice(0, limit);
		let breakIdx = window.lastIndexOf("\n");
		if (breakIdx <= 0) breakIdx = window.lastIndexOf(" ");
		if (breakIdx <= 0) breakIdx = limit;

		chunks.push(remaining.slice(0, breakIdx).trimEnd());
		remaining = remaining.slice(breakIdx).trimStart();
	}

	if (remaining.length > 0) {
		chunks.push(remaining);
	}

	return chunks;
}
