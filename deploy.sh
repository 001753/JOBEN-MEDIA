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
#   - ~/public_html/strapi adalah direktori Strapi CMS (startup: server.js)
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
# PENTING: Node 20 diutamakan — tarball node_modules & native modules
# (better-sqlite3, sharp, dst) dibangun di Replit dengan Node 20.
# Node 22 hanya sebagai fallback jika Node 20 tidak tersedia di cPanel.
for _NDIR in \
  "$HOME/nodevenv/public_html/news/20/bin" \
  "$HOME/nodevenv/public_html/strapi/20/bin" \
  "/opt/cpanel/ea-nodejs20/root/usr/bin" \
  "/opt/cpanel/ea-nodejs20/bin" \
  "$HOME/nodevenv/public_html/news/22/bin" \
  "$HOME/nodevenv/public_html/strapi/22/bin" \
  "/opt/cpanel/ea-nodejs22/root/usr/bin" \
  "/opt/cpanel/ea-nodejs22/bin" \
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
# JANGAN set NODE_OPTIONS di sini — npm butuh heap penuh untuk install Strapi
# NODE_OPTIONS akan di-unset sementara saat install dan dikembalikan setelahnya

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
      | grep -v '^node_modules-strapi\.part' \
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

# Cari raw system node binary — BUKAN nodevenv wrapper di PATH
# nodevenv wrapper set NPM_CONFIG_PREFIX ke ~/nodevenv/... sehingga npm
# selalu install ke sana. Raw system node tidak punya behavior itu.
find_system_node() {
  # Node 20 diutamakan — native modules (better-sqlite3, sharp) dibangun Node 20
  for v in 20 22 18; do
    local n="/opt/cpanel/ea-nodejs${v}/root/usr/bin/node"
    [ -x "$n" ] && echo "$n" && return
  done
  # fallback ke node di PATH (tapi ini mungkin nodevenv wrapper)
  command -v node 2>/dev/null || echo ""
}

# Cari npm-cli.js yang cocok dengan system node
find_npm_cli_for() {
  local NODE_BIN="$1"
  # Cari berdasarkan versi node binary
  local ver; ver=$("$NODE_BIN" --version 2>/dev/null | tr -d 'v' | cut -d. -f1)
  for v in "$ver" 22 20 18; do
    local cli="/opt/cpanel/ea-nodejs${v}/root/usr/lib/node_modules/npm/bin/npm-cli.js"
    [ -f "$cli" ] && echo "$cli" && return
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

  # -d juga true untuk symlink ke direktori, sehingga cocok untuk CloudLinux venv
  if [ -d "$DIR/node_modules" ] && [ -f "$HASH_FILE" ]; then
    local SAVED_HASH; SAVED_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
    if [ "$CUR_HASH" = "$SAVED_HASH" ]; then
      echo "  → $LABEL: skip (package.json tidak berubah)"
      return
    else
      echo "  → $LABEL: package.json berubah — install diperlukan"
      # CloudLinux NodeJS Selector: node_modules adalah symlink ke virtual env.
      # rm -rf pada symlink menghapus symlink itu sendiri, lalu npm install
      # gagal karena tidak ada symlink dan CloudLinux menolak pembuatan folder nyata.
      # Solusi: hapus ISI symlink target, pertahankan symlink-nya.
      if [ -L "$DIR/node_modules" ]; then
        echo "  ℹ️  CloudLinux venv symlink — hapus isi, pertahankan symlink ..."
        find "$DIR/node_modules" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
      else
        rm -rf "$DIR/node_modules"
      fi
    fi
  else
    echo "  → $LABEL: node_modules belum ada — install diperlukan"
  fi

  # Gunakan raw system node — bypass nodevenv wrapper yang terus intercept
  local SYSTEM_NODE; SYSTEM_NODE=$(find_system_node)
  local NPM_CLI; NPM_CLI=$(find_npm_cli_for "$SYSTEM_NODE")
  echo "  ℹ️  Node: $SYSTEM_NODE ($(\"$SYSTEM_NODE\" --version 2>/dev/null))"
  echo "  ℹ️  npm-cli: ${NPM_CLI:-fallback ke npm di PATH}"

  local SUCCESS=0

  # Buang SEMUA env yang di-set oleh nodevenv activate agar tidak ada intercept
  unset NPM_CONFIG_PREFIX npm_config_prefix
  unset NPM_CONFIG_CACHE npm_config_cache
  unset npm_config_globalconfig npm_config_userconfig
  unset NODE_OPTIONS

  # Cache valid ke /tmp (bukan home quota)
  # Cache ke $HOME/.npm (bukan /tmp — /tmp punya quota kecil di shared hosting)
  # errno -122 = EDQUOTA: /tmp kehabisan quota saat npm extract tarballs besar
  local NPM_CACHE="$HOME/.npm"
  mkdir -p "$NPM_CACHE"

  # --omit=dev --omit=optional: kurangi jumlah package & inode secara signifikan
  local FLAGS="--omit=dev --omit=optional --ignore-scripts --no-fund --no-audit --prefer-dedupe --cache $NPM_CACHE"

  for try in 1 2 3; do
    echo "  → $LABEL install (percobaan $try/3) ..."

    # cd ke DIR dulu — npm install tanpa flag target selalu ke ./node_modules
    # (lebih reliable dari --prefix yang bisa di-override nodevenv)
    if [ -n "$NPM_CLI" ]; then
      (cd "$DIR" && "$SYSTEM_NODE" "$NPM_CLI" install $FLAGS) && SUCCESS=1 && break
    else
      (cd "$DIR" && npm install $FLAGS) && SUCCESS=1 && break
    fi

    echo "  ⚠️  Gagal — tunggu 10 detik ..."
    sleep 10
  done

  if [ "$SUCCESS" -eq 0 ]; then
    echo ""
    echo "  ✗ npm install gagal di $DIR setelah 3 percobaan."
    echo "  Debug: jalankan manual di SSH (TANPA source activate):"
    echo "    SYSTEM_NODE=/opt/cpanel/ea-nodejs20/root/usr/bin/node"
    echo "    NPM_CLI=/opt/cpanel/ea-nodejs20/root/usr/lib/node_modules/npm/bin/npm-cli.js"
    echo "    cd $DIR && \"\$SYSTEM_NODE\" \"\$NPM_CLI\" install --omit=dev --ignore-scripts"
    exit 1
  fi

  echo "$CUR_HASH" > "$HASH_FILE"
  echo "  ✓ $LABEL: dependencies diperbarui"
}

# ── Install Strapi node_modules ───────────────────────────────────────────────
# STRATEGI PRESISI TINGGI (menghindari errno -122 EDQUOTA di cPanel /tmp):
#
#   OPSI 1 — Tarball pre-packed dari Replit (DIUTAMAKAN):
#     Jika node_modules-strapi.tar.gz ada di APP_DIR, ekstrak langsung.
#     Tidak ada npm install → tidak ada /tmp quota issue → tidak ada inode race.
#     Buat tarball: npm run pack:node-modules (di Replit) → upload ke cPanel.
#
#   OPSI 2 — npm install (fallback):
#     Digunakan jika tarball tidak ada. Cache diarahkan ke $HOME/.npm
#     (bukan /tmp) agar tidak kena EDQUOTA.

TARBALL_PATH="$APP_DIR/node_modules-strapi.tar.gz"

# Bersihkan tarball lama yang mungkin tertinggal sebagai untracked file
# (git reset --hard tidak menghapus untracked files)
if [ -f "$TARBALL_PATH" ]; then
  echo "  → Hapus tarball lama (untracked sisa git-lfs) ..."
  rm -f "$TARBALL_PATH"
fi

# Fungsi: cek apakah file adalah LFS pointer (< 200 byte = pointer, bukan data nyata)
is_lfs_pointer() {
  local f="$1"
  [ -f "$f" ] && [ "$(wc -c < "$f")" -lt 200 ]
}

# Fungsi: download part file dari GitHub raw jika tidak ada / masih LFS pointer
download_part() {
  local FILE="$1"
  local FILENAME
  FILENAME=$(basename "$FILE")
  local URL="https://raw.githubusercontent.com/001753/JOBEN-MEDIA/main/$FILENAME"

  echo "  → Download $FILENAME dari GitHub raw ..."
  if command -v wget &>/dev/null; then
    wget -q --show-progress -O "$FILE" "$URL" 2>&1 || \
    wget -q -O "$FILE" "$URL"
  elif command -v curl &>/dev/null; then
    curl -fL --progress-bar -o "$FILE" "$URL"
  else
    echo "  ✗ wget/curl tidak ditemukan — tidak bisa download part files"
    return 1
  fi

  # Verifikasi hasil download (harus > 1MB)
  local SIZE
  SIZE=$(wc -c < "$FILE" 2>/dev/null || echo 0)
  if [ "$SIZE" -lt 1000000 ]; then
    echo "  ✗ Download gagal atau file terlalu kecil ($SIZE byte)"
    rm -f "$FILE"
    return 1
  fi
  echo "  ✓ $FILENAME: $(( SIZE / 1048576 ))MB"
}

# Deteksi part files secara dinamis (partaa, partab, partac, ...)
# Hanya sertakan file yang BENAR-BENAR ada di git (tracked + committed).
# Jangan gunakan -f check filesystem — file sisa dari run sebelumnya
# (leftover/untracked) bisa memicu false-positive dan menyebabkan loop
# mencoba download file yang tidak ada di repo.
PART_FILES=()
for SUFFIX in aa ab ac ad ae af ag ah ai aj; do
  PART="$APP_DIR/node_modules-strapi.part${SUFFIX}"
  if git ls-files --error-unmatch "node_modules-strapi.part${SUFFIX}" &>/dev/null 2>&1; then
    PART_FILES+=("$PART")
  else
    break  # tidak ada part berikutnya — hentikan
  fi
done

if [ ${#PART_FILES[@]} -eq 0 ]; then
  echo "  ℹ️  Tidak ada part files — fallback ke npm install"
  install_deps "Strapi (root)" "$APP_DIR" "$APP_DIR/.pkg_hash"
else
  echo "  ℹ️  Ditemukan ${#PART_FILES[@]} part file(s)"

  # Pastikan semua part files ada dan valid (bukan LFS pointer)
  PARTS_OK=1
  for PART in "${PART_FILES[@]}"; do
    if [ ! -f "$PART" ] || is_lfs_pointer "$PART"; then
      echo "  ℹ️  $(basename "$PART"): tidak ada / LFS pointer — download dari GitHub raw ..."
      download_part "$PART" || { PARTS_OK=0; break; }
    else
      echo "  ✓ $(basename "$PART"): $(( $(wc -c < "$PART") / 1048576 ))MB — valid"
    fi
  done

  if [ "$PARTS_OK" -eq 1 ]; then
    echo "  → Menggabungkan & mengekstrak node_modules ..."
    # CloudLinux NodeJS Selector: node_modules adalah SYMLINK ke virtual env.
    # JANGAN biarkan tar extract ke $APP_DIR — tar akan MENIMPA symlink dengan
    # direktori nyata karena tarball punya entry "node_modules/" sebagai direktori.
    # Setelah symlink diganti direktori nyata, npm install akan diblokir CloudLinux.
    #
    # Solusi BENAR: resolve symlink target terlebih dahulu, lalu extract langsung
    # ke sana dengan --strip-components=1 (menghapus prefix "node_modules/" dari path).
    # Symlink tidak pernah disentuh — hanya ISI target yang diperbarui.
    if [ -L "$APP_DIR/node_modules" ]; then
      VENV_DIR=$(readlink -f "$APP_DIR/node_modules")
      echo "  ℹ️  CloudLinux venv: $VENV_DIR"
      echo "  → Hapus isi venv, extract langsung ke target (pertahankan symlink) ..."
      rm -rf "$VENV_DIR"
      mkdir -p "$VENV_DIR"
      cat "${PART_FILES[@]}" | tar -xz --strip-components=1 -C "$VENV_DIR"
    else
      rm -rf "$APP_DIR/node_modules"
      cat "${PART_FILES[@]}" | tar -xz -C "$APP_DIR"
    fi
    echo "  ✓ Strapi node_modules: diekstrak dari ${#PART_FILES[@]} part file(s)"
    echo "  → Hapus part files setelah ekstrak (hemat disk) ..."
    rm -f "${PART_FILES[@]}"
    # Simpan hash agar install_deps tidak dijalankan lagi
    md5sum "$APP_DIR/package.json" | awk '{print $1}' > "$APP_DIR/.pkg_hash"

    # Rebuild native modules agar cocok dengan Node.js versi di server ini.
    # sharp & better-sqlite3 adalah native modules — binary-nya harus dikompile
    # ulang di server target. Tarball dibangun di Replit (Node 20), cPanel bisa
    # Node 20 atau 22 → ABI berbeda → harus rebuild.
    echo "  → Rebuild native modules (sharp, better-sqlite3) ..."
    SYSTEM_NODE=$(find_system_node)
    NPM_CLI=$(find_npm_cli_for "$SYSTEM_NODE")
    unset NPM_CONFIG_PREFIX npm_config_prefix NODE_OPTIONS
    REBUILD_FLAGS="--no-fund --no-audit"
    if [ -n "$NPM_CLI" ]; then
      (cd "$APP_DIR" && "$SYSTEM_NODE" "$NPM_CLI" rebuild sharp better-sqlite3 $REBUILD_FLAGS 2>&1) \
        && echo "  ✓ Native modules rebuilt" \
        || echo "  ⚠️  Rebuild warning — cek manual jika Strapi gagal load sharp"
    else
      (cd "$APP_DIR" && npm rebuild sharp better-sqlite3 $REBUILD_FLAGS 2>&1) \
        && echo "  ✓ Native modules rebuilt" \
        || echo "  ⚠️  Rebuild warning — cek manual jika Strapi gagal load sharp"
    fi
  else
    echo "  ℹ️  Download gagal — fallback ke npm install"
    install_deps "Strapi (root)" "$APP_DIR" "$APP_DIR/.pkg_hash"
  fi
fi

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

# CMS_DIR = ~/public_html/strapi  (BUKAN news-cms!)
#
# cPanel Node.js Selector menggunakan string prefix check untuk mendeteksi
# app yang "bersarang" di dalam app lain. Karena ada app di public_html/news,
# path apapun yang diawali "news" (termasuk "news-cms") akan ditolak dengan
# error "cannot be located inside of already existing one: public_html/news".
# Ini adalah bug cPanel — bukan filesystem check, tapi string prefix check.
#
# Solusi: gunakan nama direktori yang tidak diawali string "news".
# public_html/strapi → path.resolve('../news') = public_html/news ✓
CMS_DIR="$HOME/public_html/strapi"

# Hapus direktori / symlink news-cms lama jika masih ada
if [ -e "$HOME/public_html/news-cms" ] || [ -L "$HOME/public_html/news-cms" ]; then
  echo "  → Hapus news-cms lama (diganti dengan strapi/) ..."
  rm -rf "$HOME/public_html/news-cms"
fi

# Buat direktori dan server.js wrapper
mkdir -p "$CMS_DIR"

cat > "$CMS_DIR/server.js" << 'EOJS'
'use strict';
/**
 * server.js — Strapi CMS startup untuk cPanel Node.js Selector (Passenger)
 *
 * Ini adalah wrapper minimal. Semua kode Strapi ada di ../news.
 * Tidak perlu npm install di direktori ini — node_modules di-require
 * dengan path absolut dari ../news/node_modules.
 *
 * Application root  : ~/public_html/strapi   (direktori ini)
 * Application URL   : cms.news.jobenapp.cloud
 * Startup file      : server.js
 * Node.js version   : 20 (sama dengan news/)
 */
const path = require('path');

// Direktori instalasi Strapi sesungguhnya
const NEWS_DIR = path.resolve(__dirname, '../news');

// Pindah CWD ke NEWS_DIR agar path relatif di dalam Strapi resolve dengan benar
process.chdir(NEWS_DIR);

// PORT di-inject Passenger; fallback ke 1337
process.env.PORT = process.env.PORT || '1337';

// Load Strapi dari absolute path — tidak bergantung pada node_modules di sini
require(path.join(NEWS_DIR, 'node_modules', '@strapi', 'strapi'))
  .createStrapi({ appDir: NEWS_DIR })
  .start();
EOJS

echo "  ✓ strapi/ direktori + server.js wrapper dibuat (app root cPanel: public_html/strapi)"

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

# Strapi CMS — app root: ~/public_html/strapi
# CMS_DIR sudah di-set di step 3 (bagian verifikasi)
if [ -d "$CMS_DIR" ] && [ -f "$CMS_DIR/server.js" ]; then
  restart_passenger "Strapi CMS (cms.news.jobenapp.cloud)" "$CMS_DIR"
else
  echo "  ⚠️  Strapi CMS: $CMS_DIR belum ada — jalankan deploy.sh sekali lagi"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ Deploy JOBEN NEWS selesai!"
echo "  Frontend : https://news.jobenapp.cloud"
echo "  CMS Admin: https://cms.news.jobenapp.cloud/admin"
echo "════════════════════════════════════════════════════════"
echo ""
