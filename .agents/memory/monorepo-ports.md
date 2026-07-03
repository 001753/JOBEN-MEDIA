---
name: Monorepo port layout
description: Port assignments and gotchas for the JOBEN NEWS monorepo (Strapi + Next.js in one repo)
---

## Port assignments
- **Strapi CMS**: port `3001` — workflow "Start CMS", outputType "console"
- **Next.js Frontend**: port `5000` — workflow "Start application", outputType "webview" (Replit preview)

## Workflow commands
- Start CMS: `npm run develop` (runs from repo root)
- Start Frontend: `cd frontend && npm run dev` (Next.js uses -p 5000 hardcoded in package.json script)

## Env vars layout
- `PORT=3001` — shared, used by Strapi
- `STRAPI_API_URL=http://localhost:3001` — used by Next.js server-side fetch
- `NEXTJS_REVALIDATION_URL=http://localhost:5000/api/revalidate` — used by Strapi lifecycle hooks (dev)
- `NEXT_PUBLIC_SITE_URL=https://news.jobenapp.cloud` — used by Next.js for OG/metadata

## Next.js npm install gotcha
- `@strapi/blocks-react-renderer` has a `husky install` postinstall script that fails in Replit
- Must install with: `cd frontend && npm install --ignore-scripts --no-audit`
- Do NOT use plain `npm install` in frontend/

## Next.js layout gotcha
- Do NOT use explicit `<head>` tag in App Router `app/layout.js` — causes React hydration mismatch
- Use `export const metadata` for head tags; put `<Script>` components inside `<body>` instead

## Strapi admin access in Replit
- Strapi admin is at port 3001, NOT the main webview (port 5000 = Next.js)
- User accesses admin by switching to "Start CMS" workflow or visiting the Replit dev domain + :3001
- In production: admin at cms.news.jobenapp.cloud, frontend at news.jobenapp.cloud

## Why:
- Only port 5000 is mapped to external port 80 (Replit webview) — user sees frontend by default
- Strapi must be on a different port so both can run simultaneously
