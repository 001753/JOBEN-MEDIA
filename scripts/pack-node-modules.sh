#!/usr/bin/env bash
# scripts/pack-node-modules.sh
#
# Buat paket node_modules PRODUCTION dari Replit → upload ke cPanel.
# Tujuan: eliminasi "npm install" di cPanel sepenuhnya.
#
# Kenapa perlu?
#   npm install Strapi di cPanel sering gagal karena:
#   1. errno -122 (EDQUOTA): /tmp kehabisan quota saat npm extract tarballs besar
#   2. TAR_ENTRY_ERROR ENOENT: nested dist/ belum ada saat parallel extract
#   3. Inode limit shared hosting habis oleh ratusan ribu file node_modules
#
# Solusi: install + prune di Replit (Linux x64, sama dengan cPanel) → tar.gz
#
# Cara pakai:
#   1. Di Replit:   bash scripts/pack-node-modules.sh
#   2. Upload:      scp node_modules-strapi.tar.gz user@server:~/public_html/news/
#      atau via FTP/File Manager cPanel
#   3. Di cPanel SSH:
#      cd ~/public_html/news
#      tar -xzf node_modules-strapi.tar.gz
#      rm node_modules-strapi.tar.gz
#   4. Jalankan: bash deploy.sh  (akan skip npm install otomatis)
#
# Kapan perlu upload ulang?
#   - Hanya saat package.json berubah (versi deps berubah)
#   - Perubahan kode biasa → cukup git push + bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT="$APP_DIR/node_modules-strapi.tar.gz"
HASH_FILE="$APP_DIR/.node_modules_pack_hash"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  JOBEN NEWS — Pack node_modules untuk cPanel"
echo "  Output: node_modules-strapi.tar.gz"
echo "══════════════════════════════════════════════════════════"
echo ""

cd "$APP_DIR"

# ── 1. Pastikan deps terinstall ──────────────────────────────────────────────
if [ ! -d "$APP_DIR/node_modules" ]; then
  echo "▶ [1/4] node_modules belum ada — install dulu ..."
  npm install
else
  echo "▶ [1/4] node_modules sudah ada ✓"
fi

# ── 2. Prune ke production + optional ───────────────────────────────────────
echo ""
echo "▶ [2/4] Prune devDependencies (PERTAHANKAN optional) ..."
echo "  (Optional deps WAJIB disertakan — sharp menggunakan @img/sharp-linux-x64"
echo "   sebagai optionalDependency untuk pre-built binary. Tanpanya sharp gagal load.)"

# Buat temp dir, salin manifest ke sana, lalu install dari dalam temp dir
# (npm install tanpa --prefix jauh lebih reliable — --prefix bisa di-override
# oleh nodevenv wrapper dan npm mencari package.json di CWD, bukan di prefix)
TEMP_NM=$(mktemp -d /tmp/nm-pack-XXXXXX)
echo "  → Salin package.json + package-lock.json ke $TEMP_NM ..."
cp "$APP_DIR/package.json" "$TEMP_NM/package.json"
[ -f "$APP_DIR/package-lock.json" ] && cp "$APP_DIR/package-lock.json" "$TEMP_NM/package-lock.json"

echo "  → Install prod-only dari $TEMP_NM ..."
# Jalankan npm install tanpa pipe agar exit code terdeteksi dengan benar
# (pipe ke grep/head menyembunyikan error dan mencegah pembuatan node_modules)
NPM_INSTALL_LOG=$(mktemp /tmp/npm-install-XXXXXX.log)
# PENTING: --omit=optional DIHAPUS
# sharp v0.34.x memakai @img/sharp-linux-x64 sebagai optionalDependency.
# Jika di-omit, sharp tidak punya binary → crash saat Strapi load upload plugin.
# Tradeoff: tarball ~15MB lebih besar, tapi sharp berfungsi tanpa rebuild.
(cd "$TEMP_NM" && npm install \
  --omit=dev \
  --ignore-scripts \
  --no-fund \
  --no-audit \
  --prefer-dedupe) >"$NPM_INSTALL_LOG" 2>&1
NPM_EXIT=$?

# Tampilkan ringkasan
grep -E "^(added|removed|changed)" "$NPM_INSTALL_LOG" | head -3 || true
grep "^npm error" "$NPM_INSTALL_LOG" | head -5 || true
rm -f "$NPM_INSTALL_LOG"

PROD_NM="$TEMP_NM/node_modules"

if [ $NPM_EXIT -ne 0 ] || [ ! -d "$PROD_NM" ] || [ -z "$(ls -A "$PROD_NM" 2>/dev/null)" ]; then
  echo "  ✗ npm install gagal (exit $NPM_EXIT) di $TEMP_NM"
  rm -rf "$TEMP_NM"
  exit 1
fi

PROD_COUNT=$(find "$PROD_NM" -maxdepth 1 -type d | wc -l)
PROD_SIZE=$(du -sh "$PROD_NM" 2>/dev/null | cut -f1)
echo "  ✓ Prod node_modules: $PROD_SIZE, ~$PROD_COUNT top-level packages"

# ── 3. Buat tarball ──────────────────────────────────────────────────────────
echo ""
echo "▶ [3/4] Membuat tarball node_modules-strapi.tar.gz ..."
echo "  (Ini akan membutuhkan beberapa menit untuk ~500MB+ data)"

# Simpan hash package.json untuk deteksi perubahan
PKG_HASH=$(md5sum "$APP_DIR/package.json" | awk '{print $1}')
LOCK_HASH=$(md5sum "$APP_DIR/package-lock.json" 2>/dev/null | awk '{print $1}' || echo "")

# Buat tarball dari temp dir
(cd "$TEMP_NM" && tar -czf "$OUTPUT" node_modules/)

rm -rf "$TEMP_NM"

TAR_SIZE=$(du -sh "$OUTPUT" 2>/dev/null | cut -f1)
echo "  ✓ Tarball: $TAR_SIZE → $OUTPUT"

# Simpan hash untuk deteksi perubahan berikutnya
echo "${PKG_HASH}|${LOCK_HASH}" > "$HASH_FILE"

# ── 4. Instruksi upload ──────────────────────────────────────────────────────
echo ""
echo "▶ [4/4] Selesai! Langkah upload ke cPanel:"
echo ""
echo "  OPSI A — via SCP (SSH):"
echo "  ─────────────────────────────────────────────────────────"
echo "  scp node_modules-strapi.tar.gz smknwon2@tirtonirmolo.id:~/public_html/news/"
echo "  ssh smknwon2@tirtonirmolo.id"
echo "  cd ~/public_html/news"
echo "  tar -xzf node_modules-strapi.tar.gz"
echo "  rm node_modules-strapi.tar.gz"
echo "  bash deploy.sh"
echo ""
echo "  OPSI B — via cPanel File Manager:"
echo "  ─────────────────────────────────────────────────────────"
echo "  1. Upload node_modules-strapi.tar.gz ke public_html/news/"
echo "  2. Klik kanan → Extract"
echo "  3. Hapus file tar.gz setelah extract"
echo "  4. Buka Terminal → cd ~/public_html/news && bash deploy.sh"
echo ""
echo "  KAPAN PERLU UPLOAD ULANG?"
echo "  ─────────────────────────────────────────────────────────"
echo "  Hanya jika package.json berubah (versi deps berubah)."
echo "  Perubahan kode biasa → cukup git push + bash deploy.sh"
echo ""
echo "══════════════════════════════════════════════════════════"
