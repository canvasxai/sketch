import { formatAttachmentsForPrompt } from "../files";
import type { BufferedMessage } from "../slack/thread-buffer";

/**
 * Build the system context appended to the Claude Code preset.
 * Contains platform formatting rules, user metadata, and optional channel/bot context.
 * No post-processing — the agent produces platform-native formatting.
 *
 * For shared contexts (channels/groups), sender identity is NOT included here.
 * It goes in the user message via formatBufferedContext so it persists across
 * SDK session resumes (system prompt content does not survive resume).
 */
export function buildSystemContext(params: {
  platform: "slack" | "whatsapp";
  userName: string;
  workspaceDir: string;
  orgName?: string | null;
  botName?: string | null;
  channelContext?: {
    channelName: string;
  };
  groupContext?: {
    groupName: string;
    groupDescription?: string;
  };
  allowedSkillDescriptions?: { name: string; body: string }[] | null;
  claudeMdContents?: string[];
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
  }

  if (params.groupContext) {
    const lines = [`## Context: WhatsApp Group "${params.groupContext.groupName}"`];
    if (params.groupContext.groupDescription) {
      lines.push(`Group description: ${params.groupContext.groupDescription}`);
    }
    lines.push(
      "You are responding in a shared WhatsApp group. Multiple users share this workspace and can see your responses.",
      "Address the user who mentioned you by name. Keep responses focused and concise.",
    );
    sections.push(...lines);
  }

  if (params.orgName || params.botName) {
    const botName = params.botName || "Sketch";
    if (params.orgName) {
      sections.push(
        "## Bot Identity",
        `You are ${botName} from ${params.orgName}.`,
        "Use this identity when introducing yourself or signing messages.",
      );
    } else {
      sections.push(
        "## Bot Identity",
        `You are ${botName}.`,
        "Use this identity when introducing yourself or signing messages.",
      );
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

  if (params.channelContext || params.groupContext) {
    sections.push("Note: In this workspace, the CLAUDE.md is shared by all users.");
  }

  if (params.allowedSkillDescriptions !== undefined && params.allowedSkillDescriptions !== null) {
    if (params.allowedSkillDescriptions.length === 0) {
      sections.push("## Skills", "You have NO skills enabled. Do not use the Skill tool.");
    } else {
      const skillLines: string[] = ["## Skills", "You have access to the following skills:"];
      for (const skill of params.allowedSkillDescriptions) {
        skillLines.push("", `### ${skill.name}`);
        if (skill.body) skillLines.push(skill.body);
      }
      skillLines.push(
        "",
        "These are ALL the skills available to you. Do NOT use or mention any skills not listed above.",
      );
      sections.push(...skillLines);
    }
  }

  if (params.claudeMdContents?.length) {
    sections.push("## Loaded CLAUDE.md Instructions");
    for (const content of params.claudeMdContents) {
      sections.push(content);
    }
  }

  if (!params.channelContext && !params.groupContext) {
    sections.push("## User", `Name: ${params.userName}`);
  }

  return sections.join("\n");
}

/**
 * Formats buffered context messages and the current user message into a chat-log
 * style prompt. Every message is attributed as `[Name]: text` so sender identity
 * persists across SDK session resumes (system prompt content does not survive).
 *
 * When a header is provided (e.g. bootstrap context for first mentions), it is
 * prepended before the buffered messages. A blank line separates context from
 * the current message.
 */
export function formatBufferedContext(
  messages: BufferedMessage[],
  currentUserName: string,
  currentMessage: string,
  header?: string,
): string {
  const currentLine = `[${currentUserName}]: ${currentMessage}`;

  if (messages.length === 0) return currentLine;

  const lines: string[] = [];
  if (header) lines.push(header);
  for (const msg of messages) {
    lines.push(`[${msg.userName}]: ${msg.text}`);
    if (msg.attachments?.length) {
      lines.push(formatAttachmentsForPrompt(msg.attachments));
    }
  }

  lines.push("", currentLine);
  return lines.join("\n");
}
