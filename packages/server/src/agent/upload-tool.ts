/**
 * SendFileToChat MCP tool — allows the agent to queue files for upload back to the chat.
 *
 * Uses createSdkMcpServer() which is the SDK's only supported way to add custom tools.
 * It's in-memory only — no network server, just JS function dispatch over the existing
 * stdio pipe. Follows pi-mono's pattern: explicit tool call + injected upload function.
 *
 * UploadCollector is created per agent run. The tool handler validates the file path is
 * within the workspace and collects it. After the run, the caller drains the collector
 * and uploads via the platform-specific adapter (Slack files.uploadV2, etc.).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

export class UploadCollector {
	private pending: string[] = [];

	collect(filePath: string): void {
		this.pending.push(filePath);
	}

	drain(): string[] {
		const files = [...this.pending];
		this.pending = [];
		return files;
	}
}

export function createUploadMcpServer(collector: UploadCollector, workspaceDir: string) {
	const absWorkspace = resolve(workspaceDir);

	return createSdkMcpServer({
		name: "sketch",
		tools: [
			tool(
				"SendFileToChat",
				"Queue a file from the workspace to be sent back to the user in chat. The file must exist within your workspace directory. Create the file first using Write or Bash, then call this tool with the absolute path.",
				{ file_path: z.string().describe("Absolute path to the file within your workspace") },
				async ({ file_path }) => {
					const absPath = resolve(file_path);

					if (!absPath.startsWith(absWorkspace)) {
						return {
							content: [{ type: "text" as const, text: `Error: file must be within your workspace ${absWorkspace}` }],
						};
					}

					if (!existsSync(absPath)) {
						return {
							content: [{ type: "text" as const, text: `Error: file not found at ${absPath}` }],
						};
					}

					collector.collect(absPath);
					return {
						content: [{ type: "text" as const, text: `File queued for upload: ${absPath}` }],
					};
				},
			),
		],
	});
}
