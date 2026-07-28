---
name: cPanel deploy flow
description: Builds happen on Replit, committed to git; cPanel only does git pull + npm install --ignore-scripts
---

**Rule:** Never run `strapi build` or `next build` on the cPanel server. Build artifacts (`build/` for Strapi admin, `frontend/.next/` for Next.js) are built on Replit and committed to git.

**Why:** cPanel shared hosting has resource limits that prevent native binary compilation. `@swc/core` (used by Next.js) and esbuild (used by Strapi) need platform-native binaries — installing them on Replit (Linux x64) produces the correct binaries for cPanel (same platform). Running `npm install` without `--ignore-scripts` on cPanel causes `@swc/core: Failed to load native binding` because the binaries were built for Replit's environment.

**Correct deploy flow:**
1. Replit: `npm run build:all` → builds Strapi admin + Next.js
2. Replit: `git add -A && git commit -m "build: ..." && git push`
3. cPanel SSH: `bash deploy.sh` (git pull + npm install --omit=dev --ignore-scripts + restart)

**cPanel Node.js Selector:** App root for Strapi = `public_html/news-cms` (symlink to `public_html/news`), startup file = `server.js`. App root for frontend = `public_html/news`, startup file = `app.js`.

**Key env var issue:** cPanel Node.js Selector UI env vars OVERRIDE `.env` file. DATABASE_CLIENT in cPanel UI must be set to `postgres` explicitly — it doesn't fall through to the `.env` file.
