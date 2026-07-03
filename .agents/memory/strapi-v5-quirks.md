---
name: Strapi v5 setup quirks
description: Non-obvious gotchas discovered when setting up Strapi v5.50.0 in Replit
---

## Key quirks

**esbuild not installed as transitive dep**: `npm install` for @strapi/strapi@5.50.0 does NOT pull in esbuild automatically. Add it explicitly as a dependency or it throws `Cannot find module 'esbuild'` at startup.

**@strapi/plugin-i18n removed in v5**: Package does not exist at ^5.x. i18n is built into Strapi v5 core — remove from package.json completely.

**Admin config must be in `config/admin.js`**: Strapi v5 expects `apiToken.salt`, `transfer.token.salt`, `secrets.encryptionKey` in `config/admin.js` — NOT `config/app.js`. Using `app.js` produces deprecation warnings saying it reads env vars directly.

**S3 provider: options must be inside `s3Options`**: `@strapi/provider-upload-aws-s3@5.x` requires all AWS SDK options wrapped in `s3Options: {}` inside `providerOptions`. Flat keys at root produce deprecation warning.

**strapi::cors: no `enabled` field**: Strapi v5 dropped the `enabled` option in cors middleware config. Just list it in the middlewares array to activate; `enabled: true` produces a warning.

**PORT env var**: Replit webview requires port 5000. Set `PORT=5000` in env vars; Strapi's `config/server.js` reads it via `env.int('PORT', 1337)`.

**Author → User relation must be unidirectional**: Cannot use `inversedBy: "author"` pointing to `plugin::users-permissions.user` because the User model doesn't have an `author` attribute. Use a plain unidirectional `oneToOne` relation (no `inversedBy`).

**Node.js version**: Strapi v5.50.0 requires Node >=20. Node 18 fails with `Array.prototype.toSorted is not a function`. After upgrading to nodejs-20 module, run `npm rebuild better-sqlite3` to recompile native addon.

**Lifecycle result does not populate relations**: In `afterCreate`/`afterUpdate`/`afterDelete`, `event.result` only contains direct fields — NOT related data (category.slug, author.name, etc.). Must do a separate `strapi.db.query().findOne({ populate: ... })` inside the lifecycle if related data is needed (e.g., for webhook payload).

**Admin create-user CLI**: `node_modules/.bin/strapi admin:create-user` can run while app is also running (SQLite allows it). Returns "User already exists" if email is taken.

**Bootstrap public permissions**: Set in `src/index.js` bootstrap() via `strapi.query('plugin::users-permissions.permission').create(...)`. Make it idempotent by checking existing permissions first — runs on every startup but skips if already configured.

**Why:** Discovered during initial Strapi startup failures and feature build on Replit — each error required a separate fix cycle.
