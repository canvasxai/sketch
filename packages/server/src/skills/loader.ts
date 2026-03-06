import { type Dirent, readFileSync, readdirSync, statSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { type SkillCategory, skillCategoryValueSet } from "@sketch/shared";

const SKILL_FILE_NAME = "SKILL.md";
const LEGACY_SKILL_FILE_NAME = "SKILL.MD";

export type LoadedSkillCategory = SkillCategory;

export interface LoadedSkill {
  id: string;
  name: string;
  description: string;
  body: string;
  category: LoadedSkillCategory;
  org_enabled: boolean;
}

interface FrontMatter {
  name?: string;
  description?: string;
  category?: LoadedSkillCategory;
  org_enabled?: boolean;
}

function readSkillMarkdownSync(skillDir: string): string | null {
  for (const fileName of [SKILL_FILE_NAME, LEGACY_SKILL_FILE_NAME]) {
    try {
      return readFileSync(join(skillDir, fileName), "utf-8");
    } catch {}
  }

  return null;
}

async function readSkillMarkdownAsync(skillDir: string): Promise<string | null> {
  for (const fileName of [SKILL_FILE_NAME, LEGACY_SKILL_FILE_NAME]) {
    try {
      return await readFile(join(skillDir, fileName), "utf-8");
    } catch {}
  }

  return null;
}

function isLoadedCategory(value: string): value is LoadedSkillCategory {
  return skillCategoryValueSet.has(value);
}

function parseFrontMatterScalar(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch {
      return value;
    }
  }

  return value;
}

export function parseFrontMatter(md: string): { frontMatter: FrontMatter; body: string } {
  if (!md.startsWith("---")) return { frontMatter: {}, body: md.trim() };

  const end = md.indexOf("\n---", 3);
  if (end === -1) return { frontMatter: {}, body: md.trim() };

  const raw = md.slice(3, end).trim();
  const body = md.slice(end + 4).trim();

  const fm: FrontMatter = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = parseFrontMatterScalar(line.slice(idx + 1).trim());
    if (!key) continue;
    if (key === "name") fm.name = value;
    if (key === "description") fm.description = value;
    if (key === "category" && isLoadedCategory(value)) fm.category = value;
    if (key === "org_enabled") fm.org_enabled = value === "true";
  }

  return { frontMatter: fm, body };
}

export function inferNameFromBody(body: string): string | null {
  const lines = body.split("\n");
  for (const line of lines) {
    const m = /^#\s+(.+)$/.exec(line.trim());
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Core loader for Claude skills under a given skills root directory.
 *
 * Notes:
 * - Each skill is a folder; folder name becomes the skill `id`.
 * - Optional YAML-like frontmatter supports: name, description, category.
 * - If frontmatter is missing, `name` defaults to the folder name and
 *   `description` is empty.
 */
export function loadClaudeSkillsFromDir(dir: string): LoadedSkill[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const out: LoadedSkill[] = [];

  for (const entry of entries) {
    const skillDir = join(dir, entry);
    try {
      if (!statSync(skillDir).isDirectory()) continue;
    } catch {
      continue;
    }

    const md = readSkillMarkdownSync(skillDir);
    if (md === null) continue;

    const { frontMatter, body } = parseFrontMatter(md);
    const inferredName = frontMatter.name ? null : inferNameFromBody(body);

    out.push({
      id: entry,
      name: frontMatter.name ?? inferredName ?? entry,
      description: frontMatter.description ?? "",
      category: frontMatter.category ?? "productivity",
      org_enabled: frontMatter.org_enabled ?? true,
      body,
    });
  }

  return out;
}

export async function loadClaudeSkillsFromDirAsync(dir: string): Promise<LoadedSkill[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const md = await readSkillMarkdownAsync(join(dir, entry.name));
        if (md === null) return null;

        const { frontMatter, body } = parseFrontMatter(md);
        const inferredName = frontMatter.name ? null : inferNameFromBody(body);

        return {
          id: entry.name,
          name: frontMatter.name ?? inferredName ?? entry.name,
          description: frontMatter.description ?? "",
          category: frontMatter.category ?? "productivity",
          org_enabled: frontMatter.org_enabled ?? true,
          body,
        } satisfies LoadedSkill;
      }),
  );

  return skills.filter((skill): skill is LoadedSkill => skill !== null);
}

/**
 * Loads project skills from `{repoRoot}/.claude/skills/<skill>/SKILL.md`.
 *
 * This is a thin wrapper around `loadClaudeSkillsFromDir` that preserves the
 * previous API used in tests and any legacy callers.
 */
export function loadProjectClaudeSkills(repoRoot: string): LoadedSkill[] {
  const dir = join(repoRoot, ".claude", "skills");
  return loadClaudeSkillsFromDir(dir);
}

export async function loadProjectClaudeSkillsAsync(repoRoot: string): Promise<LoadedSkill[]> {
  const dir = join(repoRoot, ".claude", "skills");
  return loadClaudeSkillsFromDirAsync(dir);
}
