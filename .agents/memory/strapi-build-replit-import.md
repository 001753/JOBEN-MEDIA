---
name: Strapi build/ protection on Replit import
description: Replit import agent deletes build/ (Strapi admin) as "obsolete artifacts" — must re-run strapi build and commit after every fresh import.
---

# Strapi `build/` Deleted by Replit Import Agent

## The Rule
After every fresh GitHub import into Replit, check that `build/` exists at the project root. If missing, run `strapi build` (or `npm run build:all`) and commit + push before deploying.

**Why:** The Replit import agent makes an automatic commit titled "Remove obsolete build artifacts" that deletes `build/` (the Strapi admin panel bundle). This project intentionally commits `build/` because cPanel shared hosting cannot run `strapi build` due to resource limits.

**How to apply:**
1. After import, run `git log --oneline -5` and look for "Remove obsolete build artifacts".
2. If present, run `npm run build:all` — but STOP running workflows first (`strapi develop` will interfere and clean `build/` between build steps).
3. Verify `build/` exists with `ls build/ | wc -l` (expect ~300+ files).
4. `git add build/ frontend/next-build.tar.gz && git commit -m "build: restore after import" && git push`.

## Symptoms
- `cms.news.jobenapp.cloud/admin` shows cPanel default page or "404 not found".
- `deploy.sh` warns: `⚠️ Strapi admin build/ tidak lengkap — /admin mungkin error`.
- `git log` shows commit "Remove obsolete build artifacts" after last known-good build commit.

## Why strapi develop interferes
Running `strapi develop` concurrently with `strapi build` causes `build/` to be cleaned mid-build. Always stop CMS workflow before running `npm run build:all`.
