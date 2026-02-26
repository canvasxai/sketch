import { describe, expect, it } from "vitest";
import { extractAssistantText } from "./runner";

describe("extractAssistantText", () => {
	it("extracts text from a standard assistant message", () => {
		const message = {
			type: "assistant",
			message: { content: [{ type: "text", text: "hello world" }] },
		};
		expect(extractAssistantText(message)).toBe("hello world");
	});

	it("returns null for non-assistant message types", () => {
		expect(extractAssistantText({ type: "system", subtype: "init", session_id: "abc" })).toBeNull();
		expect(extractAssistantText({ type: "result", session_id: "abc", total_cost_usd: 0 })).toBeNull();
		expect(extractAssistantText({ type: "user" })).toBeNull();
	});

	it("returns null when content is only tool_use blocks", () => {
		const message = {
			type: "assistant",
			message: {
				content: [{ type: "tool_use", id: "t1", name: "Read", input: {} }],
			},
		};
		expect(extractAssistantText(message)).toBeNull();
	});

	it("returns null when text is empty", () => {
		const message = {
			type: "assistant",
			message: { content: [{ type: "text", text: "" }] },
		};
		expect(extractAssistantText(message)).toBeNull();
	});

	it("returns null when text is only whitespace", () => {
		const message = {
			type: "assistant",
			message: { content: [{ type: "text", text: "   \n\t  " }] },
		};
		expect(extractAssistantText(message)).toBeNull();
	});

	it("extracts text from message with mixed text and tool_use blocks", () => {
		const message = {
			type: "assistant",
			message: {
				content: [
					{ type: "text", text: "Let me check that for you." },
					{ type: "tool_use", id: "t1", name: "Read", input: { file_path: "/foo" } },
				],
			},
		};
		expect(extractAssistantText(message)).toBe("Let me check that for you.");
	});

	it("concatenates multiple text blocks with newlines", () => {
		const message = {
			type: "assistant",
			message: {
				content: [
					{ type: "text", text: "First part." },
					{ type: "text", text: "Second part." },
				],
			},
		};
		expect(extractAssistantText(message)).toBe("First part.\nSecond part.");
	});

	it("returns null for null/undefined/primitive inputs", () => {
		expect(extractAssistantText(null)).toBeNull();
		expect(extractAssistantText(undefined)).toBeNull();
		expect(extractAssistantText("string")).toBeNull();
		expect(extractAssistantText(42)).toBeNull();
	});

	it("returns null when message property is missing", () => {
		expect(extractAssistantText({ type: "assistant" })).toBeNull();
	});

	it("returns null when content is not an array", () => {
		const message = {
			type: "assistant",
			message: { content: "not an array" },
		};
		expect(extractAssistantText(message)).toBeNull();
	});
});
