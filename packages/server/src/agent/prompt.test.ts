import { describe, expect, it } from "vitest";
import { buildSystemContext, formatBufferedContext } from "./prompt";

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

describe("formatBufferedContext", () => {
	it("returns just the current message when buffer is empty", () => {
		const result = formatBufferedContext([], "Alice", "what do you think?");
		expect(result).toBe("what do you think?");
	});

	it("prepends buffered messages with header", () => {
		const messages = [
			{ userName: "Bob", text: "I like option A", ts: "1111.0001" },
			{ userName: "Carol", text: "Me too", ts: "1111.0002" },
		];
		const result = formatBufferedContext(messages, "Alice", "what do you think?");

		expect(result).toContain("[Messages in this thread since your last response]");
		expect(result).toContain("[Bob]: I like option A");
		expect(result).toContain("[Carol]: Me too");
		expect(result).toContain("[Current message from Alice]");
		expect(result).toContain("what do you think?");
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
	});

	it("handles single buffered message", () => {
		const messages = [{ userName: "Bob", text: "quick update", ts: "1111.0001" }];
		const result = formatBufferedContext(messages, "Alice", "thanks");

		expect(result).toContain("[Bob]: quick update");
		expect(result).toContain("[Current message from Alice]");
		expect(result).toContain("thanks");
	});

	it("uses custom header when provided", () => {
		const messages = [{ userName: "Bob", text: "hey there", ts: "1111.0001" }];
		const result = formatBufferedContext(messages, "Alice", "hello", "[Thread context before you joined]");

		expect(result).toContain("[Thread context before you joined]");
		expect(result).not.toContain("[Messages in this thread since your last response]");
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
		const fourthIdx = result.indexOf("fourth");
		expect(firstIdx).toBeLessThan(secondIdx);
		expect(secondIdx).toBeLessThan(thirdIdx);
		expect(thirdIdx).toBeLessThan(fourthIdx);
	});
});
