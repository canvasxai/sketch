import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type LoadedSkillCategory = "crm" | "comms" | "research" | "ops" | "productivity";

export interface LoadedSkill {
  id: string;
  name: string;
  description: string;
  body: string;
  category: LoadedSkillCategory;
}

interface FrontMatter {
  name?: string;
  description?: string;
  category?: LoadedSkillCategory;
}

function isLoadedCategory(value: string): value is LoadedSkillCategory {
  return value === "crm" || value === "comms" || value === "research" || value === "ops" || value === "productivity";
}

function parseFrontMatter(md: string): { frontMatter: FrontMatter; body: string } {
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
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    if (key === "name") fm.name = value;
    if (key === "description") fm.description = value;
    if (key === "category" && isLoadedCategory(value)) fm.category = value;
  }

  return { frontMatter: fm, body };
}

function inferNameFromBody(body: string): string | null {
  const lines = body.split("\n");
  for (const line of lines) {
    const m = /^#\s+(.+)$/.exec(line.trim());
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Loads project skills from `{repoRoot}/.claude/skills/<skill>/SKILL.MD`.
 *
 * Notes:
 * - Each skill is a folder; folder name becomes the skill `id`.
 * - Optional YAML-like frontmatter supports: name, description, category.
 * - If frontmatter is missing, `name` defaults to the folder name and
 *   `description` is empty.
 */
export function loadProjectClaudeSkills(repoRoot: string): LoadedSkill[] {
  const dir = join(repoRoot, ".claude", "skills");

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

    const mdPath = join(skillDir, "SKILL.MD");

    let md: string;
    try {
      md = readFileSync(mdPath, "utf-8");
    } catch {
      continue;
    }

    const { frontMatter, body } = parseFrontMatter(md);
    const inferredName = frontMatter.name ? null : inferNameFromBody(body);

    out.push({
      id: entry,
      name: frontMatter.name ?? inferredName ?? entry,
      description: frontMatter.description ?? "",
      category: frontMatter.category ?? "productivity",
      body,
    });
  }

  return out;
}
