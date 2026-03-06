import { Hono } from "hono";
import { parseAllowedSkills, validateSkillIds } from "../agent/skill-permissions";
import type { createChannelRepository } from "../db/repositories/channels";
import type { createWaGroupRepository } from "../db/repositories/wa-groups";
import type { SlackBot } from "../slack/bot";
import type { WhatsAppBot } from "../whatsapp/bot";

interface ChannelDeps {
  whatsapp?: WhatsAppBot;
  getSlack?: () => SlackBot | null;
  onSlackDisconnect?: () => Promise<void>;
  channelRepo?: ReturnType<typeof createChannelRepository>;
  waGroupRepo?: ReturnType<typeof createWaGroupRepository>;
}

export function channelRoutes(deps: ChannelDeps) {
  const routes = new Hono();

  routes.get("/status", (c) => {
    const slackBot = deps.getSlack?.() ?? null;
    const slackConfigured = !!slackBot;

    const channels = [
      {
        platform: "slack" as const,
        configured: slackConfigured,
        connected: slackConfigured ? true : null,
        phoneNumber: null,
      },
      {
        platform: "whatsapp" as const,
        configured: deps.whatsapp?.isConnected ?? false,
        connected: deps.whatsapp?.isConnected ? true : null,
        phoneNumber: deps.whatsapp?.phoneNumber ?? null,
      },
    ];

    return c.json({ channels });
  });

  routes.delete("/slack", async (c) => {
    const slackBot = deps.getSlack?.() ?? null;
    if (!slackBot) {
      return c.json({ error: { code: "NOT_CONFIGURED", message: "Slack is not configured" } }, 400);
    }
    await deps.onSlackDisconnect?.();
    return c.json({ success: true });
  });

  // --- Slack channels ---

  routes.get("/slack/list", async (c) => {
    if (!deps.channelRepo) {
      return c.json({ error: { code: "NOT_CONFIGURED", message: "Channel repository not available" } }, 500);
    }

    const rows = await deps.channelRepo.listAll();
    const channels = rows.map((row) => ({
      ...row,
      allowed_skills: parseAllowedSkills(row.allowed_skills),
    }));

    return c.json({ channels });
  });

  routes.patch("/slack/:id", async (c) => {
    if (!deps.channelRepo) {
      return c.json({ error: { code: "NOT_CONFIGURED", message: "Channel repository not available" } }, 500);
    }

    const id = c.req.param("id");
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

    const channel = await deps.channelRepo.findById(id);
    if (!channel) {
      return c.json({ error: { code: "NOT_FOUND", message: "Channel not found" } }, 404);
    }

    await deps.channelRepo.updateAllowedSkills(id, allowed_skills);

    const updated = await deps.channelRepo.findById(id);
    return c.json({
      channel: {
        ...updated,
        allowed_skills: updated ? parseAllowedSkills(updated.allowed_skills) : null,
      },
    });
  });

  // --- WhatsApp groups ---

  routes.get("/whatsapp/groups", async (c) => {
    if (!deps.waGroupRepo) {
      return c.json({ error: { code: "NOT_CONFIGURED", message: "WhatsApp groups repository not available" } }, 500);
    }

    const rows = await deps.waGroupRepo.listAll();
    const groups = rows.map((row) => ({
      ...row,
      allowed_skills: parseAllowedSkills(row.allowed_skills),
    }));

    return c.json({ groups });
  });

  routes.patch("/whatsapp/groups/:id", async (c) => {
    if (!deps.waGroupRepo) {
      return c.json({ error: { code: "NOT_CONFIGURED", message: "WhatsApp groups repository not available" } }, 500);
    }

    const id = c.req.param("id");
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

    const group = await deps.waGroupRepo.findById(id);
    if (!group) {
      return c.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, 404);
    }

    await deps.waGroupRepo.updateAllowedSkills(id, allowed_skills);

    const updated = await deps.waGroupRepo.findById(id);
    return c.json({
      group: {
        ...updated,
        allowed_skills: updated ? parseAllowedSkills(updated.allowed_skills) : null,
      },
    });
  });

  return routes;
}
