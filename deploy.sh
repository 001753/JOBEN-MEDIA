#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Update JOBEN NEWS dari GitHub dan restart di cPanel
#
# Jalankan dari SSH cPanel di folder aplikasi:
#   cd ~/public_html/news
#   bash deploy.sh
#
# Yang dilakukan script ini:
#   1. Ambil perubahan terbaru dari GitHub (force reset)
#   2. Verifikasi build sudah sinkron dengan commit HEAD
#   3. Install dependencies (SKIP jika package.json tidak berubah)
#      — berlaku untuk root (Strapi) DAN frontend (Next.js)
#   4. Verifikasi build artifacts ada (build/ dan frontend/.next/)
#   5. Restart dua Passenger app:
#      - news.jobenapp.cloud      (startup: app.js → Next.js)
#      - cms.news.jobenapp.cloud  (startup: server.js → Strapi)
#
# Prasyarat:
#   - ~/public_html/news-cms adalah symlink ke ~/public_html/news
#   - .env sudah diisi di ~/public_html/news/.env
#   - frontend/.env.local sudah diisi di ~/public_html/news/frontend/.env.local
#   - Kedua Node.js app sudah terdaftar di cPanel Node.js Selector
# ─────────────────────────────────────────────────────────────────────────────

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$APP_DIR/frontend"
cd "$APP_DIR"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  JOBEN NEWS — Deploy Script"
echo "  Dir : $APP_DIR"
echo "  Date: $(date)"
echo "════════════════════════════════════════════════════════"
echo ""

# ── Setup PATH: nodevenv cPanel (aktifkan Node.js yang benar) ─────────────────
for _NDIR in \
  "$HOME/nodevenv/public_html/news/22/bin" \
  "$HOME/nodevenv/public_html/news-cms/22/bin" \
  "/opt/cpanel/ea-nodejs22/root/usr/bin" \
  "/opt/cpanel/ea-nodejs22/bin" \
  "/opt/cpanel/ea-nodejs20/root/usr/bin" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1)/bin"; do
  if [ -d "$_NDIR" ] && [[ ":$PATH:" != *":$_NDIR:"* ]]; then
    export PATH="$_NDIR:$PATH"
  fi
done

# Batasi thread — cegah RLIMIT_NPROC di shared hosting
export UV_THREADPOOL_SIZE=1
export RAYON_NUM_THREADS=1
export TOKIO_WORKER_THREADS=1
export npm_config_maxsockets=1
export NODE_OPTIONS="--max-old-space-size=256"

# ── 1. Git: fetch & reset ─────────────────────────────────────────────────────
echo "▶ [1/4] Git pull origin main ..."

git fetch origin
git reset --hard origin/main

CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo "  ✓ Kode diperbarui — HEAD: ${CURRENT_HEAD:0:12}"
echo ""

# ── 1b. Verifikasi sinkronisasi build vs commit ───────────────────────────────
# File .build_commit ditulis oleh scripts/build-all.sh saat build di Replit.
BUILD_COMMIT_FILE="$FRONTEND_DIR/.next/.build_commit"

if [ -f "$BUILD_COMMIT_FILE" ]; then
  BUILT_AT=$(cat "$BUILD_COMMIT_FILE" 2>/dev/null | tr -d '[:space:]')

  if [ "$CURRENT_HEAD" = "$BUILT_AT" ]; then
    echo "  ✓ Build sinkron dengan HEAD (${CURRENT_HEAD:0:12})"
  else
    # Hitung perubahan kode (bukan build artifacts / meta files)
    NON_BUILD_CHANGES=$(git diff --name-only "$BUILT_AT" "$CURRENT_HEAD" 2>/dev/null \
      | grep -v '^frontend/\.next/' \
      | grep -v '^build/' \
      | grep -v '^public/' \
      | grep -v '^\.' \
      | grep -v '^package-lock\.json$' \
      | grep -v '^deploy\.sh$' \
      | grep -v '^replit\.md$' \
      | grep -v '^README\.md$' \
      | grep -v '^attached_assets/' \
      | grep -v '^scripts/' \
      | grep -v '^doc/' \
      | grep -v '^\.agents/' \
      | grep -v '^\.gitignore$' \
      | wc -l | tr -d ' ')

    if [ "$NON_BUILD_CHANGES" = "0" ]; then
      echo "  ✓ Build valid — perubahan HEAD hanya di artifacts/meta (bukan kode)"
      echo "    (built: ${BUILT_AT:0:12} → HEAD: ${CURRENT_HEAD:0:12})"
    else
      echo ""
      echo "  ⚠️  ══════════════════════════════════════════════════════════"
      echo "  ⚠️  PERINGATAN: Build TIDAK sinkron dengan commit terbaru!"
      echo "  ⚠️  HEAD saat ini : ${CURRENT_HEAD:0:12}"
      echo "  ⚠️  Dibangun dari : ${BUILT_AT:0:12}"
      echo "  ⚠️  File kode belum di-build: $NON_BUILD_CHANGES file"
      echo "  ⚠️"
      echo "  ⚠️  Halaman produksi akan menampilkan versi LAMA."
      echo "  ⚠️"
      echo "  ⚠️  Solusi — jalankan di Replit:"
      echo "  ⚠️    npm run build:all"
      echo "  ⚠️    git add -A && git commit -m 'build: update production build'"
      echo "  ⚠️    git push origin main"
      echo "  ⚠️    → lalu jalankan bash deploy.sh lagi"
      echo "  ⚠️  ══════════════════════════════════════════════════════════"
      echo ""
    fi
  fi
else
  echo "  ⚠️  .build_commit belum ada — jalankan npm run build:all di Replit"
fi
echo ""

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo "▶ [2/4] Cek & install Node.js dependencies ..."

# Cari npm-cli.js langsung (bypass wrapper cPanel yang rawan crash)
find_npm_cli() {
  local ver; ver=$(node --version 2>/dev/null | tr -d 'v' | cut -d. -f1)
  for v in "$ver" 22 20 18; do
    for base in \
      "/opt/cpanel/ea-nodejs${v}/root/usr/lib/node_modules/npm/bin" \
      "/opt/cpanel/ea-nodejs${v}/lib/node_modules/npm/bin" \
      "/opt/cpanel/ea-nodejs${v}/bin"; do
      [ -f "$base/npm-cli.js" ] && echo "$base/npm-cli.js" && return
    done
  done
  echo ""
}

install_deps() {
  local LABEL="$1"
  local DIR="$2"
  local HASH_FILE="$3"
  local PKG_FILE="$DIR/package.json"

  if [ ! -f "$PKG_FILE" ]; then
    echo "  ⚠️  $LABEL: package.json tidak ditemukan di $DIR — skip"
    return
  fi

  local CUR_HASH; CUR_HASH=$(md5sum "$PKG_FILE" | awk '{print $1}')

  if [ -d "$DIR/node_modules" ] && [ -f "$HASH_FILE" ]; then
    local SAVED_HASH; SAVED_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
    if [ "$CUR_HASH" = "$SAVED_HASH" ]; then
      echo "  → $LABEL: skip (package.json tidak berubah)"
      return
    else
      echo "  → $LABEL: package.json berubah — install diperlukan"
      # Bersihkan node_modules lama agar tidak ada konflik
      rm -rf "$DIR/node_modules"
    fi
  else
    echo "  → $LABEL: node_modules belum ada — install diperlukan"
  fi

  local NPM_CLI; NPM_CLI=$(find_npm_cli)
  local SUCCESS=0

  # Gunakan /tmp sebagai cache — KRITIS: hindari mengisi home quota
  # Gunakan --prefix untuk force install ke project dir, bukan nodevenv global
  local NPM_CACHE="/tmp/npm-cache-joben"
  local FLAGS="--omit=dev --ignore-scripts --no-fund --no-audit --cache $NPM_CACHE --prefer-offline"

  # Bersihkan cache korup jika ada
  if [ -d "$NPM_CACHE" ] && ! mkdir -p "$NPM_CACHE/test-$$" 2>/dev/null; then
    echo "  → Cache /tmp korup — hapus dan buat ulang"
    rm -rf "$NPM_CACHE"
  fi
  rm -rf "$NPM_CACHE/test-$$" 2>/dev/null
  mkdir -p "$NPM_CACHE"

  for try in 1 2 3; do
    echo "  → $LABEL install (percobaan $try/3) ..."
    if [ -n "$NPM_CLI" ]; then
      node "$NPM_CLI" install --prefix "$DIR" $FLAGS && SUCCESS=1 && break
    else
      npm install --prefix "$DIR" $FLAGS && SUCCESS=1 && break
    fi
    echo "  ⚠️  Gagal — tunggu 10 detik ..."
    sleep 10
  done

  if [ "$SUCCESS" -eq 0 ]; then
    echo ""
    echo "  ✗ npm install gagal di $DIR setelah 3 percobaan."
    echo "  Jalankan manual di SSH:"
    echo "    rm -rf ~/.npm/ && npm install --prefix $DIR --omit=dev --ignore-scripts --cache /tmp/npm-cache"
    exit 1
  fi

  echo "$CUR_HASH" > "$HASH_FILE"
  echo "  ✓ $LABEL: dependencies diperbarui"
}

# Install root (Strapi) saja — frontend pakai Next.js standalone output
# (tidak butuh npm install; .next/standalone/ sudah bundle semua deps)
install_deps "Strapi (root)" "$APP_DIR" "$APP_DIR/.pkg_hash"

# Pastikan static files Next.js tersedia di dalam standalone dir
# (Next.js standalone butuh .next/static & public/ dicopy/symlink ke sana)
if [ -d "$FRONTEND_DIR/.next/standalone" ]; then
  STANDALONE_DIR="$FRONTEND_DIR/.next/standalone"

  # .next/static → .next/standalone/.next/static
  if [ ! -e "$STANDALONE_DIR/.next/static" ]; then
    ln -sfn "$FRONTEND_DIR/.next/static" "$STANDALONE_DIR/.next/static"
    echo "  ✓ Symlink .next/static → standalone/.next/static dibuat"
  fi

  # public/ → .next/standalone/public
  if [ -d "$FRONTEND_DIR/public" ] && [ ! -e "$STANDALONE_DIR/public" ]; then
    ln -sfn "$FRONTEND_DIR/public" "$STANDALONE_DIR/public"
    echo "  ✓ Symlink public/ → standalone/public dibuat"
  fi

  echo "  ✓ Next.js standalone: skip npm install (deps sudah di-bundle)"
else
  echo "  ⚠️  .next/standalone belum ada — pakai install biasa sebagai fallback"
  install_deps "Next.js (frontend)" "$FRONTEND_DIR" "$FRONTEND_DIR/.pkg_hash"
fi

echo "  ✓ Semua dependencies siap"
echo ""

# ── 3. Verifikasi build artifacts ────────────────────────────────────────────
echo "▶ [3/4] Verifikasi build artifacts ..."

# Strapi admin panel
if [ -d "$APP_DIR/build" ] && ls "$APP_DIR/build/"*.js &>/dev/null 2>&1; then
  echo "  ✓ Strapi admin (build/) ada"
else
  echo "  ⚠️  Strapi admin build/ tidak lengkap — /admin mungkin error"
  echo "      Solusi: npm run build:all di Replit → commit → push → deploy lagi"
fi

# Next.js frontend
if [ -f "$FRONTEND_DIR/.next/BUILD_ID" ]; then
  NEXT_BUILD_ID=$(cat "$FRONTEND_DIR/.next/BUILD_ID" 2>/dev/null | head -1)
  echo "  ✓ Next.js (.next/) ada — BUILD_ID: ${NEXT_BUILD_ID:0:12}"
else
  echo ""
  echo "  ✗ FATAL: Next.js .next/ tidak ada atau tidak valid!"
  echo "    Frontend tidak bisa berjalan tanpa build."
  echo "    Jalankan: npm run build:all di Replit → commit → push"
  exit 1
fi

# Symlink news-cms
if [ -L "$HOME/public_html/news-cms" ]; then
  echo "  ✓ Symlink ~/public_html/news-cms ada"
else
  echo "  ⚠️  Symlink news-cms belum ada — Strapi app mungkin tidak bisa restart"
  echo "      Buat: ln -s $APP_DIR $HOME/public_html/news-cms"
fi

# frontend/.env.local
if [ -f "$FRONTEND_DIR/.env.local" ]; then
  echo "  ✓ frontend/.env.local ada"
else
  echo "  ⚠️  frontend/.env.local tidak ada — STRAPI_API_URL belum diset!"
  echo "      Buat file: $FRONTEND_DIR/.env.local"
  echo "      Isi minimal: STRAPI_API_URL=https://cms.news.jobenapp.cloud"
fi

echo ""

# ── 4. Pre-restart check & restart kedua Passenger app ───────────────────────
echo "▶ [4/4] Restart aplikasi ..."

# Cek NODE_ENV di .env
if [ -f "$APP_DIR/.env" ]; then
  if grep -q "^NODE_ENV=production" "$APP_DIR/.env" 2>/dev/null; then
    echo "  ✓ NODE_ENV=production terverifikasi di .env"
  else
    echo "  ⚠️  NODE_ENV=production tidak ada di .env — tambahkan secepatnya!"
  fi
fi

NODE_PROCS=$(pgrep -c node 2>/dev/null || echo "0")
echo "  ℹ️  Proses Node.js aktif sebelum restart: ${NODE_PROCS}"
echo ""

restart_passenger() {
  local LABEL="$1"
  local DIR="$2"
  local RESTARTED=0

  # Cara 1: passenger-config di PATH
  if command -v passenger-config &>/dev/null; then
    passenger-config restart-app "$DIR" 2>/dev/null && RESTARTED=1 && \
      echo "  ✓ $LABEL — restart via passenger-config" || true
  fi

  # Cara 2: passenger-config di path standar cPanel
  if [ "$RESTARTED" -eq 0 ]; then
    for PC in \
      "/usr/local/bin/passenger-config" \
      "/opt/cpanel/ea-ruby"*/root/usr/bin/passenger-config \
      "/usr/local/lib/ruby/gems/"*/gems/passenger-*/bin/passenger-config; do
      # shellcheck disable=SC2086
      PC_FOUND=$(ls $PC 2>/dev/null | head -1)
      if [ -n "$PC_FOUND" ] && [ -x "$PC_FOUND" ]; then
        "$PC_FOUND" restart-app "$DIR" 2>/dev/null && RESTARTED=1 && \
          echo "  ✓ $LABEL — restart via $PC_FOUND" && break
      fi
    done
  fi

  # Cara 3: touch tmp/restart.txt (Passenger reload pada request berikutnya)
  if [ "$RESTARTED" -eq 0 ]; then
    mkdir -p "$APP_DIR/tmp"
    touch "$APP_DIR/tmp/restart.txt"
    RESTARTED=1
    echo "  ✓ $LABEL — restart via tmp/restart.txt"
    echo "    ℹ️  Passenger reload saat request pertama masuk setelah ini."
    echo "    ℹ️  Untuk immediate: cPanel → Node.js Selector → Restart App"
  fi
}

# Frontend — app root: ~/public_html/news
restart_passenger "Frontend (news.jobenapp.cloud)" "$APP_DIR"

# Strapi CMS — app root: ~/public_html/news-cms (symlink → news)
# passenger-config membedakan berdasarkan registered path (bukan physical path)
CMS_DIR="$HOME/public_html/news-cms"
if [ -L "$CMS_DIR" ]; then
  restart_passenger "Strapi CMS (cms.news.jobenapp.cloud)" "$CMS_DIR"
else
  echo "  ⚠️  Strapi CMS: symlink $CMS_DIR belum ada — restart manual di cPanel"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ Deploy JOBEN NEWS selesai!"
echo "  Frontend : https://news.jobenapp.cloud"
echo "  CMS Admin: https://cms.news.jobenapp.cloud/admin"
echo "════════════════════════════════════════════════════════"
echo ""
