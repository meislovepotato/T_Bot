Environment variables & runtime notes

Purpose

- This file documents the environment variables required to run Wallet Alert Bot and gives quick setup steps for local development and deployment.

Required variables

- `BOT_TOKEN` — Telegram bot token (string). Example: `835...`.
- `ALCHEMY_WS` — WebSocket RPC URL for the blockchain provider. Example: `wss://base-mainnet.g.alchemy.com/v2/<KEY>`.
- `DATABASE_URL` — Prisma-compatible connection string. Examples:
  - MySQL: `mysql://user:password@host:3306/dbname`
  - Postgres: `postgresql://user:password@host:5432/dbname`

Optional variables

- `EXPLORER_BASE` — Base URL for transaction links (defaults to `https://basescan.org/tx/`).
- `MAX_CONCURRENT_FETCH` — Integer: maximum concurrent `getTransaction` RPC fetches (default: `5`).

Security & Best Practices

- Never commit `.env` to version control. Use `.env.example` for placeholders and documentation.
- Rotate `BOT_TOKEN` immediately if it has been committed or leaked.
- Use a secrets manager (Vault, cloud provider secrets, Render/Heroku config vars) in production; do not store credentials in plaintext on CI logs.

Local setup

```bash
cp .env.example .env
# edit .env with real values
npm install
# run in dev
npm run dev
# or build + start
npm run build && npm run start
```

Notes for reviewers

- The repo previously contained a real `BOT_TOKEN` in `.env`; ensure any leaked token has been rotated.
- The Zod schema (`src/config/env.ts`) validates `BOT_TOKEN` and `ALCHEMY_WS` at startup; missing/malformed values will cause process failure which is intentional to avoid running in misconfigured states.

Contact

- For deployment questions, consult the project maintainer for secrets provisioning.
