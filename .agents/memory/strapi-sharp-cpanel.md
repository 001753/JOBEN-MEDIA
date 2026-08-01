---
name: Strapi sharp native module on cPanel
description: sharp fails on cPanel because of x86-64-v2 CPU check + error silenced — must detect SSE4.2 and choose native vs wasm32 binary
---

# Sharp Native Module on cPanel Shared Hosting

## The Rule
Deploy script must detect SSE4.2 CPU support BEFORE choosing which @img binary to download.
Never run `npm rebuild sharp` on cPanel. Never suppress sharp's stderr with `2>/dev/null`.

**Why (root cause, verified via binary analysis sharp@0.34.5):**

1. **x86-64-v2 microarchitecture trap (primary cause):**
   `sharp/lib/sharp.js` tries paths in order: local build → local wasm → `@img/sharp-linux-x64` → `@img/sharp-wasm32`.
   It `break`s on first success. If `@img/sharp-linux-x64` loads, it calls `sharp._isUsingX64V2()` (CPUID check).
   If the cPanel VM doesn't expose SSE4.2 in `/proc/cpuinfo`, `_isUsingX64V2() = false` → `sharp = null` → throw.
   The loop already broke at path 3, so path 4 (`@img/sharp-wasm32`) is NEVER tried — even if installed.

2. **Error silenced:** old code used `2>/dev/null` which hid the full stack trace.

3. **libvips version fallback wrong:** old fallback was `1.1.0` but `sharp@0.34.5` requires `1.2.4`.

## Fix (implemented in deploy.sh)
```bash
# Detect SSE4.2 BEFORE choosing binary
if grep -qw 'sse4_2' /proc/cpuinfo; then
  # install @img/sharp-linux-x64 + @img/sharp-libvips-linux-x64 (native, fast)
else
  # install @img/sharp-wasm32 ONLY — DO NOT install x64
  # If x64 exists → sharp.js breaks at path 3 → V2 fails → throws without trying wasm32
  # If x64 absent → path 3 = MODULE_NOT_FOUND → loop continues → path 4 (wasm32) = success
fi
# Capture stderr for diagnostics
_SHARP_ERR=$( (cd "$APP_DIR" && "$_SH_NODE" -e "require('sharp')") 2>&1 )
```

**How to apply:** Any change to the sharp install section in deploy.sh must preserve the SSE4.2 detection logic.

## Package structure (verified)
- `@img/sharp-linux-x64@0.34.5` tgz = 178KB, 4 files, binary at `lib/sharp-linux-x64.node` (402KB)
- RPATH: `$ORIGIN/../../sharp-libvips-linux-x64/lib` (correct relative path from `@img/sharp-linux-x64/lib/`)
- NEEDED: `libvips-cpp.so.8.17.3` (exact filename, matches what `@img/sharp-libvips-linux-x64@1.2.4` provides)
- glibc requirement: max GLIBC_2.17 (compatible with CentOS 7+)
- GLIBCXX_3.4.21 (requires GCC 5.1+ libstdc++; ok on AlmaLinux 8+)
- `@img/sharp-wasm32@0.34.5` tgz = ~7MB (10MB unpacked), includes bundled libvips — no separate libvips needed

## Nested sharp issue (known, not blocking Strapi start)
`@strapi/upload/node_modules/sharp@0.33.5` needs `@img/sharp-linux-x64@0.33.5` + `@img/sharp-libvips-linux-x64@1.0.4`.
The top-level `@img/` has v0.34.5 (or wasm32). Version mismatch may cause Strapi image upload to fail silently.
Fix: also populate `@strapi/upload/node_modules/@img/` with 0.33.5 packages if needed.
