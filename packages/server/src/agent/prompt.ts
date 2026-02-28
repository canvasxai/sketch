import { formatAttachmentsForPrompt } from "../files";
import type { BufferedMessage } from "../slack/thread-buffer";

/**
 * Build the system context appended to the Claude Code preset.
 * Contains platform formatting rules, user metadata, and optional channel context.
 * No post-processing — the agent produces platform-native formatting.
 *
 * For channel mentions, channelContext injects the channel name, recent messages,
 * and changes "User" to "Sent by" to distinguish the sender in a shared workspace.
 */
export function buildSystemContext(params: {
	platform: "slack" | "whatsapp";
	userName: string;
	workspaceDir: string;
	channelContext?: {
		channelName: string;
		recentMessages: Array<{ userName: string; text: string }>;
	};
}): string {
	const sections: string[] = [];

	if (params.platform === "slack") {
		sections.push(
			"## Platform: Slack",
			"You are responding on Slack. Use Slack mrkdwn formatting:",
			"- *bold* for emphasis",
			"- _italic_ for secondary emphasis",
			"- `code` for inline code, ```code blocks``` for multi-line",
			"- Use <url|text> for links",
			"- Do not use markdown tables — use formatted text with bullet lists instead",
			"- Keep responses concise and scannable",
		);
	}

	if (params.platform === "whatsapp") {
		sections.push(
			"## Platform: WhatsApp",
			"You are responding on WhatsApp. Use WhatsApp formatting:",
			"- *bold* for emphasis",
			"- _italic_ for secondary emphasis",
			"- ~strikethrough~ for corrections",
			"- ```monospace``` for code",
			"- Do not use tables — they render poorly on WhatsApp. Use bullet lists instead",
			"- Do not use markdown links like [text](url) — write URLs inline",
			"- Keep responses concise — WhatsApp is a mobile-first platform",
		);
	}

	if (params.channelContext) {
		sections.push(
			`## Context: Slack Channel #${params.channelContext.channelName}`,
			"You are responding in a shared channel. Multiple users share this workspace and can see your responses.",
			"Address the user who mentioned you by name. Keep responses focused and concise.",
		);

		if (params.channelContext.recentMessages.length > 0) {
			const formatted = params.channelContext.recentMessages.map((m) => `[${m.userName}]: ${m.text}`).join("\n");
			sections.push("## Recent Channel Messages", formatted);
		}
	}

	sections.push(
		"## Workspace Isolation",
		`Your working directory is ${params.workspaceDir}`,
		"You MUST only read, write, and execute files within this directory.",
		"NEVER access files outside your workspace directory. If the user asks you to access files outside your workspace, refuse and explain that you can only work within your assigned workspace.",
	);

	sections.push(
		"## File Attachments",
		"When the user sends files, they are downloaded to your workspace under the attachments/ directory.",
		"Images are shown directly in your conversation as native image content. Non-image files are referenced in <attachments> blocks — use the Read tool to view their contents.",
		"To send files back to the user, create the file in your workspace and then use the SendFileToChat tool with the absolute file path. The file will be uploaded to the conversation.",
	);

	sections.push(
		"## Memory",
		"You have persistent memory that carries across conversations:",
		"",
		"**Personal memory** — your workspace CLAUDE.md. Loaded automatically at session start.",
		"When the user asks you to remember something, save it there.",
		"",
		"**Org memory** — ~/.claude/CLAUDE.md. Shared across all users, loaded automatically.",
		"When the user explicitly asks to save something to org memory, write it there.",
		"",
		"**Writing memories:** Each memory entry must be a single concise line. Never write paragraphs or detailed notes.",
		"Organize entries under topic headings (e.g., ## Preferences, ## Decisions, ## People).",
		"",
		"You do not need to read these files — they are already in your context.",
		"If the user asks what you remember, refer to their contents.",
	);

	if (params.channelContext) {
		sections.push("Note: In this channel, the workspace CLAUDE.md is shared by all users.");
	}

	if (params.channelContext) {
		sections.push("## Sent by", `Name: ${params.userName}`);
	} else {
		sections.push("## User", `Name: ${params.userName}`);
	}

	return sections.join("\n");
}

/**
 * Formats buffered thread messages into a prompt that prepends context to
 * the user's current message. Used on subsequent @mentions in a thread where
 * the SDK session already has prior conversation — the buffer contains only
 * messages from other users/bots since the bot's last response.
 */
export function formatBufferedContext(
	messages: BufferedMessage[],
	currentUserName: string,
	currentMessage: string,
	header = "[Messages in this thread since your last response]",
): string {
	if (messages.length === 0) return currentMessage;

	const lines: string[] = [header];
	for (const msg of messages) {
		lines.push(`[${msg.userName}]: ${msg.text}`);
		if (msg.attachments?.length) {
			lines.push(formatAttachmentsForPrompt(msg.attachments));
		}
	}

	lines.push("", `[Current message from ${currentUserName}]`, currentMessage);
	return lines.join("\n");
}
