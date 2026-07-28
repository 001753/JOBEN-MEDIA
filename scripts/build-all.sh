#!/usr/bin/env bash
# scripts/build-all.sh
#
# Build Strapi (admin panel) dan Next.js (frontend) sekaligus di Replit,
# supaya hasil build bisa di-commit & di-push ke GitHub, lalu cPanel
# tinggal `git pull` + restart TANPA build ulang (menghindari limit
# resource di shared hosting).
#
# Jalankan sebelum setiap `git push` ke branch yang dipakai cPanel:
#   npm run build:all

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$APP_DIR/frontend"

echo "[build-all] Build Strapi admin panel..."
(cd "$APP_DIR" && NODE_ENV=production npm run build)

echo "[build-all] Build Next.js frontend..."
(cd "$FRONTEND_DIR" && NODE_ENV=production npm run build)

# ── Tulis commit hash ke .build_commit ────────────────────────────────────────
# deploy.sh di cPanel membaca file ini untuk verifikasi sinkronisasi build.
COMMIT=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
echo "$COMMIT" > "$FRONTEND_DIR/.next/.build_commit"
echo "[build-all] Build commit: ${COMMIT:0:12} → frontend/.next/.build_commit"

# ── Pack frontend/.next/ → frontend/next-build.tar.gz ─────────────────────────
# .next/ di-ignore di .gitignore (cleanup agent tidak akan menyentuh tar.gz).
# deploy.sh di cPanel mengekstrak file ini sebelum verifikasi artifacts.
echo "[build-all] Pack frontend/.next/ → frontend/next-build.tar.gz ..."
tar -czf "$FRONTEND_DIR/next-build.tar.gz" \
  --exclude='.next/cache' \
  -C "$FRONTEND_DIR" .next/
TARSIZE=$(du -sh "$FRONTEND_DIR/next-build.tar.gz" 2>/dev/null | cut -f1)
echo "[build-all] next-build.tar.gz: $TARSIZE"

echo ""
echo "[build-all] ✅ Selesai! Sekarang commit & push hasil build:"
echo "  git add -A"
echo "  git commit -m \"build: update production build $(date +%Y-%m-%d)\""
echo "  git push origin main"
echo "  → lalu di cPanel SSH: bash deploy.sh"
