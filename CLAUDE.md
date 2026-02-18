# Sketch

Org-level AI assistant — single deployment, multiple users, each with isolated workspace, memory, and tool auth. Multi-channel support (Slack now, WhatsApp planned).

## Architecture

- Single Node.js process: Hono HTTP server + Slack Bolt + agent runner
- Claude Agent SDK as agent runtime (built-in tools, sessions, compaction, MCP)
- Kysely query builder with SQLite (default), Postgres planned
- Workspace isolation via `canUseTool` path validation + system prompt enforcement
- `permissionMode: "default"` — all tool calls go through `canUseTool` (no `allowedTools` bypass)

## Tech Stack

TypeScript, Node.js 22, pnpm monorepo, Hono, Kysely, Biome, pino, zod, tsdown, tsx

## Project Structure

```
sketch/
  .env                  → config (repo root, gitignored)
  .env.example          → documented env vars
  data/                 → runtime data (gitignored)
    sketch.db           → SQLite database
    workspaces/{uid}/   → per-user workspace dirs
  .planning/            → internal dev docs (gitignored)
    PRODUCT.md          → full product document
    STATE.md            → current state + next steps
    STEEL_THREAD.md     → steel thread implementation plan (done)
  packages/
    server/src/
      index.ts          → entry point, wires everything
      config.ts         → zod + dotenv config validation
      logger.ts         → pino logger factory
      http.ts           → Hono app with /health
      queue.ts          → per-channel in-memory message queue
      slack/bot.ts      → Slack Bolt adapter (Socket Mode, DMs)
      agent/
        runner.ts       → runAgent() — Claude Agent SDK query() with canUseTool
        prompt.ts       → buildSystemContext() for platform rules + isolation
        workspace.ts    → ensureWorkspace() creates user dirs
        sessions.ts     → session ID persistence for resume
      db/
        index.ts        → createDatabase() with SQLite + WAL
        schema.ts       → DB type interface (users table)
        migrate.ts      → static migration imports (bundler-safe)
        migrations/     → Kysely migrations
        repositories/   → query functions (users.ts)
    shared/src/         → shared types (placeholder)
```

## Conventions

- Biome for linting and formatting (tabs, 120 line width)
- Strict TypeScript (`strict: true`)
- Conventional commits: `feat:`, `fix:`, `chore:`
- pino for structured JSON logging — never log message content
- zod + dotenv for config validation (`import "dotenv/config"`, .env at repo root)
- Kysely migrations run at app startup (static imports, not FileMigrationProvider)
- No unnecessary inline comments — prefer docstrings explaining decisions
- Vitest for testing (not yet set up)
- Run `pnpm dev` from repo root — tsx watches `packages/server/src/index.ts`

## Key Design Decisions

- Platform formatting via system prompt only, no post-processing
- Three-layer prompt: Claude Code preset → user's CLAUDE.md in workspace → platform/org context via `systemPrompt.append`
- Per-user workspace at `data/workspaces/{user_id}/` with session.json
- `canUseTool` validates all tool calls: file tools check path within workspace, Bash checks for absolute paths outside workspace, non-permitted tools denied
- `permissionMode: "default"` with no `allowedTools` — ensures `canUseTool` is always called (`allowedTools` bypasses `canUseTool`)
- In-memory per-channel message queue (sequential processing, one agent run at a time per channel)
- LLM access: Anthropic API, Bedrock (`CLAUDE_CODE_USE_BEDROCK`), Vertex, or custom `ANTHROPIC_BASE_URL`
- Static migration imports instead of FileMigrationProvider (for tsdown bundler compatibility)
- `CURRENT_TIMESTAMP` in migrations for cross-dialect compatibility (SQLite + Postgres)

## Dev Workflow

Internal planning docs live in `.planning/` (gitignored):

- **PRODUCT.md** — high-level product document. The "what and why". Evolves slowly.
- **STATE.md** — current project state, what's done, next steps, current version. Updated at end of each work session. Quick context resume for new sessions.
- **Task files** — one per feature/story (e.g., `STEEL_THREAD.md`, `WHATSAPP_ADAPTER.md`). Implementation plans with phases. Become historical reference once done.

Completed task files stay in `.planning/` — useful context when revisiting related areas.

## Reference

Full product document: `.planning/PRODUCT.md`
Current state: `.planning/STATE.md`
