import type { Dirent } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { parseAllowedSkills } from "../agent/skill-permissions";
import type { Config } from "../config";
import type { createChannelRepository } from "../db/repositories/channels";
import type { createUserRepository } from "../db/repositories/users";
import type { createWaGroupRepository } from "../db/repositories/wa-groups";
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
  return join(getOrgSkillsDir(), id, "SKILL.md");
}

function workspaceSkillDir(dataDir: string, workspaceId: string, id: string): string {
  return join(workspaceRoot(dataDir), workspaceId, ".claude", "skills", id);
}

function workspaceSkillMdPath(dataDir: string, workspaceId: string, id: string): string {
  return join(workspaceSkillDir(dataDir, workspaceId, id), "SKILL.md");
}

function renderFrontMatterString(value: string): string {
  // JSON string escaping is compatible with double-quoted YAML scalars for our simple metadata fields.
  return JSON.stringify(value);
}

function renderSkillMd(data: {
  name: string;
  description: string;
  category: string;
  body: string;
  org_enabled?: boolean;
}): string {
  const fm = [
    "---",
    `name: ${renderFrontMatterString(data.name)}`,
    `description: ${renderFrontMatterString(data.description)}`,
    `category: ${renderFrontMatterString(data.category)}`,
    `org_enabled: ${data.org_enabled ?? true}`,
    "---",
    "",
  ].join("\n");
  const body = data.body.trim() ? data.body.trimEnd() : "";
  return fm + body + (body.endsWith("\n") || body === "" ? "" : "\n");
}

interface SkillsDeps {
  channelRepo: ReturnType<typeof createChannelRepository>;
  waGroupRepo: ReturnType<typeof createWaGroupRepository>;
  userRepo: ReturnType<typeof createUserRepository>;
}

export function skillsRoutes(config: Pick<Config, "DATA_DIR">, deps: SkillsDeps) {
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
      org_enabled?: boolean;
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
    const orgEnabled = typeof body.org_enabled === "boolean" ? body.org_enabled : true;
    const md = renderSkillMd({
      name: body.name.trim(),
      description,
      category,
      body: body.body,
      org_enabled: orgEnabled,
    });

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
      org_enabled?: boolean;
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
    const orgEnabled = typeof body.org_enabled === "boolean" ? body.org_enabled : base.org_enabled;
    const md = renderSkillMd({
      name: body.name.trim(),
      description,
      category,
      body: body.body,
      org_enabled: orgEnabled,
    });

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

  routes.patch("/:id/permissions", async (c) => {
    const id = assertSkillId(c.req.param("id"));
    if (!id) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid skill id" } }, 400);

    const body = (await c.req.json().catch(() => null)) as {
      channels?: { id: string; enabled: boolean }[];
      users?: { id: string; enabled: boolean }[];
    } | null;

    if (!body) {
      return c.json({ error: { code: "BAD_REQUEST", message: "Invalid request body" } }, 400);
    }

    const channelEntries = body.channels ?? [];
    const userEntries = body.users ?? [];

    // Sync channel/group permissions: add or remove this skill ID from each entity's allowed_skills
    for (const entry of channelEntries) {
      // Try slack channel first, then wa group
      const slackCh = await deps.channelRepo.findById(entry.id);
      if (slackCh) {
        const current = parseAllowedSkills(slackCh.allowed_skills);
        const next = syncSkillInList(current, id, entry.enabled);
        if (next !== current) await deps.channelRepo.updateAllowedSkills(entry.id, next);
        continue;
      }
      const waGroup = await deps.waGroupRepo.findById(entry.id);
      if (waGroup) {
        const current = parseAllowedSkills(waGroup.allowed_skills);
        const next = syncSkillInList(current, id, entry.enabled);
        if (next !== current) await deps.waGroupRepo.updateAllowedSkills(entry.id, next);
      }
    }

    // Sync user permissions
    for (const entry of userEntries) {
      const user = await deps.userRepo.findById(entry.id);
      if (!user) continue;
      const current = parseAllowedSkills(user.allowed_skills);
      const next = syncSkillInList(current, id, entry.enabled);
      if (next !== current) await deps.userRepo.updateAllowedSkills(entry.id, next);
    }

    return c.json({ success: true });
  });

  return routes;
}

/**
 * Returns the updated allowed_skills list after adding/removing a skill ID.
 * `null` means unrestricted — adding a skill to an unrestricted entity is a no-op,
 * but removing one converts it to an explicit list of all-minus-one.
 * Returns the same reference if no change is needed.
 */
function syncSkillInList(current: string[] | null, skillId: string, enabled: boolean): string[] | null {
  if (current === null) {
    // Unrestricted — adding is a no-op; we can't remove from "all" without
    // knowing the full skill list, so treat null as "no change needed"
    return null;
  }
  const has = current.includes(skillId);
  if (enabled && !has) return [...current, skillId];
  if (!enabled && has) return current.filter((s) => s !== skillId);
  return current;
}
