import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inferNameFromBody, loadClaudeSkillsFromDir, loadProjectClaudeSkills, parseFrontMatter } from "./loader";

describe("parseFrontMatter", () => {
  it("returns empty frontmatter when no frontmatter present", () => {
    const result = parseFrontMatter("Hello world");
    expect(result.frontMatter).toEqual({});
    expect(result.body).toBe("Hello world");
  });

  it("returns empty frontmatter when frontmatter is empty", () => {
    const result = parseFrontMatter("-----\n---\nContent");
    expect(result.frontMatter).toEqual({});
    expect(result.body).toBe("Content");
  });

  it("parses frontmatter with all fields", () => {
    const input = "---\nname: Test Skill\ndescription: A test skill\ncategory: crm\n---\nBody content here";
    const result = parseFrontMatter(input);
    expect(result.frontMatter).toEqual({
      name: "Test Skill",
      description: "A test skill",
      category: "crm",
    });
    expect(result.body).toBe("Body content here");
  });

  it("handles missing closing --- gracefully", () => {
    const result = parseFrontMatter("---\nname: Test\nNo closing delimiter");
    expect(result.frontMatter).toEqual({});
    expect(result.body).toBe("---\nname: Test\nNo closing delimiter");
  });

  it("rejects invalid category", () => {
    const input = "---\ncategory: invalid\n---\nBody";
    const result = parseFrontMatter(input);
    expect(result.frontMatter.category).toBeUndefined();
    expect(result.body).toBe("Body");
  });

  it("accepts all valid categories", () => {
    const categories: Array<"crm" | "comms" | "research" | "ops" | "productivity"> = [
      "crm",
      "comms",
      "research",
      "ops",
      "productivity",
    ];
    for (const cat of categories) {
      const input = `-----\ncategory: ${cat}\n---\nBody`;
      const result = parseFrontMatter(input);
      expect(result.frontMatter.category).toBe(cat);
    }
  });

  it("ignores malformed lines in frontmatter", () => {
    const input = "---\nno-colon\nkey: value\n:missing key\n---\nBody";
    const result = parseFrontMatter(input);
    expect(result.frontMatter).toEqual({});
  });

  it("trims whitespace from keys and values", () => {
    const input = "---\n  name  :  Test Skill  \ndescription:  A test  \n---\nBody";
    const result = parseFrontMatter(input);
    expect(result.frontMatter.name).toBe("Test Skill");
    expect(result.frontMatter.description).toBe("A test");
  });
});

describe("inferNameFromBody", () => {
  it("extracts name from single # heading", () => {
    const body = "# My Skill\n\nSome content";
    expect(inferNameFromBody(body)).toBe("My Skill");
  });

  it("extracts name from # heading not on first line", () => {
    const body = "Some text\n# Heading";
    expect(inferNameFromBody(body)).toBe("Heading");
  });

  it("returns first heading when multiple exist", () => {
    const body = "# First\n# Second";
    expect(inferNameFromBody(body)).toBe("First");
  });

  it("returns null when no heading present", () => {
    const body = "Just content without heading";
    expect(inferNameFromBody(body)).toBeNull();
  });

  it("trims whitespace from heading", () => {
    const body = "#   Trimmed  \nText";
    expect(inferNameFromBody(body)).toBe("Trimmed");
  });

  it("returns null for empty body", () => {
    expect(inferNameFromBody("")).toBeNull();
  });

  it("handles body with only whitespace", () => {
    expect(inferNameFromBody("   \n\n   ")).toBeNull();
  });
});

describe("loadProjectClaudeSkills", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = (await mkdir(join(tmpdir(), `sketch-skills-test-${Date.now()}`), { recursive: true })) as string;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function writeSkill(skillId: string, content: string) {
    const skillDir = join(tempDir, ".claude", "skills", skillId);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.MD"), content, "utf-8");
  }

  it("returns empty array when skills directory doesn't exist", async () => {
    const result = loadProjectClaudeSkills(join(tempDir, "nonexistent"));
    expect(result).toEqual([]);
  });

  it("returns empty array when skills directory is empty", async () => {
    await mkdir(join(tempDir, ".claude", "skills"), { recursive: true });
    const result = loadProjectClaudeSkills(tempDir);
    expect(result).toEqual([]);
  });

  it("skips entries that are files, not directories", async () => {
    const skillsDir = join(tempDir, ".claude", "skills");
    await mkdir(skillsDir, { recursive: true });
    await writeFile(join(skillsDir, "skill.txt"), "content", "utf-8");
    const result = loadProjectClaudeSkills(tempDir);
    expect(result).toEqual([]);
  });

  it("skips directories without SKILL.MD", async () => {
    const skillDir = join(tempDir, ".claude", "skills", "skill1");
    await mkdir(skillDir, { recursive: true });
    const result = loadProjectClaudeSkills(tempDir);
    expect(result).toEqual([]);
  });

  it("loads single skill with full frontmatter", async () => {
    await writeSkill(
      "test-skill",
      "---\nname: Test Skill\ndescription: A test skill\ncategory: crm\n---\nSkill body content",
    );

    const result = loadProjectClaudeSkills(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "test-skill",
      name: "Test Skill",
      description: "A test skill",
      category: "crm",
      body: "Skill body content",
    });
  });

  it("frontmatter name takes precedence over inferred name", async () => {
    await writeSkill("my-skill", "---\nname: Frontmatter Name\n---\n# Different Name\nBody");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].name).toBe("Frontmatter Name");
  });

  it("infers name from body when no frontmatter name", async () => {
    await writeSkill("inferred-skill", "# Inferred Name\n\nBody content");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].name).toBe("Inferred Name");
    expect(result[0].category).toBe("productivity");
  });

  it("defaults category to productivity when missing", async () => {
    await writeSkill("skill1", "---\nname: Test\n---\nBody");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].category).toBe("productivity");
  });

  it("defaults to folder name when no frontmatter and no heading", async () => {
    await writeSkill("folder-name-skill", "Just some body content without heading");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].name).toBe("folder-name-skill");
  });

  it("loads multiple skills", async () => {
    await writeSkill("skill1", "---\nname: Skill One\ncategory: crm\n---\nBody 1");
    await writeSkill("skill2", "---\nname: Skill Two\ncategory: comms\n---\nBody 2");
    await writeSkill("skill3", "# Skill Three\n\nBody 3");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id)).toEqual(["skill1", "skill2", "skill3"]);
  });

  it("defaults invalid category to productivity", async () => {
    await writeSkill("bad-category", "---\ncategory: not-valid\n---\nBody");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].category).toBe("productivity");
  });

  it("handles empty category field", async () => {
    await writeSkill("empty-cat", "---\ncategory:\n---\nBody");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].category).toBe("productivity");
  });

  it("handles skill with empty body", async () => {
    await writeSkill("empty-body", "---\nname: Empty\n---\n");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].body).toBe("");
  });

  it("handles skill with special characters in folder name", async () => {
    await writeSkill("skill-with-dashes_underscores", "# Special Skill\n\nContent");

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].id).toBe("skill-with-dashes_underscores");
    expect(result[0].name).toBe("Special Skill");
  });

  it("is idempotent - calling twice returns same results", async () => {
    await writeSkill("idempotent-skill", "---\nname: Test\n---\nBody");

    const result1 = loadProjectClaudeSkills(tempDir);
    const result2 = loadProjectClaudeSkills(tempDir);

    expect(result1).toEqual(result2);
    expect(result1[0].id).toBe(result2[0].id);
    expect(result1[0].name).toBe(result2[0].name);
    expect(result1[0].body).toBe(result2[0].body);
  });

  it("is idempotent with multiple skills", async () => {
    await writeSkill("skill-a", "---\nname: A\n---\nBody A");
    await writeSkill("skill-b", "---\nname: B\n---\nBody B");

    const result1 = loadProjectClaudeSkills(tempDir);
    const result2 = loadProjectClaudeSkills(tempDir);

    expect(result1).toEqual(result2);
    expect(result1.length).toBe(2);
  });

  it("handles missing SKILL.MD gracefully (file exists check)", async () => {
    const skillDir = join(tempDir, ".claude", "skills", "no-md");
    await mkdir(skillDir, { recursive: true });

    const result = loadProjectClaudeSkills(tempDir);
    expect(result).toEqual([]);
  });

  it("preserves full body content including multiline", async () => {
    const body = `---
name: Multi
---
# Title

## Section 1
Content here

## Section 2
More content`;
    await writeSkill("multi-line", body);

    const result = loadProjectClaudeSkills(tempDir);
    expect(result[0].body).toContain("## Section 1");
    expect(result[0].body).toContain("Content here");
  });
});

describe("loadClaudeSkillsFromDir", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = (await mkdir(join(tmpdir(), `sketch-skills-root-test-${Date.now()}`), {
      recursive: true,
    })) as string;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeSkillAtRoot(skillId: string, content: string) {
    const skillDir = join(tempDir, skillId);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.MD"), content, "utf-8");
  }

  it("returns empty array when directory does not exist", () => {
    const result = loadClaudeSkillsFromDir(join(tempDir, "missing"));
    expect(result).toEqual([]);
  });

  it("loads skills directly from a skills root directory", async () => {
    await writeSkillAtRoot(
      "root-skill",
      "---\nname: Root Skill\ndescription: From root\ncategory: ops\n---\nBody from root",
    );

    const result = loadClaudeSkillsFromDir(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "root-skill",
      name: "Root Skill",
      description: "From root",
      category: "ops",
      body: "Body from root",
    });
  });

  it("skips entries that are not directories at root level", async () => {
    await writeFile(join(tempDir, "README.md"), "not a skill", "utf-8");
    const result = loadClaudeSkillsFromDir(tempDir);
    expect(result).toEqual([]);
  });
});
