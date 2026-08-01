---
name: Strapi sharp native module on cPanel
description: sharp fails on cPanel because of x86-64-v2 CPU check + missing @emnapi/runtime — must detect SSE4.2, choose native vs wasm32, AND install @emnapi/runtime with wasm32
---

# Sharp Native Module on cPanel Shared Hosting

## The Rule
Deploy script must detect SSE4.2 CPU support BEFORE choosing which @img binary to download.
When installing wasm32, ALSO install `@emnapi/runtime` (transitive dep not included in tarball).
Never run `npm rebuild sharp` on cPanel. Never suppress sharp's stderr with `2>/dev/null`.

**Why (root cause, verified via binary analysis sharp@0.34.5):**

1. **x86-64-v2 microarchitecture trap (primary cause):**
   `sharp/lib/sharp.js` tries paths in order: local build → local wasm → `@img/sharp-linux-x64` → `@img/sharp-wasm32`.
   It `break`s on first success. If `@img/sharp-linux-x64` loads, it calls `sharp._isUsingX64V2()` (CPUID check).
   If the cPanel VM doesn't expose SSE4.2 in `/proc/cpuinfo`, `_isUsingX64V2() = false` → `sharp = null` → throw.
   The loop already broke at path 3, so path 4 (`@img/sharp-wasm32`) is NEVER tried — even if installed.

2. **Error silenced:** old code used `2>/dev/null` which hid the full stack trace.

3. **libvips version fallback wrong:** old fallback was `1.1.0` but `sharp@0.34.5` requires `1.2.4`.

4. **@emnapi/runtime missing when wasm32 used (BUG 4, fixed last):**
   `@img/sharp-wasm32/package.json` declares `"dependencies": {"@emnapi/runtime": "^1.7.0"}`.
   `_download_img_pkg` only extracts the tarball — does NOT install transitive deps.
   Result: wasm32 loads → `require('@emnapi/runtime')` → `MODULE_NOT_FOUND` → ALL paths fail →
   sharp throws `"Could not load the 'sharp' module using the linux-x64 runtime"`.
   **The "linux-x64" in the error is the generic platform string, NOT an indication linux-x64 was tried.**
   This error is misleading: the actual failure is wasm32 crashing on missing @emnapi/runtime.
   Fix: `_install_emnapi_runtime()` called after EVERY wasm32 install (both paths).

## Fix (implemented in deploy.sh)
```bash
# Detect SSE4.2 BEFORE choosing binary
if grep -qw 'sse4_2' /proc/cpuinfo; then
  # install @img/sharp-linux-x64 + @img/sharp-libvips-linux-x64 (native, fast)
  # Runtime cross-check: if CPUID masking → rm -rf @img, fallback to wasm32
else
  # install @img/sharp-wasm32 ONLY — DO NOT install x64
  # If x64 exists → sharp.js breaks at path 3 → V2 fails → throws without trying wasm32
  # If x64 absent → path 3 = MODULE_NOT_FOUND → loop continues → path 4 (wasm32) = success
fi
# After EVERY wasm32 install — install @emnapi/runtime too:
_install_emnapi_runtime "$_SH_NM"  # reads version from @img/sharp-wasm32/package.json
```

**How to apply:** Any future change to wasm32 install paths MUST call `_install_emnapi_runtime` afterwards.
tslib (dep of @emnapi/runtime) is already present in node_modules — no need to install separately.

## Package structure (verified)
- `@img/sharp-linux-x64@0.34.5` tgz = 178KB, binary at `lib/sharp-linux-x64.node` (402KB)
- RPATH: `$ORIGIN/../../sharp-libvips-linux-x64/lib` (correct relative path)
- NEEDED: `libvips-cpp.so.8.17.3` (exact filename, matches `@img/sharp-libvips-linux-x64@1.2.4`)
- glibc requirement: max GLIBC_2.17 (compatible with CentOS 7+), GLIBCXX_3.4.21 (GCC 5.1+)
- `@img/sharp-wasm32@0.34.5` tgz = ~7MB (10MB unpacked), includes bundled libvips — no separate libvips needed
- `@emnapi/runtime@^1.7.0` (latest: 1.11.3), deps: only tslib (already in node_modules)

## Nested sharp issue (known, not blocking Strapi start)
`@strapi/upload/node_modules/sharp@0.33.5` needs `@img/sharp-linux-x64@0.33.5` + `@img/sharp-libvips-linux-x64@1.0.4`.
The top-level `@img/` has v0.34.5 (or wasm32). Version mismatch may cause Strapi image upload to fail silently.
Fix: also populate `@strapi/upload/node_modules/@img/` with 0.33.5 packages if needed.
