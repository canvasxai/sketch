/**
 * Workspace isolation via canUseTool — factory function that creates the
 * permission callback for the Claude Agent SDK's query().
 *
 * Three security layers:
 * 1. Tool allowlist — only permitted tools can execute
 * 2. File path validation — file tools restricted to workspace + ~/.claude (read-only)
 * 3. Bash path validation — commands blocked if they reference absolute paths outside workspace/~/.claude
 */
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { Logger } from "../logger";

export const PERMITTED_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Skill"];

export const FILE_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep"];

export const READ_ONLY_FILE_TOOLS = ["Read", "Glob", "Grep"];

export function createCanUseTool(absWorkspace: string, logger: Logger, claudeDir?: string) {
	const absClaudeDir = claudeDir ?? resolve(homedir(), ".claude");

	return async (toolName: string, input: Record<string, unknown>): Promise<PermissionResult> => {
		logger.debug({ toolName }, "canUseTool called");

		// Layer 1: tool allowlist (all MCP tools are allowed — they come from servers we configure)
		if (!PERMITTED_TOOLS.includes(toolName) && !toolName.startsWith("mcp__")) {
			return { behavior: "deny", message: `Tool ${toolName} is not allowed` };
		}

		// Layer 2: file path validation
		if (FILE_TOOLS.includes(toolName)) {
			const rawPath = (input.file_path as string) || (input.path as string) || absWorkspace;
			const filePath = resolve(rawPath);
			if (!filePath.startsWith(absWorkspace)) {
				if (filePath.startsWith(absClaudeDir)) {
					return { behavior: "allow", updatedInput: input };
				}
				logger.warn({ toolName, filePath, absWorkspace }, "Blocked file access outside workspace");
				return {
					behavior: "deny",
					message: `Access denied: ${filePath} is outside your workspace ${absWorkspace}`,
				};
			}
		}

		// Layer 3: bash path validation
		if (toolName === "Bash") {
			const command = (input.command as string) || "";
			const hasAbsolutePath = /(?:^|\s)\/(?!data\/|dev\/null|tmp\/)/.test(command);
			if (hasAbsolutePath && !command.includes(absWorkspace) && !command.includes(absClaudeDir)) {
				logger.warn({ toolName, command, absWorkspace }, "Blocked bash command referencing outside paths");
				return {
					behavior: "deny",
					message: `Access denied: bash commands must operate within your workspace ${absWorkspace}`,
				};
			}
		}

		return { behavior: "allow", updatedInput: input };
	};
}
