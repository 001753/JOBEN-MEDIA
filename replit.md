# JOBEN NEWS — Strapi v5 Backend CMS

Headless CMS untuk portal berita JOBEN NEWS. Dibangun dengan Strapi v5 (REST only, no GraphQL).

## Stack
- **CMS**: Strapi v5.50.0
- **Database dev**: SQLite (Replit) | **Database prod**: PostgreSQL (cPanel)
- **Media storage**: Cloudflare R2 (via @strapi/provider-upload-aws-s3)
- **Frontend**: Next.js App Router (repo terpisah) di `news.jobenapp.cloud`

## Menjalankan di Replit
Klik **Run** — workflow `npm run develop` akan start Strapi di port 5000.

Buka admin panel di preview Replit → `/admin`.

## Content Types
| Tipe | Keterangan |
|---|---|
| `Article` | Artikel berita — draftAndPublish, editorial_status, is_breaking_news |
| `Category` | Kategori berita |
| `Tag` | Tag multi-pilih untuk artikel |
| `Author` | Profil penulis — linked one-to-one ke Strapi User |
| `Page` | Halaman statis (About, Privacy Policy, dll) |

## Editorial Workflow
- `editorial_status`: `draft` → `review` → `published`
- Sinkron otomatis dengan `publishedAt` (Strapi native draft/publish) via lifecycle hook
- Hanya 1 artikel breaking news aktif sekaligus (enforced via lifecycle)
- Penulis hanya bisa edit artikel milik sendiri (policy `is-own-article`)

## Env vars penting
| Var | Nilai |
|---|---|
| `PORT` | 5000 (Replit), bebas di cPanel via Passenger |
| `DATABASE_CLIENT` | `sqlite` (dev) atau `postgres` (prod) |
| `R2_*` | Credentials Cloudflare R2 |
| `NEXTJS_REVALIDATION_URL` | https://news.jobenapp.cloud/api/revalidate |

Semua secrets tersimpan di Replit Secrets (bukan file .env).

## Deploy ke cPanel
Lihat `doc/AI_PROMPTS.md` §11 untuk alur deploy via GitHub.

## User preferences
- Bahasa komentar & log: Indonesia
- Strapi v5 documentId pattern untuk ownership checks
- Tidak gunakan GraphQL — REST only
