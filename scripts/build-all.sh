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

echo "[build-all] Build Strapi (backend)..."
NODE_ENV=production npm run build

echo "[build-all] Build Next.js (frontend)..."
cd frontend
npm run build
cd ..

echo "[build-all] Selesai. Sekarang commit & push hasil build:"
echo "  git add -A"
echo "  git commit -m \"build: update production build\""
echo "  git push origin main"
