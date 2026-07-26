# Checklist Deploy ke cPanel — JOBEN NEWS

Domain: `news.jobenapp.cloud` (Next.js) + `cms.news.jobenapp.cloud` (Strapi)
cPanel user: `smknwon2` | Server: `tirtonirmolo.idweb.host`
GitHub repo: `https://github.com/001753/JOBEN-MEDIA` (public)

---

## Arsitektur di cPanel

```
/home/smknwon2/public_html/
├── news/                   ← Repo utama (git clone)
│   ├── app.js              → Startup Next.js (news.jobenapp.cloud)
│   ├── server.js           → Startup Strapi (cms.news.jobenapp.cloud)
│   ├── frontend/           → Next.js App Router
│   │   ├── server.js       → Custom Next.js server untuk Passenger
│   │   ├── .next/          → Build artifact (di-commit ke git)
│   │   └── .env.local      → Env vars Next.js (dibuat manual, TIDAK di git)
│   ├── build/              → Strapi admin build (di-commit ke git)
│   ├── .env                → Env vars Strapi (dibuat manual, TIDAK di git)
│   └── deploy.sh           → Script deploy (jalankan via SSH)
└── news-cms/               ← Symlink ke news/ (untuk Passenger Strapi)
    (semua file sama dengan news/)
```

**Dua Node.js app di cPanel Node.js Selector:**
| App | Application root | Startup file | URL |
|---|---|---|---|
| Frontend | `public_html/news` | `app.js` | `news.jobenapp.cloud` |
| Strapi CMS | `public_html/news-cms` | `server.js` | `cms.news.jobenapp.cloud` |

**Alur deploy (setelah setup awal):**
```
Replit → npm run build:all → git commit → git push → SSH cPanel → bash deploy.sh
```

---

## SETUP AWAL (Hanya sekali)

### A. Clone repo di cPanel

Via cPanel SSH Terminal:
```bash
cd ~/public_html
git clone https://github.com/001753/JOBEN-MEDIA news
cd news
```

### B. Buat symlink untuk app Strapi

```bash
ln -s /home/smknwon2/public_html/news /home/smknwon2/public_html/news-cms
# Verifikasi:
ls -la /home/smknwon2/public_html/news-cms/server.js
```

### C. Buat `.env` Strapi

Buat file `/home/smknwon2/public_html/news/.env` dengan isi:

```env
# ── Runtime ─────────────────────────────────────────────────
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
PUBLIC_URL=https://cms.news.jobenapp.cloud

# ── Database (PostgreSQL) ────────────────────────────────────
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=smknwon2_jobennews_db
DATABASE_USERNAME=smknwon2_jobennews_user
DATABASE_PASSWORD=<password_database>
DATABASE_SSL=false
DATABASE_CONNECTION_TIMEOUT=60000

# ── Strapi Security Keys ─────────────────────────────────────
APP_KEYS=<key1>,<key2>,<key3>,<key4>
API_TOKEN_SALT=<nilai>
ADMIN_JWT_SECRET=<nilai>
JWT_SECRET=<nilai>
TRANSFER_TOKEN_SALT=<nilai>

# ── Cloudflare R2 Storage ────────────────────────────────────
R2_ACCESS_KEY_ID=<nilai>
R2_SECRET_ACCESS_KEY=<nilai>
R2_ENDPOINT=https://6ffcdac7c1cf3d08b80450851f6646a3.r2.cloudflarestorage.com
R2_BUCKET_NAME=joben-news
R2_PUBLIC_URL=https://pub-eb6a0f12e3b748628e7fb3494cb105a4.r2.dev

# ── Revalidasi Next.js ───────────────────────────────────────
NEXTJS_REVALIDATION_URL=https://news.jobenapp.cloud/api/revalidate
REVALIDATION_SECRET=<nilai>

# ── SMTP (email notifikasi) ──────────────────────────────────
SMTP_HOST=mail.jobenapp.cloud
SMTP_PORT=465
SMTP_USER=admin@jobenapp.cloud
SMTP_PASS=<password_smtp>

# ── Admin pertama (hanya untuk bootstrap, hapus setelah login pertama) ──
STRAPI_ADMIN_EMAIL=admin@jobenapp.cloud
STRAPI_ADMIN_PASSWORD=<password_admin>
```

> ⚠️ JANGAN commit file `.env` ke GitHub. File ini ada di `.gitignore`.

### D. Buat `frontend/.env.local`

Buat file `/home/smknwon2/public_html/news/frontend/.env.local`:

```env
# URL Strapi CMS (server-side fetch dari Next.js)
STRAPI_API_URL=https://cms.news.jobenapp.cloud

# API Token dari Strapi Admin > Settings > API Tokens
STRAPI_API_TOKEN=<strapi_api_token>

# Harus sama persis dengan REVALIDATION_SECRET di .env Strapi
REVALIDATION_SECRET=<nilai>

# URL publik frontend
NEXT_PUBLIC_SITE_URL=https://news.jobenapp.cloud

# Google Analytics (opsional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=

NODE_ENV=production
```

### E. Install dependencies

```bash
# Aktifkan Node.js environment
source /home/smknwon2/nodevenv/public_html/news/22/bin/activate
cd /home/smknwon2/public_html/news

# Install root (Strapi)
npm install --omit=dev --ignore-scripts

# Install frontend (Next.js)
cd frontend && npm install --omit=dev --ignore-scripts && cd ..
```

### F. Daftarkan dua Node.js App di cPanel

**App 1 — Frontend (mungkin sudah ada):**
- Node.js version: `22.23.0`
- Application mode: `Production`
- Application root: `public_html/news`
- Application URL: `news.jobenapp.cloud`
- Application startup file: `app.js`

**App 2 — Strapi CMS:**
- Node.js version: `22.23.0`
- Application mode: `Production`
- Application root: `public_html/news-cms`
- Application URL: `cms.news.jobenapp.cloud`
- Application startup file: `server.js`

### G. Jalankan migrasi database Strapi (sekali)

```bash
source /home/smknwon2/nodevenv/public_html/news/22/bin/activate
cd /home/smknwon2/public_html/news
NODE_ENV=production node_modules/.bin/strapi db:migrate
```

> Jika error permission atau table sudah ada — aman diabaikan.

### H. Restart kedua app

Di cPanel Node.js Selector → klik **Restart** untuk:
1. `news.jobenapp.cloud`
2. `cms.news.jobenapp.cloud`

Atau via SSH:
```bash
bash /home/smknwon2/public_html/news/deploy.sh
```

### I. Verifikasi

- `https://cms.news.jobenapp.cloud/admin` → halaman login Strapi ✅
- `https://news.jobenapp.cloud` → halaman beranda JOBEN NEWS ✅

---

## DEPLOY SELANJUTNYA (Rutin)

Setiap kali ada perubahan kode:

**Di Replit:**
```bash
npm run build:all          # Build Strapi admin + Next.js + tulis .build_commit
git add -A
git commit -m "build: update production build YYYY-MM-DD"
git push origin main
```

**Di cPanel SSH:**
```bash
cd ~/public_html/news
bash deploy.sh
```

Script `deploy.sh` otomatis:
- Git pull
- Verifikasi build sinkron
- Skip install jika deps tidak berubah
- Restart kedua app

---

## Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| `/admin` error 404 | `build/` tidak ada | `npm run build:all` di Replit → commit → push |
| Frontend kosong/error | `.next/` tidak ada | Sama seperti atas |
| Strapi tidak konek DB | Format env DB salah | Pastikan `DATABASE_CLIENT=postgres` + individual vars |
| Image tidak muncul | R2 env salah | Cek R2_ENDPOINT, R2_ACCESS_KEY_ID di `.env` |
| CORS error di browser | Origin belum didaftarkan | Cek `config/middlewares.js` — origin array |
| 502 Bad Gateway | App tidak jalan | cPanel → Node.js Selector → lihat error log |
| npm install gagal | RLIMIT_NPROC (server penuh) | Tunggu 5-10 menit → coba lagi |

---

## Catatan Keamanan

- File `.env` dan `frontend/.env.local` ada di `.gitignore` — tidak pernah ter-commit.
- Rotate `REVALIDATION_SECRET` dan `STRAPI_API_TOKEN` secara berkala via Strapi Admin.
- Jangan simpan password di file selain `.env` yang ada di server cPanel.
