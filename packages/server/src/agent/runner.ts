/**
 * Core agent execution — invokes the Claude Agent SDK's query() in a user's
 * isolated workspace with file access restrictions via canUseTool.
 *
 * Skills support: the SDK discovers skills from ~/.claude/skills/ (org-wide via
 * "user" settingSource) and {workspace}/.claude/skills/ (per-user via "project").
 * canUseTool grants read-only file access and Bash execution for ~/.claude paths
 * so skills can be loaded and their companion CLIs executed.
 */
import { resolve } from "node:path";
import { type SDKUserMessage, query } from "@anthropic-ai/claude-agent-sdk";
import type { Attachment } from "../files";
import { buildMultimodalContent, formatAttachmentsForPrompt, isImageAttachment } from "../files";
import type { Logger } from "../logger";
import { createCanUseTool } from "./permissions";
import { buildSystemContext } from "./prompt";
import { getSessionId, saveSessionId } from "./sessions";
import { UploadCollector, createUploadMcpServer } from "./upload-tool";

export interface AgentResult {
	text: string | null;
	sessionId: string;
	costUsd: number;
	pendingUploads: string[];
}

export interface RunAgentParams {
	userMessage: string;
	workspaceDir: string;
	userName: string;
	logger: Logger;
	attachments?: Attachment[];
	threadTs?: string;
	channelContext?: {
		channelName: string;
		recentMessages: Array<{ userName: string; text: string }>;
	};
}

export async function runAgent(params: RunAgentParams): Promise<AgentResult> {
	const { userMessage, workspaceDir, userName, logger } = params;
	const existingSessionId = await getSessionId(workspaceDir, params.threadTs);
	const absWorkspace = resolve(workspaceDir);

	const systemAppend = buildSystemContext({
		platform: "slack",
		userName,
		workspaceDir: absWorkspace,
		channelContext: params.channelContext,
	});

	let sessionId = "";
	let resultText: string | null = null;
	let costUsd = 0;

	const attachments = params.attachments ?? [];
	const hasImages = attachments.some((a) => isImageAttachment(a));

	let prompt: string | AsyncIterable<SDKUserMessage>;

	const { images, nonImages } = hasImages
		? { images: attachments.filter(isImageAttachment), nonImages: attachments.filter((a) => !isImageAttachment(a)) }
		: { images: [], nonImages: attachments };
	logger.debug(
		{
			totalAttachments: attachments.length,
			imageCount: images.length,
			nonImageCount: nonImages.length,
			images: images.map((a) => ({ name: a.originalName, mime: a.mimeType })),
			promptMode: hasImages ? "multimodal" : "text",
		},
		"Prompt mode selected",
	);

	if (hasImages) {
		const content = await buildMultimodalContent(userMessage, attachments);
		prompt = (async function* () {
			yield {
				type: "user" as const,
				session_id: "",
				message: { role: "user" as const, content },
				parent_tool_use_id: null,
			};
		})();
	} else {
		prompt = userMessage + formatAttachmentsForPrompt(attachments);
	}

	const uploadCollector = new UploadCollector();
	const uploadServer = createUploadMcpServer(uploadCollector, absWorkspace);

	const run = query({
		prompt,
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
			mcpServers: { sketch: uploadServer },
			stderr: (data) => {
				logger.debug({ stderr: data.trim() }, "Agent subprocess");
			},
			canUseTool: createCanUseTool(absWorkspace, logger),
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
		await saveSessionId(workspaceDir, sessionId, params.threadTs);
	}

	const pendingUploads = uploadCollector.drain();
	logger.info({ userId: userName, sessionId, costUsd, pendingUploads: pendingUploads.length }, "Agent run completed");

	return { text: resultText, sessionId, costUsd, pendingUploads };
}
