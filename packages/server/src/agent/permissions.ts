/**
 * Workspace isolation via canUseTool — factory function that creates the
 * permission callback for the Claude Agent SDK's query().
 *
 * Four security layers:
 * 1. Tool allowlist — only permitted tools can execute
 * 2. Skill allowlist — per-channel restriction on which skills the agent may invoke
 * 3. File path validation — file tools restricted to workspace + ~/.claude (read-only)
 * 4. Bash path validation — commands blocked if they reference absolute paths outside workspace/~/.claude
 */
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { Logger } from "../logger";

export const PERMITTED_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Skill"];

export const FILE_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep"];

export const READ_ONLY_FILE_TOOLS = ["Read", "Glob", "Grep"];

export interface CanUseToolOptions {
  absWorkspace: string;
  logger: Logger;
  claudeDir?: string;
  allowedSkills?: string[] | null;
}

export function createCanUseTool(opts: CanUseToolOptions) {
  const absClaudeDir = opts.claudeDir ?? resolve(homedir(), ".claude");

  return async (toolName: string, input: Record<string, unknown>): Promise<PermissionResult> => {
    opts.logger.debug({ toolName }, "canUseTool called");

    // Layer 1: tool allowlist (all MCP tools are allowed — they come from servers we configure)
    if (!PERMITTED_TOOLS.includes(toolName) && !toolName.startsWith("mcp__")) {
      return { behavior: "deny", message: `Tool ${toolName} is not allowed` };
    }

    // Layer 2: skill allowlist — restrict which skills the agent can invoke per channel/user
    if (toolName === "Skill" && opts.allowedSkills !== undefined && opts.allowedSkills !== null) {
      const skillName = input.name as string | undefined;
      if (typeof skillName !== "string") {
        return { behavior: "deny", message: "Skill tool call missing skill name" };
      }
      if (!opts.allowedSkills.includes(skillName)) {
        return { behavior: "deny", message: `Skill "${skillName}" is not enabled` };
      }
    }

    // Layer 3: file path validation
    if (FILE_TOOLS.includes(toolName)) {
      const rawPath = (input.file_path as string) || (input.path as string) || opts.absWorkspace;
      const filePath = resolve(rawPath);
      if (!filePath.startsWith(opts.absWorkspace)) {
        if (filePath.startsWith(absClaudeDir)) {
          return { behavior: "allow", updatedInput: input };
        }
        opts.logger.warn(
          { toolName, filePath, absWorkspace: opts.absWorkspace },
          "Blocked file access outside workspace",
        );
        return {
          behavior: "deny",
          message: `Access denied: ${filePath} is outside your workspace ${opts.absWorkspace}`,
        };
      }
    }

    // Layer 4: bash path validation
    if (toolName === "Bash") {
      const command = (input.command as string) || "";
      const hasAbsolutePath = /(?:^|\s)\/(?!data\/|dev\/null|tmp\/)/.test(command);
      if (hasAbsolutePath && !command.includes(opts.absWorkspace) && !command.includes(absClaudeDir)) {
        opts.logger.warn(
          { toolName, command, absWorkspace: opts.absWorkspace },
          "Blocked bash command referencing outside paths",
        );
        return {
          behavior: "deny",
          message: `Access denied: bash commands must operate within your workspace ${opts.absWorkspace}`,
        };
      }
    }

    return { behavior: "allow", updatedInput: input };
  };
}
