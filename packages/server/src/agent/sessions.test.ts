import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getSessionId, saveSessionId } from "./sessions";

describe("session persistence", () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("saveSessionId then getSessionId returns the same ID", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));
		const sessionId = "sess_abc123";

		await saveSessionId(tempDir, sessionId);
		const result = await getSessionId(tempDir);

		expect(result).toBe(sessionId);
	});

	it("getSessionId on nonexistent directory returns undefined", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));
		const nonexistent = join(tempDir, "does-not-exist");

		const result = await getSessionId(nonexistent);

		expect(result).toBeUndefined();
	});

	it("getSessionId on empty directory (no session.json) returns undefined", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

		const result = await getSessionId(tempDir);

		expect(result).toBeUndefined();
	});

	it("getSessionId with corrupt/invalid JSON in session.json returns undefined", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));
		await writeFile(join(tempDir, "session.json"), "not valid json {{{");

		const result = await getSessionId(tempDir);

		expect(result).toBeUndefined();
	});

	it("saveSessionId overwrites previous session ID", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

		await saveSessionId(tempDir, "id1");
		await saveSessionId(tempDir, "id2");
		const result = await getSessionId(tempDir);

		expect(result).toBe("id2");
	});
});
