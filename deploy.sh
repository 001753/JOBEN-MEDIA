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

# ── Self-re-exec guard ────────────────────────────────────────────────────────
# bash membuffer script sebelum eksekusi. Jika deploy.sh berubah saat
# git reset --hard di step 1, bash tetap menjalankan versi lama dari buffer.
# Guard ini melakukan git update DIAM-DIAM di awal, lalu re-exec agar
# seluruh script berjalan dengan versi terbaru dari disk.
# Variabel _JOBEN_DEPLOY_EXEC mencegah loop tak terbatas.
if [ -z "${_JOBEN_DEPLOY_EXEC}" ]; then
  git -C "$APP_DIR" fetch origin -q 2>/dev/null || true
  git -C "$APP_DIR" reset --hard origin/main -q 2>/dev/null || true
  export _JOBEN_DEPLOY_EXEC=1
  exec bash "$0" "$@"
fi

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
      | grep -v '^frontend/next-build\.tar\.gz$' \
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
  # Prioritas 1: cPanel ea-nodejs package (Node 20 diutamakan — tarball dibangun Node 20)
  for v in 20 22 18; do
    local n="/opt/cpanel/ea-nodejs${v}/root/usr/bin/node"
    [ -x "$n" ] && echo "$n" && return
  done
  # Prioritas 2: CloudLinux nodevenv (digunakan jika ea-nodejs tidak terinstall)
  # Cari di semua app dirs yang mungkin, Node 20 diutamakan
  for v in 20 22 18; do
    for app_dir in news strapi frontend; do
      local n="$HOME/nodevenv/public_html/${app_dir}/${v}/bin/node"
      [ -x "$n" ] && echo "$n" && return
    done
  done
  # Prioritas 3: node di PATH (nodevenv wrapper, tapi masih bisa dipakai)
  command -v node 2>/dev/null || echo ""
}

# Cari npm-cli.js yang cocok dengan system node
find_npm_cli_for() {
  local NODE_BIN="$1"
  local ver; ver=$("$NODE_BIN" --version 2>/dev/null | tr -d 'v' | cut -d. -f1)

  # cPanel ea-nodejs path
  for v in "$ver" 22 20 18; do
    local cli="/opt/cpanel/ea-nodejs${v}/root/usr/lib/node_modules/npm/bin/npm-cli.js"
    [ -f "$cli" ] && echo "$cli" && return
  done

  # CloudLinux nodevenv path — npm-cli ada di lib/node_modules atau share/node_modules
  local node_dir; node_dir="$(dirname "$NODE_BIN")"         # .../bin
  local prefix;   prefix="$(dirname "$node_dir")"           # .../22
  for sub in lib share; do
    local cli="$prefix/$sub/node_modules/npm/bin/npm-cli.js"
    [ -f "$cli" ] && echo "$cli" && return
  done

  # Fallback: cari npm-cli.js relatif terhadap node binary yang aktif
  local npm_root; npm_root=$(dirname "$(command -v npm 2>/dev/null || echo "")")
  if [ -n "$npm_root" ]; then
    local cli="$(dirname "$npm_root")/lib/node_modules/npm/bin/npm-cli.js"
    [ -f "$cli" ] && echo "$cli" && return
    cli="$(dirname "$npm_root")/share/node_modules/npm/bin/npm-cli.js"
    [ -f "$cli" ] && echo "$cli" && return
  fi

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

    # ── better-sqlite3: rebuild agar cocok dengan Node versi server ─────────────
    # (kompilasi ringan, tidak butuh libvips — aman di-rebuild di shared hosting)
    _BS3_NODE=$(find_system_node)
    _BS3_CLI=$(find_npm_cli_for "$_BS3_NODE")
    _BS3_VER=$("$_BS3_NODE" --version 2>/dev/null)
    unset NPM_CONFIG_PREFIX npm_config_prefix NODE_OPTIONS NPM_CONFIG_CACHE npm_config_cache npm_config_globalconfig npm_config_userconfig
    echo "  → Rebuild better-sqlite3 untuk $_BS3_VER ..."
    if [ -n "$_BS3_CLI" ]; then
      (cd "$APP_DIR" && "$_BS3_NODE" "$_BS3_CLI" rebuild better-sqlite3 \
        --no-fund --no-audit 2>&1) \
        && echo "  ✓ better-sqlite3 rebuilt" \
        || echo "  ⚠️  better-sqlite3 rebuild warning"
    else
      (cd "$APP_DIR" && npm rebuild better-sqlite3 --no-fund --no-audit 2>&1) \
        && echo "  ✓ better-sqlite3 rebuilt" \
        || echo "  ⚠️  better-sqlite3 rebuild warning"
    fi
    unset _BS3_NODE _BS3_CLI _BS3_VER
  else
    echo "  ℹ️  Download gagal — fallback ke npm install"
    install_deps "Strapi (root)" "$APP_DIR" "$APP_DIR/.pkg_hash"
  fi
fi

# ── sharp: fix ABI mismatch — WAJIB setelah SEMUA jalur instalasi deps ────────
#
# ROOT CAUSE (diverifikasi dari analisis binary sharp@0.34.5):
#
#   BUG 1 — x86-64-v2 microarchitecture trap (penyebab utama kegagalan):
#     sharp/lib/sharp.js mencoba load @img/sharp-linux-x64 (path ke-3 dari 4).
#     Jika berhasil load, ia memanggil sharp._isUsingX64V2() lewat CPUID.
#     Jika CPU server (atau VM) TIDAK mengekspos SSE4.2 → isUsingX64V2() = false
#     → sharp = null → throw error.
#     FATAL: loop sudah `break` di path ke-3, path ke-4 (@img/sharp-wasm32)
#     TIDAK pernah dicoba — bahkan jika wasm32 terinstall sekalipun.
#
#   BUG 2 — Error disembunyikan:
#     Verifikasi lama: "$_SH_NODE" -e "require('sharp')" 2>/dev/null
#     2>/dev/null membuang seluruh stack trace sehingga tidak ada petunjuk error.
#
#   BUG 3 — Versi libvips fallback salah:
#     Fallback hardcode 1.1.0, tapi sharp@0.34.5 mensyaratkan 1.2.4.
#
# SOLUSI PRESISI:
#   1. Deteksi SSE4.2 di /proc/cpuinfo sebagai hints awal.
#   2. Jika SSE4.2 terdeteksi → install x64 dulu, lalu RUNTIME CHECK lewat Node.
#      Beberapa VM (Xen/KVM dengan CPUID masking) melaporkan SSE4.2 di /proc/cpuinfo
#      tapi memblokir instruksi CPUID di level proses → _isUsingX64V2() = false.
#      Jika x64 gagal di Node → otomatis hapus x64, install wasm32 (tanpa abort).
#   3. Jika SSE4.2 tidak terdeteksi → langsung install @img/sharp-wasm32 SAJA.
#      JANGAN install x64 — jika ada, loop di sharp.js break di path 3, V2 check
#      gagal, wasm32 tidak dicoba. Tidak ada x64 = loop lanjut ke wasm32.
#
# Referensi: sharp/lib/sharp.js paths[] + _isUsingX64V2() check

_SH_NODE=$(find_system_node)
_SH_VER=$("$_SH_NODE" --version 2>/dev/null)

# Resolve node_modules target (CloudLinux: bisa symlink ke venv)
_SH_NM="$APP_DIR/node_modules"
[ -L "$_SH_NM" ] && _SH_NM="$(readlink -f "$_SH_NM")"

echo "  → Hapus @img lama dari node_modules ..."
# HANYA hapus @img (binary packages) — jangan hapus sharp (pure-JS wrapper).
rm -rf "$_SH_NM/@img"

# ── Deteksi x86-64-v2 microarchitecture (SSE4.2 = syarat minimum) ─────────────
# sharp@0.33+ prebuilt linux-x64 mensyaratkan: CMPXCHG16B, POPCNT, SSE4.1, SSE4.2, SSSE3.
# /proc/cpuinfo melaporkan flag CPU yang diekspos ke proses (bisa berbeda dari hardware asli
# jika host memakai VM dengan CPU passthrough terbatas, e.g. Xen default, KVM qemu32, dll).
_SH_CPU_V2=0
if grep -qw 'sse4_2' /proc/cpuinfo 2>/dev/null; then
  _SH_CPU_V2=1
  echo "  ℹ️  CPU: x86-64-v2 ✓ (SSE4.2 terdeteksi) — native linux-x64 binary"
else
  echo "  ℹ️  CPU: SSE4.2 TIDAK terdeteksi di /proc/cpuinfo"
  echo "  ℹ️  Menggunakan @img/sharp-wasm32 (CPU-agnostic, sedikit lebih lambat)"
fi

# Baca versi exact dari sharp/package.json yang sudah terinstall di node_modules.
# CATATAN: baca dari optionalDependencies['@img/sharp-linux-x64'] — ini adalah versi
# EXACT yang digunakan npm saat install, bukan range ^x.y.z.
# Fallback ke 1.2.4 (libvips) bukan 1.1.0 — sharp@0.34.x membutuhkan libvips 1.2.4.
_SH_PKG="$_SH_NM/sharp/package.json"
if [ -f "$_SH_PKG" ]; then
  _SH_X64_VER=$("$_SH_NODE" -e "
    try {
      var p = require('$_SH_PKG');
      var v = (p.optionalDependencies||{})['@img/sharp-linux-x64'] || p.version;
      console.log(v.replace(/^[\\^~>=<]/g,'').split(' ')[0]);
    } catch(e) { console.log('0.34.5'); }
  " 2>/dev/null || echo "0.34.5")
  _SH_LIBVIPS_VER=$("$_SH_NODE" -e "
    try {
      var p = require('$_SH_PKG');
      var v = (p.optionalDependencies||{})['@img/sharp-libvips-linux-x64'] || '1.2.4';
      console.log(v.replace(/^[\\^~>=<]/g,'').split(' ')[0]);
    } catch(e) { console.log('1.2.4'); }
  " 2>/dev/null || echo "1.2.4")
else
  # sharp/package.json belum ada — baca versi dari root package.json
  _SH_X64_VER=$("$_SH_NODE" -e "
    try {
      var p = require('$APP_DIR/package.json');
      var v = (p.dependencies||{}).sharp || '0.34.5';
      console.log(v.replace(/^[\\^~>=<]/g,'').split(' ')[0]);
    } catch(e) { console.log('0.34.5'); }
  " 2>/dev/null || echo "0.34.5")
  _SH_LIBVIPS_VER="1.2.4"
fi

# Download helper — coba wget lalu curl
_dl() {
  local URL="$1" OUT="$2"
  if command -v wget &>/dev/null; then
    wget -q -O "$OUT" "$URL" 2>&1 && return 0
  fi
  if command -v curl &>/dev/null; then
    curl -fsSL -o "$OUT" "$URL" 2>&1 && return 0
  fi
  return 1
}

# Download + extract satu paket npm ke target dir
_download_img_pkg() {
  local PKG_NAME="$1" PKG_VER="$2" TARGET="$3"
  local URL="https://registry.npmjs.org/@img/${PKG_NAME}/-/${PKG_NAME}-${PKG_VER}.tgz"
  local TMP="/tmp/img-${PKG_NAME}-${PKG_VER}.tgz"
  echo "  → Download @img/${PKG_NAME}@${PKG_VER} ..."
  if ! _dl "$URL" "$TMP"; then
    echo "  ✗ wget/curl gagal untuk @img/${PKG_NAME}"
    return 1
  fi
  local SIZE; SIZE=$(wc -c < "$TMP" 2>/dev/null || echo 0)
  if [ "$SIZE" -lt 10000 ]; then
    echo "  ✗ Download terlalu kecil (${SIZE} byte) — kemungkinan 404 atau network error"
    head -3 "$TMP" 2>/dev/null | cat
    rm -f "$TMP"
    return 1
  fi
  rm -rf "$TARGET"
  mkdir -p "$TARGET"
  # npm registry tarball selalu punya prefix "package/" — strip satu level
  tar -xzf "$TMP" --strip-components=1 -C "$TARGET"
  rm -f "$TMP"
  echo "  ✓ @img/${PKG_NAME}@${PKG_VER} extracted ($(( SIZE / 1024 ))KB)"
  return 0
}

SHARP_OK=0
_SH_DL_FAIL=0

if [ "$_SH_CPU_V2" -eq 1 ]; then
  # ── Native linux-x64 path ──────────────────────────────────────────────────
  echo "  ℹ️  @img/sharp-linux-x64@$_SH_X64_VER + @img/sharp-libvips-linux-x64@$_SH_LIBVIPS_VER"
  _download_img_pkg "sharp-linux-x64"         "$_SH_X64_VER"    "$_SH_NM/@img/sharp-linux-x64"         || _SH_DL_FAIL=1
  if [ "$_SH_DL_FAIL" -eq 0 ]; then
    _download_img_pkg "sharp-libvips-linux-x64" "$_SH_LIBVIPS_VER" "$_SH_NM/@img/sharp-libvips-linux-x64" || _SH_DL_FAIL=1
  fi

  # ── Runtime cross-check: /proc/cpuinfo vs CPUID aktual ─────────────────────
  # Beberapa VM (Xen/KVM dengan CPUID masking) melaporkan SSE4.2 di /proc/cpuinfo
  # tapi hypervisor memblokir instruksi CPUID di level proses → _isUsingX64V2()
  # mengembalikan false → sharp.js melempar error meskipun binary sudah terinstall.
  # Deteksi dini di sini: jika x64 gagal di Node, langsung hapus x64 dan install
  # wasm32 sebagai gantinya — tanpa abort deploy.
  if [ "$_SH_DL_FAIL" -eq 0 ]; then
    _SH_X64_EXIT=0
    (cd "$APP_DIR" && "$_SH_NODE" -e "require('sharp')") >/dev/null 2>&1 || _SH_X64_EXIT=$?
    if [ "$_SH_X64_EXIT" -ne 0 ]; then
      echo "  ⚠️  x64 binary gagal di runtime (CPUID masking di VM) — fallback ke wasm32 ..."
      rm -rf "$_SH_NM/@img"
      _SH_CPU_V2=0
      _download_img_pkg "sharp-wasm32" "$_SH_X64_VER" "$_SH_NM/@img/sharp-wasm32" || _SH_DL_FAIL=1
    fi
    unset _SH_X64_EXIT
  fi
else
  # ── WebAssembly fallback path ──────────────────────────────────────────────
  # @img/sharp-wasm32 menyertakan libvips yang dikompilasi ke dalam wasm binary.
  # Tidak perlu @img/sharp-libvips-linux-x64.
  # PENTING: JANGAN install @img/sharp-linux-x64 di sini — jika ada, sharp.js akan
  # mencoba load x64 dulu (path ke-3), V2 check gagal, lalu throw TANPA mencoba
  # wasm32 (path ke-4) karena loop sudah break. Tidak ada x64 = loop terus ke wasm32.
  echo "  ℹ️  @img/sharp-wasm32@$_SH_X64_VER (wasm32 = CPU-agnostic, no libvips needed)"
  _download_img_pkg "sharp-wasm32" "$_SH_X64_VER" "$_SH_NM/@img/sharp-wasm32" || _SH_DL_FAIL=1
fi

unset _SH_X64_VER _SH_LIBVIPS_VER _SH_PKG
[ "$_SH_DL_FAIL" -eq 0 ] && SHARP_OK=1
unset _SH_DL_FAIL

# ── Verifikasi WAJIB — tampilkan error LENGKAP jika gagal ────────────────────
# CATATAN: jangan suppres stderr (2>/dev/null) — error message dari sharp
# mengandung diagnosis penting (CPU arch, missing lib, wrong GLIBC, dll).
#
# PENTING: set +e wajib di sini.
# set -e aktif di seluruh script, dan "VAR=$(failing_cmd)" di bawah set -e
# menyebabkan bash exit SEBELUM baris berikutnya (_SHARP_EXIT=$?) sempat jalan.
# Hasilnya: script exit silent tanpa pesan error, step 3 & 4 tidak pernah jalan.
set +e
_SHARP_ERR=$( (cd "$APP_DIR" && "$_SH_NODE" -e "require('sharp')") 2>&1 )
_SHARP_EXIT=$?
set -e

if [ "$SHARP_OK" -eq 1 ] && [ "$_SHARP_EXIT" -eq 0 ]; then
  echo "  ✓ sharp OK ($_SH_VER)"
else
  echo ""
  echo "  ✗ FATAL: sharp tidak bisa dimuat setelah install ($_SH_VER)"
  echo "    CPU SSE4.2: $_SH_CPU_V2  (1=ada → native x64, 0=tidak ada → wasm32)"
  echo "    node_modules path: $_SH_NM"
  echo "    @img packages terinstall:"
  ls "$_SH_NM/@img/" 2>/dev/null | sed 's/^/      /' || echo "      (kosong atau tidak ditemukan)"
  echo ""
  if [ -n "$_SHARP_ERR" ]; then
    echo "    Error detail:"
    echo "$_SHARP_ERR" | head -40 | sed 's/^/    /'
  fi
  echo ""
  echo "    Deploy DIBATALKAN — Strapi TIDAK di-restart."
  echo "    (Jika Strapi sudah jalan, versi lama tetap aktif.)"
  exit 1
fi
unset _SH_NODE _SH_VER _SH_CPU_V2 _SH_NM _SHARP_ERR _SHARP_EXIT

# ── Ekstrak next-build.tar.gz → frontend/.next/ ──────────────────────────────
# Build artifact di-commit sebagai tarball agar tidak dihapus cleanup agent.
# Hash check: skip ekstrak jika tarball belum berubah sejak ekstrak terakhir.
NEXT_TARBALL="$FRONTEND_DIR/next-build.tar.gz"
NEXT_HASH_FILE="$FRONTEND_DIR/.next_build_hash"

if [ -f "$NEXT_TARBALL" ]; then
  TARBALL_HASH=$(md5sum "$NEXT_TARBALL" | awk '{print $1}')
  SAVED_HASH=$(cat "$NEXT_HASH_FILE" 2>/dev/null || echo "")

  if [ "$TARBALL_HASH" = "$SAVED_HASH" ] && [ -f "$FRONTEND_DIR/.next/BUILD_ID" ]; then
    echo "  → skip ekstrak next-build.tar.gz (tidak berubah)"
    echo "  ✓ frontend/.next/ sudah up-to-date (BUILD_ID: $(cat "$FRONTEND_DIR/.next/BUILD_ID" | head -1))"
  else
    echo "  → Ekstrak next-build.tar.gz → frontend/.next/ ..."
    rm -rf "$FRONTEND_DIR/.next"
    tar -xzf "$NEXT_TARBALL" -C "$FRONTEND_DIR"
    echo "$TARBALL_HASH" > "$NEXT_HASH_FILE"
    echo "  ✓ frontend/.next/ diekstrak (BUILD_ID: $(cat "$FRONTEND_DIR/.next/BUILD_ID" 2>/dev/null | head -1))"
  fi
else
  echo "  ⚠️  next-build.tar.gz tidak ada — .next/ harus sudah ada dari build sebelumnya"
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
 * Node.js version   : 22 (nodevenv/public_html/news/22)
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
    mkdir -p "$DIR/tmp"
    touch "$DIR/tmp/restart.txt"
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
