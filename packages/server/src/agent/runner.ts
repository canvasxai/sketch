import { homedir } from "node:os";
import { resolve } from "node:path";
/**
 * Core agent execution — invokes the Claude Agent SDK's query() in a user's
 * isolated workspace with file access restrictions via canUseTool.
 *
 * Skills support: the SDK discovers skills from ~/.claude/skills/ (org-wide via
 * "user" settingSource) and {workspace}/.claude/skills/ (per-user via "project").
 * canUseTool grants read-only file access and Bash execution for ~/.claude paths
 * so skills can be loaded and their companion CLIs executed.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Logger } from "../logger";
import { buildSystemContext } from "./prompt";
import { getSessionId, saveSessionId } from "./sessions";

export interface AgentResult {
	text: string | null;
	sessionId: string;
	costUsd: number;
}

export interface RunAgentParams {
	userMessage: string;
	workspaceDir: string;
	userName: string;
	logger: Logger;
}

export async function runAgent(params: RunAgentParams): Promise<AgentResult> {
	const { userMessage, workspaceDir, userName, logger } = params;
	const existingSessionId = await getSessionId(workspaceDir);
	const absWorkspace = resolve(workspaceDir);

	const systemAppend = buildSystemContext({
		platform: "slack",
		userName,
		workspaceDir: absWorkspace,
	});

	let sessionId = "";
	let resultText: string | null = null;
	let costUsd = 0;

	const run = query({
		prompt: userMessage,
		options: {
			cwd: workspaceDir,
			resume: existingSessionId,
			systemPrompt: {
				type: "preset" as const,
				preset: "claude_code" as const,
				append: systemAppend,
			},
			permissionMode: "default" as const,
			allowDangerouslySkipPermissions: false,
			settingSources: ["project", "user"],
			stderr: (data) => {
				logger.debug({ stderr: data.trim() }, "Agent subprocess");
			},
			canUseTool: async (toolName, input) => {
				logger.debug({ toolName }, "canUseTool called");
				const absClaudeDir = resolve(homedir(), ".claude");

				const permitted = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Skill"];
				if (!permitted.includes(toolName)) {
					return { behavior: "deny" as const, message: `Tool ${toolName} is not allowed` };
				}

				// File tools: workspace (full access) + ~/.claude (read-only for skill loading)
				const fileTools = ["Read", "Edit", "Write", "Glob", "Grep"];
				if (fileTools.includes(toolName)) {
					const rawPath = (input.file_path as string) || (input.path as string) || absWorkspace;
					const filePath = resolve(rawPath);
					if (!filePath.startsWith(absWorkspace)) {
						const readOnlyTools = ["Read", "Glob", "Grep"];
						if (readOnlyTools.includes(toolName) && filePath.startsWith(absClaudeDir)) {
							return { behavior: "allow" as const, updatedInput: input };
						}
						logger.warn({ toolName, filePath, absWorkspace }, "Blocked file access outside workspace");
						return {
							behavior: "deny" as const,
							message: `Access denied: ${filePath} is outside your workspace ${absWorkspace}`,
						};
					}
				}

				// Bash: allow workspace + ~/.claude paths, deny everything else
				if (toolName === "Bash") {
					const command = (input.command as string) || "";
					const hasAbsolutePath = /(?:^|\s)\/(?!data\/|dev\/null|tmp\/)/.test(command);
					if (hasAbsolutePath && !command.includes(absWorkspace) && !command.includes(absClaudeDir)) {
						logger.warn({ toolName, command, absWorkspace }, "Blocked bash command referencing outside paths");
						return {
							behavior: "deny" as const,
							message: `Access denied: bash commands must operate within your workspace ${absWorkspace}`,
						};
					}
				}

				return { behavior: "allow" as const, updatedInput: input };
			},
		},
	});

	for await (const message of run) {
		if (message.type === "system" && message.subtype === "init") {
			sessionId = message.session_id;
		}

		if (message.type === "result") {
			sessionId = message.session_id;
			costUsd = message.total_cost_usd;
			if ("result" in message && typeof message.result === "string") {
				resultText = message.result;
			}
		}
	}

	if (sessionId) {
		await saveSessionId(workspaceDir, sessionId);
	}

	logger.info({ userId: userName, sessionId, costUsd }, "Agent run completed");

	return { text: resultText, sessionId, costUsd };
}
