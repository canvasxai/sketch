import type { Dirent } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import type { Config } from "../config";
import { type LoadedSkill, loadClaudeSkillsFromDirAsync } from "../skills/loader";

function getOrgSkillsDir(): string {
  return join(homedir(), ".claude", "skills");
}

function loadOrgSkills(): Promise<LoadedSkill[]> {
  return loadClaudeSkillsFromDirAsync(getOrgSkillsDir());
}

interface WorkspaceSkill {
  workspaceId: string;
  skill: LoadedSkill;
}

function workspaceRoot(dataDir: string): string {
  return join(dataDir, "workspaces");
}

async function loadWorkspaceSkills(dataDir: string): Promise<WorkspaceSkill[]> {
  const skillsRoot = workspaceRoot(dataDir);

  let entries: Dirent<string>[];
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const skillsByWorkspace = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const skillsDir = join(skillsRoot, entry.name, ".claude", "skills");
        const skills = await loadClaudeSkillsFromDirAsync(skillsDir);
        return skills.map((skill) => ({ workspaceId: entry.name, skill }));
      }),
  );

  return skillsByWorkspace.flat();
}

function assertSkillId(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  // Prevent traversal and keep folder names predictable
  if (!/^[a-z0-9][a-z0-9-_]{0,63}$/i.test(trimmed)) return null;
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return null;
  return trimmed;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function orgSkillMdPath(id: string): string {
  return join(getOrgSkillsDir(), id, "SKILL.MD");
}

function workspaceSkillDir(dataDir: string, workspaceId: string, id: string): string {
  return join(workspaceRoot(dataDir), workspaceId, ".claude", "skills", id);
}

function workspaceSkillMdPath(dataDir: string, workspaceId: string, id: string): string {
  return join(workspaceSkillDir(dataDir, workspaceId, id), "SKILL.MD");
}

function renderFrontMatterString(value: string): string {
  // JSON string escaping is compatible with double-quoted YAML scalars for our simple metadata fields.
  return JSON.stringify(value);
}

function renderSkillMd(data: { name: string; description: string; category: string; body: string }): string {
  const fm = [
    "---",
    `name: ${renderFrontMatterString(data.name)}`,
    `description: ${renderFrontMatterString(data.description)}`,
    `category: ${renderFrontMatterString(data.category)}`,
    "---",
    "",
  ].join("\n");
  const body = data.body.trim() ? data.body.trimEnd() : "";
  return fm + body + (body.endsWith("\n") || body === "" ? "" : "\n");
}

export function skillsRoutes(config: Pick<Config, "DATA_DIR">) {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const orgSkills = await loadOrgSkills();
    const workspaceSkills = await loadWorkspaceSkills(config.DATA_DIR);

    const byId = new Map<string, LoadedSkill>();

    for (const skill of orgSkills) {
      byId.set(skill.id, skill);
    }

    for (const { skill } of workspaceSkills) {
      if (!byId.has(skill.id)) {
        byId.set(skill.id, skill);
      }
    }

    return c.json({ skills: Array.from(byId.values()) });
  });

  routes.get("/:id", async (c) => {
    const id = assertSkillId(c.req.param("id"));
    if (!id) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const orgSkills = await loadOrgSkills();
    const workspaceSkills = await loadWorkspaceSkills(config.DATA_DIR);

    const all: LoadedSkill[] = [
      ...orgSkills,
      ...workspaceSkills
        // Prefer org definitions when ids collide
        .filter(({ skill }) => !orgSkills.some((s) => s.id === skill.id))
        .map(({ skill }) => skill),
    ];

    const skill = all.find((s) => s.id === id);
    if (!skill) return c.json({ error: { code: "NOT_FOUND", message: "Skill not found" } }, 404);
    return c.json({ skill });
  });

  routes.post("/", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      name?: string;
      description?: string;
      category?: string;
      body?: string;
      id?: string;
    } | null;

    if (!body || typeof body.name !== "string" || typeof body.body !== "string") {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing required fields" } }, 400);
    }

    const baseId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : slugify(body.name);
    const normalizedBase = assertSkillId(baseId);
    if (!normalizedBase) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const existingOrg = new Set((await loadOrgSkills()).map((s) => s.id));
    let id = normalizedBase;
    let suffix = 2;
    while (existingOrg.has(id)) {
      id = `${normalizedBase}-${suffix}`;
      suffix += 1;
    }

    const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : "productivity";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const md = renderSkillMd({ name: body.name.trim(), description, category, body: body.body });

    const skillDir = join(getOrgSkillsDir(), id);
    await mkdir(skillDir, { recursive: true });
    await writeFile(orgSkillMdPath(id), md, "utf-8");

    const skill = (await loadOrgSkills()).find((s) => s.id === id) ?? null;
    if (!skill) return c.json({ error: { code: "UNKNOWN", message: "Failed to create skill" } }, 500);
    return c.json({ skill }, 201);
  });

  routes.put("/:id", async (c) => {
    const id = assertSkillId(c.req.param("id"));
    if (!id) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const body = (await c.req.json().catch(() => null)) as {
      name?: string;
      description?: string;
      category?: string;
      body?: string;
    } | null;

    if (!body || typeof body.name !== "string" || typeof body.body !== "string") {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing required fields" } }, 400);
    }

    const orgSkills = await loadOrgSkills();
    const workspaceSkills = await loadWorkspaceSkills(config.DATA_DIR);

    const existingOrg = orgSkills.find((s) => s.id === id);
    const existingWorkspace = workspaceSkills.find(({ skill }) => skill.id === id);

    if (!existingOrg && !existingWorkspace) {
      return c.json({ error: { code: "NOT_FOUND", message: "Skill not found" } }, 404);
    }

    let base: LoadedSkill;
    if (existingOrg) {
      base = existingOrg;
    } else if (existingWorkspace) {
      base = existingWorkspace.skill;
    } else {
      return c.json({ error: { code: "UNKNOWN", message: "Skill not found after lookup" } }, 500);
    }

    const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : base.category;
    const description = typeof body.description === "string" ? body.description.trim() : base.description;
    const md = renderSkillMd({ name: body.name.trim(), description, category, body: body.body });

    if (existingOrg) {
      await writeFile(orgSkillMdPath(id), md, "utf-8");
    } else if (existingWorkspace) {
      await writeFile(workspaceSkillMdPath(config.DATA_DIR, existingWorkspace.workspaceId, id), md, "utf-8");
    }

    const orgAfter = await loadOrgSkills();
    const workspaceAfter = await loadWorkspaceSkills(config.DATA_DIR);
    const updated =
      orgAfter.find((s) => s.id === id) ?? workspaceAfter.find(({ skill }) => skill.id === id)?.skill ?? null;
    if (!updated) return c.json({ error: { code: "UNKNOWN", message: "Failed to update skill" } }, 500);
    return c.json({ skill: updated });
  });

  routes.delete("/:id", async (c) => {
    const id = assertSkillId(c.req.param("id"));
    if (!id) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const orgSkills = await loadOrgSkills();
    const workspaceSkills = await loadWorkspaceSkills(config.DATA_DIR);

    const existingOrg = orgSkills.find((s) => s.id === id);
    const existingWorkspace = workspaceSkills.find(({ skill }) => skill.id === id);

    if (!existingOrg && !existingWorkspace) {
      return c.json({ error: { code: "NOT_FOUND", message: "Skill not found" } }, 404);
    }

    if (existingOrg) {
      const skillDir = join(getOrgSkillsDir(), id);
      await rm(skillDir, { recursive: true, force: true });
    } else if (existingWorkspace) {
      const skillDir = workspaceSkillDir(config.DATA_DIR, existingWorkspace.workspaceId, id);
      await rm(skillDir, { recursive: true, force: true });
    }
    return c.json({ success: true });
  });

  return routes;
}
