import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking";

describe("chunkText", () => {
	it("returns single-element array for short text", () => {
		expect(chunkText("hello world")).toEqual(["hello world"]);
	});

	it("returns single-element array for empty string", () => {
		expect(chunkText("")).toEqual([""]);
	});

	it("returns single-element array for text exactly at limit", () => {
		const text = "a".repeat(4000);
		expect(chunkText(text)).toEqual([text]);
	});

	it("splits at last newline within window", () => {
		const line1 = "a".repeat(2000);
		const line2 = "b".repeat(2000);
		const line3 = "c".repeat(100);
		const text = `${line1}\n${line2}\n${line3}`;
		const chunks = chunkText(text);

		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe(line1);
		expect(chunks[1]).toBe(`${line2}\n${line3}`);
	});

	it("falls back to last whitespace when no newline in window", () => {
		const word1 = "a".repeat(3000);
		const word2 = "b".repeat(2000);
		const text = `${word1} ${word2}`;
		const chunks = chunkText(text);

		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe(word1);
		expect(chunks[1]).toBe(word2);
	});

	it("hard cuts when no whitespace in window", () => {
		const text = "a".repeat(5000);
		const chunks = chunkText(text);

		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe("a".repeat(4000));
		expect(chunks[1]).toBe("a".repeat(1000));
	});

	it("produces multiple chunks for very long text", () => {
		const lines = Array.from({ length: 10 }, (_, i) => `Line ${i}: ${"x".repeat(800)}`);
		const text = lines.join("\n");
		const chunks = chunkText(text);

		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(4000);
		}
		const joined = chunks.join("\n");
		expect(joined).toContain("Line 0");
		expect(joined).toContain("Line 9");
	});

	it("keeps list items together when possible", () => {
		const items = Array.from({ length: 5 }, (_, i) => `- Item ${i}: ${"description ".repeat(20)}`);
		const text = items.join("\n");
		const chunks = chunkText(text);

		for (const chunk of chunks) {
			expect(chunk[0]).not.toBe(" ");
		}
	});

	it("trims leading and trailing whitespace from chunks", () => {
		const part1 = "a".repeat(3990);
		const text = `${part1}\n   ${"b".repeat(100)}`;
		const chunks = chunkText(text);

		for (const chunk of chunks) {
			expect(chunk).toBe(chunk.trim());
		}
	});

	it("accepts custom limit parameter", () => {
		const text = "hello world foo bar";
		const chunks = chunkText(text, 10);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(10);
		}
	});
});
