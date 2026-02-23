import { describe, expect, it } from "vitest";
import { buildSystemContext } from "./prompt";

describe("buildSystemContext", () => {
	describe("slack platform (DM)", () => {
		const result = buildSystemContext({
			platform: "slack",
			userName: "Alice",
			workspaceDir: "/data/workspaces/u123",
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

		it("does not include Slack-specific rules", () => {
			expect(result).not.toContain("mrkdwn");
			expect(result).not.toContain("<url|text>");
		});

		it("includes workspace isolation section with the workspace path", () => {
			expect(result).toContain("Workspace Isolation");
			expect(result).toContain("/data/workspaces/u456");
		});

		it("includes file restriction rule", () => {
			expect(result).toContain("MUST only read, write, and execute files within this directory");
		});

		it("includes user name", () => {
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
				recentMessages: [
					{ userName: "Alice", text: "has anyone tried the new API?" },
					{ userName: "Bob", text: "yeah it works on staging" },
				],
			},
		});

		it("includes channel name", () => {
			expect(result).toContain("Slack Channel #general");
		});

		it("includes shared workspace note", () => {
			expect(result).toContain("Multiple users share this workspace");
		});

		it("uses Sent by instead of User", () => {
			expect(result).toContain("## Sent by");
			expect(result).toContain("Carol");
			expect(result).not.toContain("## User");
		});

		it("includes recent messages with usernames", () => {
			expect(result).toContain("## Recent Channel Messages");
			expect(result).toContain("[Alice]: has anyone tried the new API?");
			expect(result).toContain("[Bob]: yeah it works on staging");
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

	describe("channel context with empty recent messages", () => {
		const result = buildSystemContext({
			platform: "slack",
			userName: "Dave",
			workspaceDir: "/data/workspaces/channel-C002",
			channelContext: {
				channelName: "random",
				recentMessages: [],
			},
		});

		it("includes channel name", () => {
			expect(result).toContain("Slack Channel #random");
		});

		it("omits recent messages section when array is empty", () => {
			expect(result).not.toContain("## Recent Channel Messages");
		});
	});
});
