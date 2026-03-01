# Self-Hosting Guide

Sketch runs as a single Node.js process — the API server and web UI are served together. No separate web server or database server required.

## Prerequisites

- **Node.js 24+** (LTS)
- **pnpm** (`npm install -g pnpm`)
- **build-essential** (Linux) or Xcode CLI tools (macOS) — needed for native modules

## Quick Start

```bash
git clone https://github.com/canvasxai/sketch.git
cd sketch
cp .env.example .env
pnpm install
pnpm build
node packages/server/dist/index.js
```

Open `http://localhost:3000` — the onboarding wizard will walk you through creating an admin account, naming your bot, connecting channels, and configuring an LLM provider.

## Configuration

All configuration is in `.env` at the repo root.

```bash
# Database — SQLite by default, no setup needed
DB_TYPE=sqlite
SQLITE_PATH=./data/sketch.db

# Server
DATA_DIR=./data
PORT=3000
LOG_LEVEL=info          # debug | info | warn | error
```

LLM credentials, Slack tokens, and WhatsApp pairing are configured through the web UI during onboarding (stored in the database, not `.env`).

## Production Deployment

### systemd Service

Create `/etc/systemd/system/sketch.service`:

```ini
[Unit]
Description=Sketch AI Assistant
After=network.target

[Service]
Type=simple
User=sketch
WorkingDirectory=/opt/sketch
ExecStart=/usr/bin/node packages/server/dist/index.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/sketch/.env

[Install]
WantedBy=multi-user.target
```

> **Note:** The `node` path in `ExecStart` must match your installation. If using nvm/fnm, use the full path (e.g., `/home/ubuntu/.local/share/fnm/node-versions/v24.13.1/installation/bin/node`). The Claude Agent SDK spawns subprocesses that also need `node` on PATH — add it to `Environment=PATH=...` if needed.

```bash
sudo systemctl daemon-reload
sudo systemctl enable sketch
sudo systemctl start sketch
```

### Reverse Proxy with Caddy (recommended)

Caddy provides automatic HTTPS with zero configuration.

[Install Caddy](https://caddyserver.com/docs/install), then create `/etc/caddy/Caddyfile`:

```
sketch.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

Caddy will automatically obtain and renew TLS certificates via Let's Encrypt. Make sure your DNS A record points to the server and ports 80/443 are open in your firewall.

## Updating

```bash
cd /opt/sketch
git pull
pnpm install
pnpm build
sudo systemctl restart sketch
```

Database migrations run automatically on startup.

## Data

All runtime data lives in `DATA_DIR` (default `./data/`):

- `sketch.db` — SQLite database (users, settings, credentials)
- `workspaces/{user_id}/` — per-user agent workspaces (files, session state, memory)

**Back up `data/` regularly.** The database contains credentials (hashed admin password, encrypted API keys, WhatsApp auth state).

## LLM Providers

Configured via the web UI during onboarding. Supported providers:

| Provider | What you need |
|----------|--------------|
| **Anthropic API** | API key from console.anthropic.com |
| **AWS Bedrock** | Access key, secret key, region with Claude model access enabled |

The selected provider and credentials are stored in the database and applied to the agent subprocess at runtime.

## Channels

### Slack

1. Create a Slack app at api.slack.com/apps using the manifest shown during onboarding
2. Install to your workspace
3. Enter the Bot Token (`xoxb-...`) and App-Level Token (`xapp-...`) in the UI

### WhatsApp

1. Click "Pair" on the Channels page
2. Scan the QR code with WhatsApp on your phone (Linked Devices)
3. Add team members on the Team page — only listed numbers can message the bot

## Troubleshooting

**Port already in use** — Change `PORT` in `.env`.

**Agent not responding** — Check LLM credentials in Settings. The agent subprocess needs `node` on PATH.

**WhatsApp disconnects** — The bot reconnects automatically with exponential backoff. If logged out from the phone, re-pair from the Channels page.

**Logs** — `journalctl -u sketch -f` for systemd, or set `LOG_LEVEL=debug` in `.env` for verbose output.
