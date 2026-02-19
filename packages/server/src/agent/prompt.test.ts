import { describe, expect, it } from "vitest";
import { buildSystemContext } from "./prompt";

describe("buildSystemContext", () => {
	describe("slack platform", () => {
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

		it("includes user name", () => {
			expect(result).toContain("Alice");
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
});
