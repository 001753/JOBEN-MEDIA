---
name: Strapi sharp native module on cPanel
description: sharp fails to load on cPanel Node 22 after npm rebuild — must use npm install (not rebuild) to get prebuilt binary
---

# Sharp Native Module on cPanel Shared Hosting

## The Rule
Never use `npm rebuild sharp` on cPanel. Use `npm install --no-save sharp` (without `--ignore-scripts`) instead.

**Why:** cPanel shared hosting (CloudLinux) does not have `libvips` development headers, so `npm rebuild sharp` fails silently — exit code 0, says "rebuilt dependencies successfully", but the binary is broken. `npm install sharp` triggers sharp's postinstall script which downloads a prebuilt binary for the current Node.js version and platform.

**How to apply:** In any deploy script that handles native modules after extracting a node_modules tarball:
```bash
# WRONG - silently produces incompatible binary on cPanel
npm rebuild sharp

# CORRECT - downloads prebuilt binary for current Node ABI
npm install --no-save --no-fund --no-audit sharp
```

After install, verify with: `node -e "require('sharp'); console.log('sharp OK')"`

## Context
- node_modules tarball is built on Replit (Node 20), server runs Node 22 → ABI mismatch
- sharp v0.34.x uses prebuilt binaries from `@img/sharp-linux-x64` package
- `better-sqlite3` can still use `npm rebuild` (it compiles fast, no libvips dependency)
- Error message: `Could not load the "sharp" module using the linux-x64 runtime`
- This error causes Strapi to crash at startup (before binding to port), so LiteSpeed serves "It works! NodeJS X.X.X" placeholder page instead
