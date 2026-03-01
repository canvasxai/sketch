/**
 * Users API — CRUD for managing team members.
 * Primary use case: admin adds WhatsApp users so they can message the bot.
 * Slack users are auto-created on first DM and appear here as read-only.
 */
import { Hono } from "hono";
import { z } from "zod";
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
		return c.json({ users: list });
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
			return c.json({ user }, 201);
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
			return c.json({ user });
		} catch (err: unknown) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
				return c.json({ error: { code: "CONFLICT", message: "This number is already linked to another member" } }, 409);
			}
			throw err;
		}
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
