import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

	describe("workspace-level sessions (DMs)", () => {
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

	describe("per-thread sessions (channels)", () => {
		it("saves and retrieves a thread session", async () => {
			tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

			await saveSessionId(tempDir, "sess_thread1", "1111.0000");
			const result = await getSessionId(tempDir, "1111.0000");

			expect(result).toBe("sess_thread1");
		});

		it("auto-creates sessions/ directory", async () => {
			tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

			await saveSessionId(tempDir, "sess_thread1", "1111.0000");
			const result = await getSessionId(tempDir, "1111.0000");

			expect(result).toBe("sess_thread1");
		});

		it("different threadTs values produce isolated sessions", async () => {
			tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

			await saveSessionId(tempDir, "sess_a", "1111.0000");
			await saveSessionId(tempDir, "sess_b", "2222.0000");

			expect(await getSessionId(tempDir, "1111.0000")).toBe("sess_a");
			expect(await getSessionId(tempDir, "2222.0000")).toBe("sess_b");
		});

		it("returns undefined for nonexistent thread session", async () => {
			tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

			const result = await getSessionId(tempDir, "9999.0000");

			expect(result).toBeUndefined();
		});

		it("corrupt thread session file returns undefined", async () => {
			tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));
			await saveSessionId(tempDir, "sess_valid", "1111.0000");
			await writeFile(join(tempDir, "sessions", "1111.0000.json"), "broken json");

			const result = await getSessionId(tempDir, "1111.0000");

			expect(result).toBeUndefined();
		});

		it("thread session does not interfere with workspace session", async () => {
			tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

			await saveSessionId(tempDir, "sess_dm");
			await saveSessionId(tempDir, "sess_thread", "1111.0000");

			expect(await getSessionId(tempDir)).toBe("sess_dm");
			expect(await getSessionId(tempDir, "1111.0000")).toBe("sess_thread");
		});

		it("overwrites previous thread session ID", async () => {
			tempDir = await mkdtemp(join(tmpdir(), "sketch-session-"));

			await saveSessionId(tempDir, "old", "1111.0000");
			await saveSessionId(tempDir, "new", "1111.0000");

			expect(await getSessionId(tempDir, "1111.0000")).toBe("new");
		});
	});
});
