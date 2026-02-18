import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../config.js";

export async function ensureWorkspace(config: Config, userId: string): Promise<string> {
	const workspaceDir = join(config.DATA_DIR, "workspaces", userId);
	await mkdir(workspaceDir, { recursive: true });
	return workspaceDir;
}
