# Checklist Deploy ke cPanel — JOBEN NEWS

Domain: `news.jobenapp.cloud` (Next.js) + `cms.news.jobenapp.cloud` (Strapi)

Status kesiapan kode: **SIAP PRODUKSI** ✅ — `server.js` (Passenger entrypoint),
konfigurasi `config/*.js` berbasis env var, CORS & CSP sudah memuat domain
production, dan `.gitignore` sudah mengecualikan file `.env`.

---

## 0. Catatan Keamanan — WAJIB DIBACA

Anda sempat menempelkan kredensial asli (password database, APP_KEYS, JWT
secret, R2 keys, Strapi API token) langsung di chat. Kredensial itu **tidak**
saya tulis ke file apa pun di repo (repo ini akan di-push ke GitHub — kalau
ditulis di sana, kredensial akan bocor ke publik/kolaborator).

Yang perlu Anda lakukan:
- Simpan semua value tersebut di **password manager**, bukan di file teks biasa.
- Isi langsung ke kolom Environment Variables di cPanel (lihat §3.d) — JANGAN
  taruh di file `.env` yang ikut ter-commit.
- Karena value sempat tertulis di riwayat chat ini, sebaiknya setelah deploy
  pertama berhasil, generate ulang (rotate) `REVALIDATION_SECRET` dan
  `STRAPI_API_TOKEN` dari Strapi Admin panel — keduanya gratis untuk diganti
  kapan saja tanpa downtime data.

---

## 1. Parsing DATABASE_URL Anda

Connection string yang Anda berikan formatnya:
```
postgresql://<username>:<password>@<host>:<port>/<database>?sslmode=disable
```

`config/database.js` di project ini **tidak membaca DATABASE_URL** — dia
membaca variabel terpisah. Jadi pecah connection string Anda menjadi:

| Env Var | Nilai (dari contoh Anda) |
|---|---|
| `DATABASE_CLIENT` | `postgres` |
| `DATABASE_HOST` | `127.0.0.1` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_NAME` | bagian setelah `/` sebelum `?` |
| `DATABASE_USERNAME` | bagian sebelum `:` di kredensial |
| `DATABASE_PASSWORD` | bagian setelah `:` di kredensial |
| `DATABASE_SSL` | `false` (karena `sslmode=disable`) |

Isi ke cPanel sebagai variabel terpisah ini, bukan sebagai satu `DATABASE_URL`.

---

## 2. Checklist Kesiapan Kode (sudah dicek)

- [x] `server.js` (root) & `frontend/server.js` — entrypoint Passenger, baca `PORT` dari env
- [x] `config/database.js` — mendukung `postgres` via env var (bukan hardcode)
- [x] `config/plugins.js` — upload provider R2 sudah env-driven
- [x] `config/middlewares.js` — CORS origin sudah termasuk `news.jobenapp.cloud` & `cms.news.jobenapp.cloud`
- [x] `config/middlewares.js` — CSP `img-src`/`media-src` sudah whitelist endpoint R2 Anda
- [x] `.gitignore` — `.env`, `.tmp/`, `build/`, `node_modules/` sudah dikecualikan
- [x] `frontend/.env.example` — dibuat (sebelumnya belum ada)
- [x] `package.json` — script `build` & `start` sudah benar di kedua project

Tidak ada perubahan kode yang diperlukan untuk go-live. Sisanya murni langkah
konfigurasi di cPanel.

---

## 3. Langkah-Langkah di cPanel

### a. Buat Subdomain
1. cPanel → **Domains** (atau **Subdomains** di cPanel versi lama)
2. Tambahkan `cms` sebagai subdomain dari `news.jobenapp.cloud` →
   menghasilkan `cms.news.jobenapp.cloud`
3. Document root bisa diarahkan ke folder kosong sementara (akan dioverride oleh Node.js App)

### b. Buat Database PostgreSQL
1. cPanel → **PostgreSQL Databases**
2. Buat database baru (nama sesuai `DATABASE_NAME` Anda)
3. Buat user baru (sesuai `DATABASE_USERNAME`), set password
4. Di bagian "Add User to Database", assign user tsb dengan privilege **ALL**

### c. Buat 2 Node.js App (Setup Node.js App)

**App 1 — Strapi (backend):**
- Application root: folder tempat kode backend (`backend` atau nama repo Anda)
- Application URL: `cms.news.jobenapp.cloud`
- Application startup file: `server.js`
- Node.js version: **20.x** (wajib — Strapi 5 butuh Node ≥18, project ini dites di Node 20)

**App 2 — Next.js (frontend):**
- Application root: folder `frontend`
- Application URL: `news.jobenapp.cloud`
- Application startup file: `server.js`
- Node.js version: 20.x

### d. Isi Environment Variables

**App Strapi** — di layar "Setup Node.js App" masing-masing app, ada bagian
Environment Variables. Isi (value dari kredensial yang sudah Anda siapkan,
paste langsung di sini, bukan di file):

```
NODE_ENV=production
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=<nama db Anda>
DATABASE_USERNAME=<username db Anda>
DATABASE_PASSWORD=<password db Anda>
DATABASE_SSL=false
PUBLIC_URL=https://cms.news.jobenapp.cloud
APP_KEYS=<4 value APP_KEYS Anda, dipisah koma>
API_TOKEN_SALT=<value Anda>
ADMIN_JWT_SECRET=<value Anda>
JWT_SECRET=<value Anda>
TRANSFER_TOKEN_SALT=<value Anda>
R2_ACCESS_KEY_ID=<value Anda>
R2_SECRET_ACCESS_KEY=<value Anda>
R2_ENDPOINT=<value Anda>
R2_BUCKET_NAME=<value Anda>
R2_PUBLIC_URL=<value Anda>
NEXTJS_REVALIDATION_URL=https://news.jobenapp.cloud/api/revalidate
REVALIDATION_SECRET=<value Anda>
```

**App Next.js:**
```
NODE_ENV=production
STRAPI_API_URL=https://cms.news.jobenapp.cloud
STRAPI_API_TOKEN=<value Anda — buat dari Strapi Admin > Settings > API Tokens setelah Strapi live>
REVALIDATION_SECRET=<HARUS SAMA dengan yang di Strapi>
NEXT_PUBLIC_SITE_URL=https://news.jobenapp.cloud
NEXT_PUBLIC_GA_MEASUREMENT_ID=<isi jika sudah ada GA4>
```

### e. Install & Build (via Terminal cPanel, tombol "Run NPM Install" atau SSH)

**Strapi:**
```bash
cd ~/<application-root-strapi>
npm install --production=false
NODE_ENV=production npm run build
```
Lalu klik **Restart** di panel Setup Node.js App.

Buka `https://cms.news.jobenapp.cloud/admin` → buat akun admin pertama Anda
(form setup akan muncul otomatis di kunjungan pertama).

Setelah admin dibuat, buka **Settings → API Tokens → Create new API Token**,
pilih tipe **Read-only**, salin tokennya — itu yang jadi `STRAPI_API_TOKEN`
di env var Next.js.

**Next.js:**
```bash
cd ~/frontend
npm install
npm run build
```
Lalu klik **Restart** di panel Setup Node.js App.

### f. Aktifkan SSL
1. cPanel → **SSL/TLS Status** atau **AutoSSL**
2. Centang kedua domain (`news.jobenapp.cloud` dan `cms.news.jobenapp.cloud`)
3. Klik **Run AutoSSL** — tunggu beberapa menit sampai sertifikat aktif

### g. Cron Job Anti-Idle (opsional, untuk shared hosting yang suka mem-suspend proses idle)
cPanel → **Cron Jobs** → tambahkan, interval setiap 10 menit:
```
curl -s https://cms.news.jobenapp.cloud/api > /dev/null
curl -s https://news.jobenapp.cloud > /dev/null
```

---

## 4. Verifikasi Setelah Deploy

- [ ] `https://cms.news.jobenapp.cloud/admin` bisa dibuka & login berhasil
- [ ] `https://news.jobenapp.cloud` menampilkan homepage dengan artikel
- [ ] Upload gambar baru di Strapi → cek muncul di R2 & tampil di frontend
- [ ] Publish artikel baru → cek homepage frontend ter-update tanpa perlu rebuild manual (test fitur revalidation)
- [ ] Kedua domain sudah HTTPS (gembok hijau, tanpa warning)
- [ ] Rotate `REVALIDATION_SECRET` & `STRAPI_API_TOKEN` (lihat §0) setelah semua di atas lolos
