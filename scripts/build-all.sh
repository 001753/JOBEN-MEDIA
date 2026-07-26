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

echo "[build-all] Build Strapi admin panel..."
NODE_ENV=production npm run build

echo "[build-all] Build Next.js frontend..."
cd frontend
NODE_ENV=production npm run build
cd ..

# ── Tulis commit hash ke .build_commit ────────────────────────────────────────
# deploy.sh di cPanel membaca file ini untuk verifikasi sinkronisasi build.
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

echo "$COMMIT" > frontend/.next/.build_commit
echo "[build-all] Build commit: ${COMMIT:0:12} → frontend/.next/.build_commit"

echo ""
echo "[build-all] ✅ Selesai! Sekarang commit & push hasil build:"
echo "  git add -A"
echo "  git commit -m \"build: update production build $(date +%Y-%m-%d)\""
echo "  git push origin main"
echo "  → lalu di cPanel SSH: bash deploy.sh"
