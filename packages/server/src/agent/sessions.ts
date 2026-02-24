/**
 * Persists the Claude Agent SDK session ID per user workspace.
 * The SDK manages actual session data — we just track which session to resume.
 *
 * DMs use a single session.json per workspace. Channel interactions use per-thread
 * sessions at sessions/{threadTs}.json — each thread gets its own conversation
 * so threads in the same channel don't bleed into each other.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SESSION_FILE = "session.json";
const SESSIONS_DIR = "sessions";

function sessionPath(workspaceDir: string, threadTs?: string): string {
	if (threadTs) {
		return join(workspaceDir, SESSIONS_DIR, `${threadTs}.json`);
	}
	return join(workspaceDir, SESSION_FILE);
}

export async function getSessionId(workspaceDir: string, threadTs?: string): Promise<string | undefined> {
	try {
		const data = await readFile(sessionPath(workspaceDir, threadTs), "utf-8");
		const parsed = JSON.parse(data);
		return parsed.sessionId;
	} catch {
		return undefined;
	}
}

export async function saveSessionId(workspaceDir: string, sessionId: string, threadTs?: string): Promise<void> {
	if (threadTs) {
		await mkdir(join(workspaceDir, SESSIONS_DIR), { recursive: true });
	}
	await writeFile(sessionPath(workspaceDir, threadTs), JSON.stringify({ sessionId }));
}
