import { homedir } from "node:os";
import { join } from "node:path";
import { loadClaudeSkillsFromDirAsync } from "../skills/loader";

/**
 * Parses the raw `allowed_skills` column value (JSON TEXT or NULL) into
 * a typed array. Returns `null` when there is no restriction (all skills allowed).
 */
export function parseAllowedSkills(raw: string | null | undefined): string[] | null {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return null;
  }
}

/**
 * Validates skill IDs against the org's installed skills.
 * Returns the list of IDs that do NOT exist in the org.
 */
export async function validateSkillIds(allowedSkills: string[]): Promise<string[]> {
  const orgSkillsDir = join(homedir(), ".claude", "skills");
  const orgSkills = await loadClaudeSkillsFromDirAsync(orgSkillsDir);
  const orgSkillIds = new Set(orgSkills.map((s) => s.id));
  return allowedSkills.filter((s) => !orgSkillIds.has(s));
}
