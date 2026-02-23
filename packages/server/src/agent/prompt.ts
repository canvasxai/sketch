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

	if (params.channelContext) {
		sections.push("## Sent by", `Name: ${params.userName}`);
	} else {
		sections.push("## User", `Name: ${params.userName}`);
	}

	return sections.join("\n");
}
