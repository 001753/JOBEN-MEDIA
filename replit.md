# JOBEN NEWS

A monorepo news portal consisting of a **Strapi v5 CMS** backend and a **Next.js 15** frontend.

## Stack

| Layer     | Tech                     | Port  |
|-----------|--------------------------|-------|
| CMS       | Strapi v5 (SQLite dev)   | 3001  |
| Frontend  | Next.js 15 (App Router)  | 5000  |
| Storage   | Cloudflare R2 (optional) | —     |

## Running the project

Two workflows are configured:

- **Start CMS** — runs `npm run develop` from the root. Strapi admin available at the CMS console port.
- **Start application** — runs `cd frontend && npm run dev`. Frontend visible in the webview.

Start the CMS first; the frontend fetches articles from it at `http://localhost:3001`.

## Environment variables

All secrets and env vars are stored as Replit Secrets/env vars (not in `.env` files).

Key variables:
- `PORT=3001`, `HOST=0.0.0.0` — Strapi listen address
- `DATABASE_CLIENT=sqlite`, `DATABASE_FILENAME=.tmp/data.db` — SQLite for dev
- `APP_KEYS`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT` — Strapi security keys
- `REVALIDATION_SECRET` — shared between CMS and frontend for ISR revalidation
- `STRAPI_API_TOKEN` — set this in `frontend/.env.local` after creating a token in the Strapi admin

For production, add Cloudflare R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) and switch `DATABASE_CLIENT` to `postgres`.

## Node.js version

Node.js **20** is required (Strapi 5.50 uses `Array.prototype.toSorted`). The project runs on Node.js 20.20.0.

## First-time Strapi admin setup

On first run Strapi prompts you to create an administrator account at the admin panel URL. After that, go to **Settings → API Tokens** to create a Read-only token and paste it into `frontend/.env.local` as `STRAPI_API_TOKEN`.

## User preferences

- Keep existing project structure — do not restructure or migrate the monorepo layout.
- Install frontend dependencies with `--ignore-scripts` flag.
