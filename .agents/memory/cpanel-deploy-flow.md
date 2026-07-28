---
name: cPanel deploy flow
description: How builds are prepared on Replit and deployed to cPanel without building on the server
---

# cPanel Deploy Flow

## Rule
Never run `strapi build` or `next build` on cPanel. All builds happen on Replit.

## Build flow (Replit)
1. Run `npm run build:all` — builds Strapi admin (`build/`) and Next.js (`frontend/.next/`)
2. `build-all.sh` automatically packs `frontend/.next/` (excluding cache) into `frontend/next-build.tar.gz` (~29MB)
3. `frontend/.next/.build_commit` is written inside the tarball with the current git HEAD
4. Commit with `git add -A` — `build/` and `frontend/next-build.tar.gz` are tracked; `frontend/.next/` is gitignored
5. Push via `gitPush({})` callback in CodeExecution (not bare `git push` — needs Replit OAuth)

## Deploy flow (cPanel SSH)
```bash
bash deploy.sh
```
- Step 1: `git reset --hard origin/main`
- Step 2: Extracts `node_modules-strapi.partaa/partab` → `node_modules/`; rebuilds native modules (sharp, better-sqlite3)
- NEW: Extracts `frontend/next-build.tar.gz` → `frontend/.next/` before verification
- Step 3: Verifies `build/` (Strapi admin) and `frontend/.next/BUILD_ID` (Next.js)
- Step 4: Restarts Passenger apps (frontend + Strapi via `~/public_html/strapi/server.js`)

## Why next-build.tar.gz instead of committing .next/ directly
Cleanup agents (auto-commits) repeatedly deleted `frontend/.next/` from git because they treat it as build noise. A binary `.tar.gz` file is never touched by cleanup agents.

**Why:** Binary files look like intentional assets; directory trees of JS/JSON files look like build artifacts to auto-cleanup logic.

## Key paths
- `frontend/next-build.tar.gz` — committed Next.js build (do NOT gitignore)
- `frontend/.next/` — gitignored (extracted on cPanel at deploy time)
- `build/` — Strapi admin panel (committed, not gitignored)
- `~/public_html/strapi/server.js` — thin wrapper pointing to `../news` for Strapi Passenger app
