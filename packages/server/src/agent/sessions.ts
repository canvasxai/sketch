/**
 * Persists the Claude Agent SDK session ID per user workspace.
 * The SDK manages actual session data — we just track which session to resume.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SESSION_FILE = "session.json";

export async function getSessionId(workspaceDir: string): Promise<string | undefined> {
	try {
		const data = await readFile(join(workspaceDir, SESSION_FILE), "utf-8");
		const parsed = JSON.parse(data);
		return parsed.sessionId;
	} catch {
		return undefined;
	}
}

export async function saveSessionId(workspaceDir: string, sessionId: string): Promise<void> {
	await writeFile(join(workspaceDir, SESSION_FILE), JSON.stringify({ sessionId }));
}
