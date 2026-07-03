# Panduan Migrasi — JOBEN NEWS ke Google Cloud

**Dokumen ini adalah pondasi migrasi untuk masa depan.**
Saat ini deployment berjalan di cPanel Shared Hosting (Node.js Selector / Passenger).
`Dockerfile` sudah disiapkan agar migrasi ke cloud bisa dilakukan kapan saja
tanpa merombak arsitektur aplikasi.

---

## Kapan Perlu Migrasi?

Pertimbangkan migrasi ke VPS / Google Cloud jika salah satu kondisi ini terjadi:

| Indikator | Ambang Batas |
|---|---|
| CPU usage di cPanel | Konsisten > 80% |
| App di-suspend hosting | Lebih dari 1x/minggu |
| Response time homepage | > 3 detik walau Cloudflare cache aktif |
| Error di log | "Resource limit exceeded" berulang |
| Traffic harian | > 10.000 pageview/hari secara konsisten |

---

## Arsitektur Target di Google Cloud

```
Internet → Cloudflare CDN
               │
               ├── news.jobenapp.cloud  → Cloud Run: Next.js (frontend)
               └── cms.news.jobenapp.cloud → Cloud Run: Strapi (backend)
                                              │
                                              ├── Cloud SQL for PostgreSQL
                                              └── Cloudflare R2 (storage — tidak perlu migrasi)
```

---

## Langkah Migrasi

### 1. Backup Database PostgreSQL dari cPanel

```bash
# Di Terminal cPanel / SSH
pg_dump \
  -h localhost \
  -U smknwon2_jobennews_user \
  -d smknwon2_jobennews_db \
  -Fc \
  -f backup_$(date +%Y%m%d_%H%M%S).dump

# Upload ke Cloud Storage sebagai backup aman
# gcloud storage cp backup_*.dump gs://joben-news-backups/
```

### 2. Buat Instance Cloud SQL for PostgreSQL

```bash
# Buat instance PostgreSQL 15 di region asia-southeast2 (Jakarta)
gcloud sql instances create joben-news-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-southeast2 \
  --storage-size=10GB \
  --backup-start-time=02:00

# Buat database dan user
gcloud sql databases create joben_news --instance=joben-news-db
gcloud sql users create strapi_user --instance=joben-news-db --password=<strong-password>
```

### 3. Restore Database ke Cloud SQL

```bash
# Cara 1: Via Cloud SQL import (dari Cloud Storage)
gcloud sql import pg joben-news-db gs://joben-news-backups/backup_YYYYMMDD.dump \
  --database=joben_news \
  --user=strapi_user

# Cara 2: Via pg_restore langsung (butuh Cloud SQL Proxy)
cloud-sql-proxy --port 5432 <PROJECT_ID>:asia-southeast2:joben-news-db &
pg_restore -h 127.0.0.1 -U strapi_user -d joben_news backup_YYYYMMDD.dump
```

### 4. Build dan Deploy Docker Image Strapi

```bash
# Dari root folder backend (Replit atau lokal)
# Set PROJECT_ID = Google Cloud project ID Anda

# Build image
gcloud builds submit \
  --tag gcr.io/${PROJECT_ID}/joben-news-strapi \
  --timeout=20m \
  .

# Deploy ke Cloud Run (Indonesia — asia-southeast2)
gcloud run deploy joben-news-strapi \
  --image gcr.io/${PROJECT_ID}/joben-news-strapi \
  --platform managed \
  --region asia-southeast2 \
  --port 1337 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 5 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_CLIENT=postgres,\
DATABASE_HOST=<CLOUD_SQL_IP>,\
DATABASE_PORT=5432,\
DATABASE_NAME=joben_news,\
DATABASE_USERNAME=strapi_user,\
DATABASE_PASSWORD=<password>,\
DATABASE_SSL=false,\
R2_ACCESS_KEY_ID=<value>,\
R2_SECRET_ACCESS_KEY=<value>,\
R2_ENDPOINT=https://6ffcdac7c1cf3d08b80450851f6646a3.r2.cloudflarestorage.com,\
R2_BUCKET_NAME=joben-news,\
R2_PUBLIC_URL=https://pub-eb6a0f12e3b748628e7fb3494cb105a4.r2.dev,\
APP_KEYS=<value>,\
API_TOKEN_SALT=<value>,\
ADMIN_JWT_SECRET=<value>,\
JWT_SECRET=<value>,\
TRANSFER_TOKEN_SALT=<value>,\
NEXTJS_REVALIDATION_URL=https://news.jobenapp.cloud/api/revalidate,\
REVALIDATION_SECRET=<value>,\
NODE_ENV=production,\
PUBLIC_URL=https://cms.news.jobenapp.cloud"
```

### 5. Update DNS Cloudflare

**Lakukan ini tepat saat siap cutover (downtime < 5 menit):**

```
# Sebelum migrasi: set TTL rendah (5 menit) minimal 30 menit sebelumnya
# Di Cloudflare Dashboard > dns.jobenapp.cloud:

# Ubah record cms.news.jobenapp.cloud:
# DARI: A / CNAME → IP cPanel
# KE:   CNAME → <cloud-run-url>.a.run.app

# Atau gunakan custom domain di Cloud Run:
gcloud run domain-mappings create \
  --service joben-news-strapi \
  --domain cms.news.jobenapp.cloud \
  --region asia-southeast2
```

### 6. Verifikasi Setelah Migrasi

```bash
# Cek API Strapi berjalan
curl https://cms.news.jobenapp.cloud/api/articles?pagination[limit]=1

# Cek admin panel bisa diakses
curl -I https://cms.news.jobenapp.cloud/admin

# Cek upload media masih ke R2 (bukan local disk)
# Upload gambar via admin panel, cek URL gambar = pub-*.r2.dev
```

---

## Catatan Penting

### Cloudflare R2 — TIDAK perlu dimigrasi
Media (gambar/video) disimpan di Cloudflare R2 yang sudah bersifat cloud-native
dan independen dari hosting. URL media tetap sama setelah migrasi.

### Environment Variables
Semua konfigurasi menggunakan environment variable — tidak ada yang hardcode di kode.
Lihat `.env.example` untuk daftar lengkap.

### Biaya Google Cloud Estimasi (asia-southeast2)
| Komponen | Estimasi |
|---|---|
| Cloud Run Strapi (0.5 vCPU, 512MB, 1 min instance) | ~$15-25/bulan |
| Cloud SQL PostgreSQL (db-f1-micro, 10GB) | ~$15-20/bulan |
| Cloud Storage (backup) | ~$1/bulan |
| **Total** | **~$31-46/bulan** |

Bandingkan dengan cPanel shared hosting yang biasanya $5-15/bulan.
Migrasi disarankan saat revenue dari AdSense/iklan sudah menutup biaya cloud.
