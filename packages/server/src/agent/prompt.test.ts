import { describe, expect, it } from "vitest";
import { buildSystemContext, formatBufferedContext } from "./prompt";

describe("buildSystemContext", () => {
  describe("slack platform (DM)", () => {
    const result = buildSystemContext({
      platform: "slack",
      userName: "Alice",
      workspaceDir: "/data/workspaces/u123",
      orgName: "Acme Corp",
      botName: "Sketch",
    });

    it("includes mrkdwn formatting rules", () => {
      expect(result).toContain("mrkdwn");
      expect(result).toContain("*bold*");
      expect(result).toContain("_italic_");
      expect(result).toContain("`code`");
      expect(result).toContain("<url|text>");
    });

    it("includes no-tables instruction", () => {
      expect(result).toContain("Do not use markdown tables");
    });

    it("includes workspace isolation section with the workspace path", () => {
      expect(result).toContain("Workspace Isolation");
      expect(result).toContain("/data/workspaces/u123");
    });

    it("includes file restriction rule", () => {
      expect(result).toContain("MUST only read, write, and execute files within this directory");
    });

    it("includes user name under User heading", () => {
      expect(result).toContain("## User");
      expect(result).toContain("Alice");
    });

    it("includes bot identity section when org/bot provided", () => {
      expect(result).toContain("## Bot Identity");
      expect(result).toContain("You are Sketch from Acme Corp.");
    });

    it("does not include channel context sections", () => {
      expect(result).not.toContain("Slack Channel #");
      expect(result).not.toContain("Sent by");
      expect(result).not.toContain("Recent Channel Messages");
    });
  });

  describe("whatsapp platform", () => {
    const result = buildSystemContext({
      platform: "whatsapp",
      userName: "Bob",
      workspaceDir: "/data/workspaces/u456",
    });

    it("includes WhatsApp formatting rules", () => {
      expect(result).toContain("## Platform: WhatsApp");
      expect(result).toContain("*bold*");
      expect(result).toContain("_italic_");
      expect(result).toContain("~strikethrough~");
      expect(result).toContain("```monospace```");
    });

    it("does not include Slack-specific rules", () => {
      expect(result).not.toContain("mrkdwn");
      expect(result).not.toContain("<url|text>");
    });

    it("includes no-tables instruction", () => {
      expect(result).toContain("Do not use tables");
    });

    it("includes no-markdown-links instruction", () => {
      expect(result).toContain("Do not use markdown links");
      expect(result).toContain("write URLs inline");
    });

    it("includes workspace isolation section with the workspace path", () => {
      expect(result).toContain("Workspace Isolation");
      expect(result).toContain("/data/workspaces/u456");
    });

    it("includes file restriction rule", () => {
      expect(result).toContain("MUST only read, write, and execute files within this directory");
    });

    it("includes file attachments section", () => {
      expect(result).toContain("## File Attachments");
      expect(result).toContain("SendFileToChat");
    });

    it("includes user name under User heading", () => {
      expect(result).toContain("## User");
      expect(result).toContain("Bob");
    });
  });

  describe("channel context", () => {
    const result = buildSystemContext({
      platform: "slack",
      userName: "Carol",
      workspaceDir: "/data/workspaces/channel-C001",
      channelContext: {
        channelName: "general",
      },
    });

    it("includes channel name", () => {
      expect(result).toContain("Slack Channel #general");
    });

    it("includes shared workspace note", () => {
      expect(result).toContain("Multiple users share this workspace");
    });

    it("does not include sender name in system prompt", () => {
      expect(result).not.toContain("## Sent by");
      expect(result).not.toContain("## User");
    });

    it("includes address-by-name instruction", () => {
      expect(result).toContain("Address the user who mentioned you by name");
    });

    it("still includes Slack formatting rules", () => {
      expect(result).toContain("mrkdwn");
    });

    it("still includes workspace isolation", () => {
      expect(result).toContain("Workspace Isolation");
      expect(result).toContain("/data/workspaces/channel-C001");
    });
  });

  describe("file attachments", () => {
    const result = buildSystemContext({
      platform: "slack",
      userName: "Eve",
      workspaceDir: "/data/workspaces/u789",
    });

    it("includes file attachments section", () => {
      expect(result).toContain("## File Attachments");
    });

    it("mentions the attachments directory", () => {
      expect(result).toContain("attachments/");
    });

    it("mentions images shown directly", () => {
      expect(result).toContain("Images are shown directly");
    });

    it("mentions Read tool for non-image files", () => {
      expect(result).toContain("Read tool");
    });

    it("mentions SendFileToChat tool for sending files back", () => {
      expect(result).toContain("SendFileToChat");
    });
  });

  describe("memory", () => {
    it("includes memory section in DM context", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
      });
      expect(result).toContain("## Memory");
      expect(result).toContain("Personal memory");
      expect(result).toContain("Org memory");
      expect(result).toContain("~/.claude/CLAUDE.md");
    });

    it("includes concise writing instruction", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
      });
      expect(result).toContain("single concise line");
      expect(result).toContain("topic headings");
    });

    it("does not include shared memory note in DM context", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
      });
      expect(result).not.toContain("shared by all users");
    });

    it("includes shared memory note in channel context", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/channel-C001",
        channelContext: {
          channelName: "general",
        },
      });
      expect(result).toContain("shared by all users");
    });
  });

  describe("group context", () => {
    const result = buildSystemContext({
      platform: "whatsapp",
      userName: "Alice",
      workspaceDir: "/data/workspaces/wa-group-123",
      groupContext: {
        groupName: "Engineering Team",
        groupDescription: "Daily standups and discussions",
      },
    });

    it("includes group name", () => {
      expect(result).toContain('WhatsApp Group "Engineering Team"');
    });

    it("includes group description", () => {
      expect(result).toContain("Group description: Daily standups and discussions");
    });

    it("includes shared workspace note", () => {
      expect(result).toContain("Multiple users share this workspace");
    });

    it("does not include sender name in system prompt", () => {
      expect(result).not.toContain("## Sent by");
      expect(result).not.toContain("## User");
    });

    it("includes address-by-name instruction", () => {
      expect(result).toContain("Address the user who mentioned you by name");
    });

    it("includes shared memory note", () => {
      expect(result).toContain("shared by all users");
    });

    it("includes WhatsApp formatting rules", () => {
      expect(result).toContain("## Platform: WhatsApp");
    });
  });

  describe("allowedSkillDescriptions", () => {
    it("omits skills section when allowedSkillDescriptions is undefined", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
      });
      expect(result).not.toContain("## Skills");
    });

    it("omits skills section when allowedSkillDescriptions is null", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
        allowedSkillDescriptions: null,
      });
      expect(result).not.toContain("## Skills");
    });

    it("includes no-skills message when allowedSkillDescriptions is empty", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
        allowedSkillDescriptions: [],
      });
      expect(result).toContain("## Skills");
      expect(result).toContain("NO skills enabled");
      expect(result).toContain("Do not use the Skill tool");
    });

    it("lists each skill with name and body", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
        allowedSkillDescriptions: [
          { name: "Canvas", body: "Interact with Canvas AI" },
          { name: "CRM", body: "Manage CRM leads" },
        ],
      });
      expect(result).toContain("## Skills");
      expect(result).toContain("### Canvas");
      expect(result).toContain("Interact with Canvas AI");
      expect(result).toContain("### CRM");
      expect(result).toContain("Manage CRM leads");
    });

    it("includes restriction warning when skills are listed", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
        allowedSkillDescriptions: [{ name: "Canvas", body: "desc" }],
      });
      expect(result).toContain("These are ALL the skills available to you");
      expect(result).toContain("Do NOT use or mention any skills not listed above");
    });

    it("skips body line when skill body is empty", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
        allowedSkillDescriptions: [{ name: "Canvas", body: "" }],
      });
      expect(result).toContain("### Canvas");
      // The line after "### Canvas" should be blank (next section), not an empty body line
      const lines = result.split("\n");
      const headerIdx = lines.indexOf("### Canvas");
      expect(lines[headerIdx + 1]).toBe("");
    });
  });

  describe("claudeMdContents", () => {
    it("omits CLAUDE.md section when claudeMdContents is undefined", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
      });
      expect(result).not.toContain("Loaded CLAUDE.md Instructions");
    });

    it("omits CLAUDE.md section when claudeMdContents is empty", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
        claudeMdContents: [],
      });
      expect(result).not.toContain("Loaded CLAUDE.md Instructions");
    });

    it("includes CLAUDE.md contents when provided", () => {
      const result = buildSystemContext({
        platform: "slack",
        userName: "Alice",
        workspaceDir: "/data/workspaces/u123",
        claudeMdContents: ["Always use TypeScript", "Prefer pnpm over npm"],
      });
      expect(result).toContain("## Loaded CLAUDE.md Instructions");
      expect(result).toContain("Always use TypeScript");
      expect(result).toContain("Prefer pnpm over npm");
    });
  });

  describe("group context without description", () => {
    const result = buildSystemContext({
      platform: "whatsapp",
      userName: "Bob",
      workspaceDir: "/data/workspaces/wa-group-456",
      groupContext: {
        groupName: "Casual Chat",
      },
    });

    it("includes group name", () => {
      expect(result).toContain('WhatsApp Group "Casual Chat"');
    });

    it("does not include group description line", () => {
      expect(result).not.toContain("Group description:");
    });
  });
});

describe("formatBufferedContext", () => {
  it("wraps current message with sender attribution when buffer is empty", () => {
    const result = formatBufferedContext([], "Alice", "what do you think?");
    expect(result).toBe("[Alice]: what do you think?");
  });

  it("prepends buffered messages with current message attributed", () => {
    const messages = [
      { userName: "Bob", text: "I like option A", ts: "1111.0001" },
      { userName: "Carol", text: "Me too", ts: "1111.0002" },
    ];
    const result = formatBufferedContext(messages, "Alice", "what do you think?");

    expect(result).toContain("[Bob]: I like option A");
    expect(result).toContain("[Carol]: Me too");
    expect(result).toContain("[Alice]: what do you think?");
  });

  it("does not include a header when none is provided", () => {
    const messages = [{ userName: "Bob", text: "hey", ts: "1111.0001" }];
    const result = formatBufferedContext(messages, "Alice", "hi");

    expect(result).toBe("[Bob]: hey\n\n[Alice]: hi");
  });

  it("includes header when provided", () => {
    const messages = [{ userName: "Bob", text: "hey there", ts: "1111.0001" }];
    const result = formatBufferedContext(messages, "Alice", "hello", "[Thread context before you joined]");

    expect(result).toContain("[Thread context before you joined]");
    expect(result).toContain("[Bob]: hey there");
    expect(result).toContain("[Alice]: hello");
  });

  it("separates buffered messages from current message with blank line", () => {
    const messages = [{ userName: "Bob", text: "update", ts: "1111.0001" }];
    const result = formatBufferedContext(messages, "Alice", "thanks");

    const lines = result.split("\n");
    const blankIdx = lines.indexOf("");
    expect(blankIdx).toBeGreaterThan(0);
    expect(lines[blankIdx + 1]).toBe("[Alice]: thanks");
  });

  it("includes XML attachment tags for messages with files", () => {
    const messages = [
      {
        userName: "Bob",
        text: "here's the report",
        ts: "1111.0001",
        attachments: [
          {
            originalName: "report.pdf",
            mimeType: "application/pdf",
            localPath: "/ws/attachments/report.pdf",
            sizeBytes: 2048,
          },
        ],
      },
    ];
    const result = formatBufferedContext(messages, "Alice", "looks good?");

    expect(result).toContain("[Bob]: here's the report");
    expect(result).toContain("<attachments>");
    expect(result).toContain('name="report.pdf"');
    expect(result).toContain('path="/ws/attachments/report.pdf"');

    const attachIdx = result.indexOf("<attachments>");
    const currentIdx = result.indexOf("[Alice]: looks good?");
    expect(attachIdx).toBeLessThan(currentIdx);
  });

  it("preserves message order", () => {
    const messages = [
      { userName: "Alice", text: "first", ts: "1111.0001" },
      { userName: "Bob", text: "second", ts: "1111.0002" },
      { userName: "Carol", text: "third", ts: "1111.0003" },
    ];
    const result = formatBufferedContext(messages, "Dave", "fourth");

    const firstIdx = result.indexOf("[Alice]: first");
    const secondIdx = result.indexOf("[Bob]: second");
    const thirdIdx = result.indexOf("[Carol]: third");
    const fourthIdx = result.indexOf("[Dave]: fourth");
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
    expect(thirdIdx).toBeLessThan(fourthIdx);
  });
});
