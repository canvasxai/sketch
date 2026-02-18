# Sketch

An org-level AI assistant. One deployment, multiple users — each with their own workspace, memory, and tool integrations.

Think of it as a shared Claude Cowork for teams, accessible through the messaging platforms you already use.

## Why

Personal AI assistants are powerful but isolated. Each person runs their own setup, manages their own context, connects their own tools. There's no shared knowledge, no shared infrastructure, no way for an org to give everyone access to a capable AI assistant without each person becoming a power user.

Sketch bridges this gap. Deploy once for your team. Everyone gets:

- **Isolated workspaces** — personal file operations, memory, and sessions that don't leak between users
- **Shared org knowledge** — upload documents once, available to everyone's assistant
- **Per-user tool auth** — each person connects their own Gmail, GitHub, Jira, etc
- **Multi-channel access** — Slack and WhatsApp, same assistant everywhere

## How It Works

Sketch runs as a single Node.js process. When a user messages the bot:

1. Resolve who they are (Slack ID → user account)
2. Route to their isolated workspace (`data/workspaces/{user_id}/`)
3. Run a Claude agent with workspace-scoped file access and tool permissions
4. Send the response back in the same channel

## Quick Start

Requires Node.js 22+ and pnpm.

```bash
git clone https://github.com/AskSketch/sketch.git
cd sketch
pnpm install
cp .env.example .env
# Edit .env with your API keys and Slack tokens
pnpm dev
```

See `.env.example` for all configuration options including Bedrock, Vertex, and custom provider support.

## License

MIT
