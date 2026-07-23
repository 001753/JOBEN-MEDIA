# JOBEN NEWS AI Agent

**Mesin produksi artikel berita otonom** — menghasilkan 30 artikel/hari + 2 breaking news secara otomatis 24/7.

## Stack

| Komponen | Teknologi |
|---|---|
| Runtime | Node.js 20+ |
| Process Manager | PM2 |
| AI Model | Gemini 2.5 Flash + Imagen 3 |
| CMS Target | Strapi v5 (REST API) |
| Media Storage | Cloudflare R2 |
| Database Lokal | SQLite (better-sqlite3) |
| Notifikasi | Telegram Bot API |
| Dashboard | Express.js + Vanilla HTML/JS |

---

## Struktur Folder

```
agent/
├── src/
│   ├── agents/          ← Agen AI (trendScout, writer, qualityGate, dll)
│   ├── services/        ← Services (geminiPool, strapiClient, r2Client, dll)
│   ├── scheduler/       ← Scheduler utama + breaking news daemon
│   ├── dashboard/       ← Dashboard Express server + routes API
│   │   ├── server.js
│   │   ├── middleware/  ← auth.js, rateLimit.js
│   │   ├── routes/      ← 11 route file API
│   │   └── public/      ← [Frontend] HTML + CSS + JS (Sub-bagian 2)
│   ├── config/          ← settings.json, authors.json, prompts.js, dll
│   └── utils/           ← logger, slugify, retryHelper, dll
├── data/                ← State runtime (state.json, queue.json, keys.json)
├── logs/                ← Log harian Winston (auto-rotate 14 hari)
├── scripts/             ← CLI scripts: setup, test, seed, export
├── .env                 ← Environment variables (TIDAK di-commit)
├── .env.example         ← Template env vars
└── ecosystem.config.js  ← PM2 konfigurasi
```

---

## Persyaratan

- Node.js **20 atau lebih baru**
- PM2 (untuk production): `npm install -g pm2`
- Akses ke Strapi v5 yang sudah berjalan
- Minimal 1 Gemini API key (disarankan 5–15 untuk produksi)
- Cloudflare R2 bucket yang sudah dikonfigurasi

---

## Instalasi

### 1. Clone & Install Dependencies

```bash
cd agent
npm install
```

### 2. Konfigurasi Environment

```bash
cp .env.example .env
```

Edit `.env` dan isi semua nilai yang diperlukan:

```bash
# === WAJIB ===
STRAPI_API_URL=https://cms.news.jobenapp.cloud
STRAPI_API_TOKEN=<token dari Strapi admin → Settings → API Tokens>

GEMINI_KEY_01=AIzaSy...
# Tambah GEMINI_KEY_02 ... GEMINI_KEY_15 untuk produksi

R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 access key>
R2_SECRET_ACCESS_KEY=<r2 secret key>
R2_BUCKET_NAME=joben-news
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-xxx.r2.dev

NEXTJS_REVALIDATION_URL=https://news.jobenapp.cloud/api/revalidate
NEXTJS_REVALIDATION_SECRET=<secret yang sama dengan di Strapi webhook>

TELEGRAM_BOT_TOKEN=<dari @BotFather>
TELEGRAM_ADMIN_CHAT_ID=<chat ID kamu>

DASHBOARD_PORT=4000
DASHBOARD_JWT_SECRET=<random string min 32 karakter>
DASHBOARD_ADMIN_USERNAME=admin
DASHBOARD_ADMIN_PASSWORD_HASH=<generate di bawah>
```

### 3. Generate Password Hash Dashboard

```bash
node -e "require('bcryptjs').hash('passwordmu', 12).then(console.log)"
```

Salin hasilnya ke `DASHBOARD_ADMIN_PASSWORD_HASH` di `.env`.

### 4. Inisialisasi Pertama Kali

```bash
node scripts/setup.js
```

Script ini akan:
- Membuat folder `data/` dan `logs/`
- Inisialisasi `data/state.json`, `data/queue.json`, `data/keys.json`
- Inisialisasi SQLite database `data/published.db`
- Validasi koneksi ke Strapi

### 5. Seed Authors ke Strapi

```bash
node scripts/seedAuthors.js
```

Membuat 10 profil author di Strapi dan mengupdate `src/config/authors.json` dengan Strapi ID masing-masing.

---

## Menjalankan (Development)

### Scheduler saja
```bash
node src/scheduler/index.js
```

### Dashboard saja
```bash
node src/dashboard/server.js
```

### Breaking news daemon saja
```bash
node src/scheduler/breakingDaemon.js
```

---

## Menjalankan (Production dengan PM2)

```bash
# Start semua proses
pm2 start ecosystem.config.js

# Lihat status
pm2 status

# Lihat log
pm2 logs

# Stop semua
pm2 stop all

# Restart
pm2 restart all

# Auto-start saat server reboot
pm2 startup
pm2 save
```

Tiga proses PM2:
| Nama | Script | Fungsi |
|---|---|---|
| `joben-agent-scheduler` | `src/scheduler/index.js` | Loop utama 30 artikel/hari |
| `joben-breaking-daemon` | `src/scheduler/breakingDaemon.js` | Monitor breaking news setiap 5 menit |
| `joben-dashboard` | `src/dashboard/server.js` | Dashboard di port 4000 |

---

## Testing

### Test generate 1 artikel (end-to-end CLI)
```bash
node scripts/testWriter.js
```
Ini akan: fetch RSS → pilih topik → generate artikel dengan Gemini → quality gate → print hasil. **Tidak publish ke Strapi.**

### Test publish ke Strapi
```bash
# Dry run (tidak benar-benar publish)
node scripts/testPublish.js --dry-run

# Publish artikel test sungguhan
node scripts/testPublish.js

# Dengan kategori spesifik
node scripts/testPublish.js --category "Artificial Intelligence"
```
⚠️ Artikel test yang dipublish harus dihapus manual dari Strapi setelah selesai.

### Test RSS reader
```bash
npm run test:rss
```

### Test Gemini API key pool
```bash
npm run test:gemini
```

### Test Telegram notifikasi
```bash
npm run test:telegram
```

---

## Dashboard

URL: `http://localhost:4000` (development) / `https://ai.jobenapp.cloud` (production)

### Endpoint API Utama

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/api/auth/login` | Login dengan username + password |
| `GET` | `/api/overview` | Stats harian + recent activity |
| `POST` | `/api/overview/kill-switch` | Stop/start agent |
| `GET` | `/api/articles` | Log semua artikel (filter + paginasi) |
| `GET` | `/api/queue` | Isi queue saat ini |
| `POST` | `/api/queue` | Tambah topik manual ke queue |
| `GET` | `/api/keys` | Status semua Gemini API key |
| `POST` | `/api/keys/reset-daily` | Reset counter harian semua key |
| `POST` | `/api/keys/test` | Test satu key ke Gemini |
| `GET` | `/api/logs/stream` | SSE real-time log (butuh ?token=) |
| `POST` | `/api/manual/generate` | Trigger generate artikel manual |
| `GET` | `/api/settings` | Baca konfigurasi |
| `PUT` | `/api/settings` | Update konfigurasi |

### Autentikasi API

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"passwordmu"}'

# Gunakan token
curl http://localhost:4000/api/overview \
  -H "Authorization: Bearer <accessToken>"
```

---

## Monitoring

### Log Files
```
logs/agent-YYYY-MM-DD.log    ← Log utama (info level)
logs/error-YYYY-MM-DD.log    ← Error log terpisah
logs/dashboard-access.log    ← Access log dashboard
```

Log dirotasi otomatis setiap hari dan disimpan 14 hari.

### Reset Counter Harian (Manual)
```bash
node scripts/resetDaily.js
```
Biasanya dijalankan otomatis oleh scheduler (cron `0 0 * * *`).

### Export State & Database untuk Backup
```bash
node scripts/exportState.js
# Output: data/export-YYYY-MM-DD.json

node scripts/exportState.js --output /path/backup.json --limit 500
```

---

## Environment Variables Lengkap

Lihat `.env.example` untuk daftar lengkap semua env vars yang didukung.

| Key | Wajib | Keterangan |
|---|---|---|
| `STRAPI_API_URL` | ✅ | URL Strapi CMS |
| `STRAPI_API_TOKEN` | ✅ | API token Strapi (Full Access) |
| `GEMINI_KEY_01` | ✅ | Minimal 1 Gemini API key |
| `GEMINI_KEY_02..15` | — | Tambahan key untuk produksi (disarankan 15) |
| `R2_ACCOUNT_ID` | ✅ | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | ✅ | R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 Secret Key |
| `R2_BUCKET_NAME` | ✅ | Nama bucket R2 |
| `R2_ENDPOINT` | ✅ | Endpoint R2 |
| `R2_PUBLIC_URL` | ✅ | URL publik R2 |
| `NEXTJS_REVALIDATION_URL` | ✅ | URL endpoint revalidasi Next.js |
| `NEXTJS_REVALIDATION_SECRET` | ✅ | Secret untuk ISR revalidation |
| `TELEGRAM_BOT_TOKEN` | ✅ | Token Telegram Bot |
| `TELEGRAM_ADMIN_CHAT_ID` | ✅ | Chat ID admin untuk notifikasi |
| `DASHBOARD_PORT` | — | Port dashboard (default: 4000) |
| `DASHBOARD_JWT_SECRET` | ✅ | Secret JWT min 32 karakter |
| `DASHBOARD_ADMIN_USERNAME` | — | Username login (default: admin) |
| `DASHBOARD_ADMIN_PASSWORD_HASH` | ✅ | bcrypt hash password |
| `NODE_ENV` | — | `development` atau `production` |
| `TZ` | — | Timezone (default: Asia/Jakarta) |
| `LOG_LEVEL` | — | `debug`/`info`/`warn`/`error` (default: info) |

---

## Troubleshooting

### Agent tidak menghasilkan artikel
1. Cek `data/state.json` → field `agentStatus` harus `"idle"`, bukan `"killed"`
2. Cek jam aktif di `src/config/settings.json` → `agent.activeHours` (default 06–23 WIB)
3. Cek log: `tail -f logs/agent-$(date +%Y-%m-%d).log`
4. Cek apakah ada Gemini key aktif: `npm run test:gemini`

### Artikel gagal publish ke Strapi
1. Verifikasi token: `node scripts/testPublish.js --dry-run`
2. Cek apakah Strapi berjalan: `curl $STRAPI_API_URL/api/articles`
3. Pastikan API token punya izin Full Access di Strapi admin

### Dashboard tidak bisa login
1. Pastikan `DASHBOARD_JWT_SECRET` dan `DASHBOARD_ADMIN_PASSWORD_HASH` sudah diset di `.env`
2. Generate ulang hash: `node -e "require('bcryptjs').hash('passwordmu',12).then(console.log)"`
3. Cek log dashboard: `pm2 logs joben-dashboard`

### Gambar tidak muncul di artikel
1. Cek kredensial R2 di `.env`
2. Pastikan bucket R2 sudah ada dan public access diaktifkan
3. Test upload manual: `node -e "require('./src/services/r2Client').getInstance().testConnection().then(console.log)"`
