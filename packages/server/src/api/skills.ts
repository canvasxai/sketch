import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { type LoadedSkill, loadClaudeSkillsFromDir } from "../skills/loader";

function getRepoRoot(): string {
  // In dev, server runs with cwd = {repoRoot}/packages/server.
  // In prod, it also runs from the server package directory.
  // Going up two levels yields the repo root.
  return new URL("../../", `file://${process.cwd()}/`).pathname.replace(/\/$/, "");
}

function getOrgSkillsDir(): string {
  return join(homedir(), ".claude", "skills");
}

function loadOrgSkills(): LoadedSkill[] {
  return loadClaudeSkillsFromDir(getOrgSkillsDir());
}

interface WorkspaceSkill {
  workspaceId: string;
  skill: LoadedSkill;
}

function loadWorkspaceSkills(repoRoot: string): WorkspaceSkill[] {
  const workspaceRoot = join(repoRoot, "data", "workspaces");

  let entries: string[] = [];
  try {
    entries = readdirSync(workspaceRoot);
  } catch {
    return [];
  }

  const out: WorkspaceSkill[] = [];

  for (const entry of entries) {
    const wsDir = join(workspaceRoot, entry);
    try {
      if (!statSync(wsDir).isDirectory()) continue;
    } catch {
      continue;
    }

    const skillsDir = join(wsDir, ".claude", "skills");
    const skills = loadClaudeSkillsFromDir(skillsDir);
    for (const skill of skills) {
      out.push({ workspaceId: entry, skill });
    }
  }

  return out;
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

function workspaceSkillMdPath(repoRoot: string, workspaceId: string, id: string): string {
  return join(repoRoot, "data", "workspaces", workspaceId, ".claude", "skills", id, "SKILL.MD");
}

function renderSkillMd(data: { name: string; description: string; category: string; body: string }): string {
  const fm = [
    "---",
    `name: ${data.name}`,
    `description: ${data.description}`,
    `category: ${data.category}`,
    "---",
    "",
  ].join("\n");
  const body = data.body.trim() ? data.body.trimEnd() : "";
  return fm + body + (body.endsWith("\n") || body === "" ? "" : "\n");
}

export function skillsRoutes() {
  const routes = new Hono();

  routes.get("/", (c) => {
    const repoRoot = getRepoRoot();

    const orgSkills = loadOrgSkills();
    const workspaceSkills = loadWorkspaceSkills(repoRoot);

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

  routes.get("/:id", (c) => {
    const id = assertSkillId(c.req.param("id"));
    if (!id) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const repoRoot = getRepoRoot();
    const orgSkills = loadOrgSkills();
    const workspaceSkills = loadWorkspaceSkills(repoRoot);

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

    const repoRoot = getRepoRoot();
    const baseId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : slugify(body.name);
    const normalizedBase = assertSkillId(baseId);
    if (!normalizedBase) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const existingOrg = new Set(loadOrgSkills().map((s) => s.id));
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
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(orgSkillMdPath(id), md, "utf-8");

    const skill = loadOrgSkills().find((s) => s.id === id) ?? null;
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

    const repoRoot = getRepoRoot();
    const orgSkills = loadOrgSkills();
    const workspaceSkills = loadWorkspaceSkills(repoRoot);

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
      writeFileSync(orgSkillMdPath(id), md, "utf-8");
    } else if (existingWorkspace) {
      writeFileSync(workspaceSkillMdPath(repoRoot, existingWorkspace.workspaceId, id), md, "utf-8");
    }

    const orgAfter = loadOrgSkills();
    const workspaceAfter = loadWorkspaceSkills(repoRoot);
    const updated =
      orgAfter.find((s) => s.id === id) ?? workspaceAfter.find(({ skill }) => skill.id === id)?.skill ?? null;
    if (!updated) return c.json({ error: { code: "UNKNOWN", message: "Failed to update skill" } }, 500);
    return c.json({ skill: updated });
  });

  routes.delete("/:id", (c) => {
    const id = assertSkillId(c.req.param("id"));
    if (!id) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const repoRoot = getRepoRoot();
    const orgSkills = loadOrgSkills();
    const workspaceSkills = loadWorkspaceSkills(repoRoot);

    const existingOrg = orgSkills.find((s) => s.id === id);
    const existingWorkspace = workspaceSkills.find(({ skill }) => skill.id === id);

    if (!existingOrg && !existingWorkspace) {
      return c.json({ error: { code: "NOT_FOUND", message: "Skill not found" } }, 404);
    }

    if (existingOrg) {
      const skillDir = join(getOrgSkillsDir(), id);
      rmSync(skillDir, { recursive: true, force: true });
    } else if (existingWorkspace) {
      const skillDir = join(repoRoot, "data", "workspaces", existingWorkspace.workspaceId, ".claude", "skills", id);
      rmSync(skillDir, { recursive: true, force: true });
    }
    return c.json({ success: true });
  });

  return routes;
}
