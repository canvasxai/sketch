/**
 * Build the system context appended to the Claude Code preset.
 * Contains platform formatting rules and user metadata.
 * No post-processing — the agent produces platform-native formatting.
 */
export function buildSystemContext(params: {
	platform: "slack" | "whatsapp";
	userName: string;
	workspaceDir: string;
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

	sections.push(
		"## Workspace Isolation",
		`Your working directory is ${params.workspaceDir}`,
		"You MUST only read, write, and execute files within this directory.",
		"NEVER access files outside your workspace directory. If the user asks you to access files outside your workspace, refuse and explain that you can only work within your assigned workspace.",
	);

	sections.push("## User", `Name: ${params.userName}`);

	return sections.join("\n");
}
