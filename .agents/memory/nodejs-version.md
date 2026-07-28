---
name: Node.js version requirement
description: Strapi 5.50 requires Node.js 20+; running on 18 causes toSorted crash
---

**Rule:** Always use Node.js 20 on Replit for this project. Strapi 5.50 calls `Array.prototype.toSorted` which was introduced in Node.js 20.

**Why:** Running `strapi develop` on Node.js 18 crashes immediately with `TypeError: schema.tables.toSorted is not a function` in `@strapi/database/dist/schema/storage.js`.

**How to apply:** `.replit` must have `modules = ["nodejs-20", ...]`. If it shows nodejs-18, upgrade via `installProgrammingLanguage({ language: "nodejs-20" })` and reinstall all node_modules after.

**cPanel note:** cPanel server has Node.js 22 available via `/home/smknwon2/nodevenv/public_html/news/22/bin/activate` (not 20). Both 20 and 22 work fine — package.json allows `<=22.x.x`.
