/**
 * Users API — CRUD for managing team members.
 * Primary use case: admin adds WhatsApp users so they can message the bot.
 * Slack users are auto-created on first DM and appear here as read-only.
 */
import { Hono } from "hono";
import { z } from "zod";
import { parseAllowedSkills, validateSkillIds } from "../agent/skill-permissions";
import type { createUserRepository } from "../db/repositories/users";

type UserRepo = ReturnType<typeof createUserRepository>;

const whatsappNumberSchema = z
  .string()
  .min(8, "Phone number must be at least 8 characters")
  .startsWith("+", "Phone number must start with +");

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  whatsappNumber: whatsappNumberSchema,
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  whatsappNumber: whatsappNumberSchema.nullable().optional(),
});

export function userRoutes(users: UserRepo) {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const list = await users.list();
    return c.json({
      users: list.map((u) => ({ ...u, allowed_skills: parseAllowedSkills(u.allowed_skills) })),
    });
  });

  routes.post("/", async (c) => {
    const body = await c.req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      return c.json({ error: { code: "VALIDATION_ERROR", message } }, 400);
    }

    try {
      const user = await users.create({
        name: parsed.data.name,
        whatsappNumber: parsed.data.whatsappNumber,
      });
      return c.json({ user: { ...user, allowed_skills: parseAllowedSkills(user.allowed_skills) } }, 201);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        return c.json({ error: { code: "CONFLICT", message: "This number is already linked to another member" } }, 409);
      }
      throw err;
    }
  });

  routes.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await users.findById(id);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
    }

    const body = await c.req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      return c.json({ error: { code: "VALIDATION_ERROR", message } }, 400);
    }

    try {
      const user = await users.update(id, {
        name: parsed.data.name,
        whatsappNumber: parsed.data.whatsappNumber,
      });
      return c.json({ user: { ...user, allowed_skills: parseAllowedSkills(user.allowed_skills) } });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        return c.json({ error: { code: "CONFLICT", message: "This number is already linked to another member" } }, 409);
      }
      throw err;
    }
  });

  routes.patch("/:id/skills", async (c) => {
    const id = c.req.param("id");
    const existing = await users.findById(id);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
    }

    const body = (await c.req.json().catch(() => null)) as {
      allowed_skills?: string[] | null;
    } | null;

    if (!body || !("allowed_skills" in body)) {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing allowed_skills field" } }, 400);
    }

    const { allowed_skills } = body;

    if (allowed_skills !== null) {
      if (!Array.isArray(allowed_skills) || !allowed_skills.every((s) => typeof s === "string")) {
        return c.json(
          { error: { code: "BAD_REQUEST", message: "allowed_skills must be an array of strings or null" } },
          400,
        );
      }

      const unknown = await validateSkillIds(allowed_skills);
      if (unknown.length > 0) {
        return c.json({ error: { code: "BAD_REQUEST", message: `Unknown skill(s): ${unknown.join(", ")}` } }, 400);
      }
    }

    await users.updateAllowedSkills(id, allowed_skills);
    const updated = await users.findById(id);
    return c.json({
      user: updated ? { ...updated, allowed_skills: parseAllowedSkills(updated.allowed_skills) } : null,
    });
  });

  routes.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await users.findById(id);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
    }
    await users.remove(id);
    return c.json({ success: true });
  });

  return routes;
}
