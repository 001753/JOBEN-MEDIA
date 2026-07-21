# JOBEN NEWS — Monorepo (Strapi CMS + Next.js Frontend)

Portal berita online dengan headless CMS. Strapi v5 sebagai backend, Next.js App Router sebagai frontend.

## Stack
- **CMS**: Strapi v5.50.0 — berjalan di port 3001
- **Frontend**: Next.js 14 App Router — berjalan di port 5000
- **Database dev**: SQLite (Replit) | **Database prod**: PostgreSQL (cPanel)
- **Media storage**: Cloudflare R2 (via @strapi/provider-upload-aws-s3)
- **Email**: Nodemailer — aktif otomatis saat `SMTP_USER` + `SMTP_PASS` tersedia
- **Runtime**: Node.js 20 (diperlukan oleh Strapi v5)

## Menjalankan di Replit

Dua workflow berjalan bersamaan:
- **Start CMS** → `npm run develop` (root) → Strapi di port 3001
- **Start application** → `cd frontend && npm run dev` → Next.js di port 5000

Admin Strapi: buka preview di port 3001, lalu `/admin`.

Setelah Strapi berjalan pertama kali, buat admin account lewat `/admin`,
lalu buat API Token (Settings → API Tokens) dan isi `STRAPI_API_TOKEN` di Replit Secrets.

## Struktur Monorepo
```
/ (root)          → Strapi CMS
  config/         → Strapi config (database, plugins, middleware, server)
  src/            → Content types, lifecycle hooks, policies, bootstrap
  frontend/       → Next.js App Router
    app/          → Pages & layouts
    components/   → UI components
    lib/          → Strapi fetch helpers
```

## Content Types
| Tipe | Keterangan |
|---|---|
| `Article` | Artikel berita — draftAndPublish, editorial_status, is_breaking_news |
| `Category` | Kategori berita (parent/child hierarchy) |
| `Tag` | Tag multi-pilih untuk artikel |
| `Author` | Profil penulis — linked ke Strapi User |
| `Page` | Halaman statis (About, Privacy Policy, dll) |

## Editorial Workflow
- `editorial_status`: `draft` → `review` → `published`
- Sinkron otomatis dengan `publishedAt` via lifecycle hook
- Hanya 1 artikel breaking news aktif sekaligus (enforced via lifecycle)
- Penulis hanya bisa edit artikel milik sendiri (policy `is-own-article`)

## Env Vars & Secrets
Semua tersimpan di Replit Secrets / Env Vars (bukan file .env).

| Key | Keterangan |
|---|---|
| `APP_KEYS`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT` | Strapi security keys (Secrets) |
| `STRAPI_API_TOKEN` | Token untuk Next.js fetch ke Strapi (Secret) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 (Secrets) |
| `SMTP_PASS` | SMTP password (Secret) |
| `REVALIDATION_SECRET` | Webhook revalidasi Next.js (Secret) |
| `DATABASE_CLIENT` | `sqlite` (dev) / `postgres` (prod) |
| `PORT` | `3001` (Strapi) |
| `STRAPI_API_URL` | `http://localhost:3001` |

## Deploy ke cPanel (Production)
Lihat `doc/CPANEL_DEPLOY_CHECKLIST.md` dan `doc/AI_PROMPTS.md` §11.
SMTP env vars production: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

## User Preferences
- Bahasa komentar & log: Indonesia
- Strapi v5 `documentId` pattern untuk ownership checks
- Tidak gunakan GraphQL — REST only
