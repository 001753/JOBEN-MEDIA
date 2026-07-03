# Product Requirements Document (PRD)
# Portal Berita Online — JOBEN NEWS

**Versi:** 1.2 (Revisi Teknis)
**Tanggal:** 3 Juli 2026
**Status:** Draft
**Domain:** news.jobenapp.cloud

---

## 0. Ringkasan Revisi

### v1.0 → v1.1 (Revisi Hosting)
| Aspek | v1.0 | v1.1 |
|---|---|---|
| Hosting utama | VPS milik sendiri | cPanel / shared hosting, dengan fondasi siap migrasi ke cloud server / Google Cloud |
| Database | PostgreSQL Neon/Supabase | PostgreSQL bawaan cPanel (koneksi localhost) |
| Domain | domain-utama.com (placeholder) | news.jobenapp.cloud (frontend) & cms.news.jobenapp.cloud (CMS/API) |
| Proses server | PM2 + Nginx (root access VPS) | cPanel "Setup Node.js App" (Passenger) — tanpa root access |
| Media storage | Cloudflare R2 | Tidak berubah — Cloudflare R2 (S3-compatible, independen dari pilihan hosting) |
| Kesiapan scale-up | — | Ditambahkan: pondasi migrasi ke Google Cloud (Dockerfile, dokumentasi env var, panduan migrasi DB) disiapkan sejak awal |

### v1.1 → v1.2 (Revisi Teknis — perubahan ini)
| Aspek | v1.1 | v1.2 |
|---|---|---|
| Status artikel vs publishedAt | Tidak didefinisikan relasinya | Diperjelas: `status` custom + `publishedAt` Strapi saling dikunci via lifecycle hook |
| Role Penulis (self-edit) | Disebutkan tanpa catatan implementasi | Ditandai eksplisit: butuh custom middleware Strapi |
| ISR revalidation | Hanya time-based (60 detik) | Ditambahkan: on-demand revalidation via webhook Strapi sebagai lapisan kedua |
| views_count | Field di database Article | Dihapus; digantikan GA4 |
| Google Analytics | Tidak disebutkan | Ditambahkan sebagai Must Have di Fase 3 |
| Fitur search | Tidak dispesifikasikan implementasinya | Diperjelas: LIKE query (MVP), full-text search masuk roadmap Fase 2 |
| Breaking news | Logika tidak lengkap (tidak ada batasan) | Diperjelas: hanya 1 artikel breaking news aktif sekaligus (via priority flag) |
| Author vs Strapi User | Entitas terpisah tanpa aturan relasi | Diperjelas: Author wajib di-link ke Strapi User via relasi one-to-one |
| GraphQL | Diaktifkan di MVP | Dihapus dari MVP; masuk roadmap Fase 2 jika ada kebutuhan |
| Target SEO indexing | < 24 jam (tidak realistis) | Direvisi: > 90% artikel ter-index dalam 7 hari |
| Halaman 404 & 500 | Tidak disebutkan | Ditambahkan sebagai Must Have |
| Bagian 10 (prompt AI) | Bagian dari PRD | Dipindahkan ke dokumen terpisah: `AI_PROMPTS.md` |

> **Asumsi nama subdomain:** `cms.news.jobenapp.cloud` digunakan untuk Strapi (CMS/API). Jika menginginkan nama lain (mis. `api.news.jobenapp.cloud`), sesuaikan konsisten di seluruh dokumen ini dan di `AI_PROMPTS.md`.

---

## 1. Ringkasan Eksekutif

Membangun portal media berita online (sejenis detik.com, CNBC Indonesia, CNN Indonesia) dengan sistem redaksi formal (>5 orang), menggunakan arsitektur headless CMS. Target monetisasi utama adalah Google AdSense, dengan fondasi teknis yang mendukung SEO tinggi, kecepatan loading, dan skalabilitas untuk traffic besar.

### 1.1 Tujuan Produk
- Menyediakan platform publikasi berita yang cepat, SEO-friendly, dan mudah dikelola tim redaksi
- Mencapai kelayakan approval Google AdSense
- Membangun fondasi yang bisa scale ke traffic tinggi tanpa rombak ulang arsitektur — dimulai dari shared hosting (biaya rendah) dengan jalur migrasi yang sudah disiapkan ke cloud server/Google Cloud saat traffic tumbuh

### 1.2 Target Pengguna
| Tipe Pengguna | Kebutuhan |
|---|---|
| Pembaca (publik) | Akses berita cepat, mudah dibaca di mobile, navigasi jelas |
| Wartawan/Penulis | Input & edit draft berita dengan mudah |
| Editor/Redaktur | Review, approve, publish, kelola breaking news |
| Super Admin | Kelola user, role, kategori, pengaturan situs |
| Pengiklan (via AdSense) | Slot iklan yang tidak mengganggu UX tapi visible |

---

## 2. Lingkup Produk (Scope)

### 2.1 Dalam Lingkup (In-Scope) — Fase 1 (MVP)
- CMS redaksi (Strapi) dengan role-based access
- Frontend publik (Next.js) — homepage, halaman artikel, kategori, search
- Sistem kategori & tag berita
- Upload media (gambar/video) ke Cloudflare R2
- SEO dasar (sitemap, schema markup, meta tag dinamis)
- Integrasi Google AdSense
- Integrasi Google Analytics 4 (GA4)
- Halaman legal wajib (Privacy Policy, About, Redaksi, Contact)
- Halaman error 404 dan 500

### 2.2 Di Luar Lingkup (Out-of-Scope) — Fase 1
- Live streaming video
- Sistem komentar pembaca
- Aplikasi mobile native (iOS/Android)
- Push notification
- Sistem membership/subscription berbayar
- Multi-bahasa
- GraphQL API
- Full-text search (Algolia/Meilisearch)

*(Item di atas masuk roadmap Fase 2/3, lihat Bagian 8)*

---

## 3. Persona & User Stories

### 3.1 Wartawan/Penulis
- Sebagai wartawan, saya ingin menulis draft artikel dengan editor teks kaya (rich text) agar bisa menyisipkan gambar dan format dengan mudah.
- Sebagai wartawan, saya ingin submit artikel untuk direview, bukan langsung publish, agar terjaga kontrol kualitas.
- Sebagai wartawan, saya hanya ingin bisa mengedit artikel yang saya buat sendiri, bukan artikel wartawan lain.

### 3.2 Editor/Redaktur
- Sebagai editor, saya ingin melihat daftar artikel berstatus "menunggu review" agar bisa cepat approve/tolak.
- Sebagai editor, saya ingin menandai satu artikel sebagai "Breaking News" aktif agar tampil di posisi utama homepage.
- Sebagai editor, saya ingin sistem memastikan hanya satu artikel breaking news yang aktif sekaligus agar tidak ada tumpang-tindih di homepage.

### 3.3 Pembaca
- Sebagai pembaca, saya ingin homepage memuat cepat (<3 detik) di koneksi mobile agar tidak kabur ke situs lain.
- Sebagai pembaca, saya ingin mencari berita berdasarkan kata kunci atau kategori.
- Sebagai pembaca, saya ingin membagikan artikel ke media sosial dengan mudah.
- Sebagai pembaca, saya ingin mendapat halaman pesan yang jelas (404) ketika mengakses URL artikel yang tidak ada.

### 3.4 Super Admin
- Sebagai admin, saya ingin mengatur siapa saja yang punya akses publish agar konten terkontrol.
- Sebagai admin, saya ingin melihat statistik artikel (pageviews, bounce rate) via Google Analytics 4 untuk evaluasi performa konten.

---

## 4. Kebutuhan Fungsional (Functional Requirements)

### 4.1 Modul CMS / Redaksi (Strapi)

| ID | Kebutuhan | Prioritas | Catatan Implementasi |
|---|---|---|---|
| F-01 | Role-based access: Super Admin, Editor, Penulis, Kontributor Media | Must Have | Pembatasan "Penulis hanya edit artikel milik sendiri" **membutuhkan custom middleware Strapi** (lihat Lampiran A) — tidak bisa hanya dari konfigurasi UI Permissions |
| F-02 | Content-type Article: judul, slug otomatis, isi (rich text), gambar cover, kategori, tag, penulis, status editorial, tanggal publish | Must Have | Lihat Bagian 4.1.1 untuk definisi field lengkap dan hubungan `status` ↔ `publishedAt` |
| F-03 | Alur approval: Draft → Review → Published, dengan aturan ketat siapa boleh mengubah ke Published | Must Have | Lihat Bagian 4.1.2 untuk state machine lengkap |
| F-04 | Manajemen kategori & tag (CRUD) | Must Have | |
| F-05 | Upload gambar/video langsung tersimpan ke Cloudflare R2 | Must Have | |
| F-06 | Fitur "Breaking News" — satu artikel aktif sekaligus sebagai headline utama | Should Have | Lihat Bagian 4.1.3 untuk aturan breaking news |
| F-07 | Riwayat revisi artikel (versioning) | Could Have | |
| F-08 | Multi-editor dapat mengedit artikel berbeda secara bersamaan | Should Have | |

---

#### 4.1.1 Definisi Field Content-Type Article

| Field | Tipe | Keterangan |
|---|---|---|
| `title` | Text | Required |
| `slug` | UID (based on title) | Auto-generated, editable |
| `content` | Rich Text (Blocks) | Isi artikel |
| `excerpt` | Text (short) | Ringkasan untuk meta description & card preview |
| `cover_image` | Media (single, image) | Disimpan ke Cloudflare R2 |
| `video_url` | Text | Opsional, untuk embed video eksternal |
| `category` | Relation many-to-one → Category | |
| `tags` | Relation many-to-many → Tag | |
| `author` | Relation many-to-one → Author | Required; Author harus terhubung ke Strapi User (lihat Bagian 4.1.4) |
| `editorial_status` | Enumeration: `draft` \| `review` \| `published` | Status editorial internal redaksi — **terpisah tapi sinkron** dengan `publishedAt` Strapi (lihat Bagian 4.1.2) |
| `is_breaking_news` | Boolean, default `false` | Hanya satu artikel boleh bernilai `true` sekaligus (enforced via lifecycle hook — lihat Bagian 4.1.3) |
| `breaking_news_priority` | Integer, default `0` | Digunakan untuk tie-breaking jika terjadi kondisi edge case (nilai lebih tinggi = prioritas lebih tinggi di homepage) |
| `published_at` | DateTime | Diisi otomatis saat Editor set ke Published; dikelola Strapi native `publishedAt` |

> **Field yang dihapus dari v1.1:** `views_count` — statistik views digantikan sepenuhnya oleh Google Analytics 4 (GA4). Menyimpan view count di database menimbulkan beban write berulang di shared hosting dan tidak memberikan data yang cukup kaya dibanding GA4.

---

#### 4.1.2 State Machine Status Editorial vs. publishedAt Strapi

Strapi memiliki mekanisme draft/publish bawaan yang dikendalikan oleh field `publishedAt` (null = draft native, non-null = published native). PRD ini menambahkan field `editorial_status` untuk mencatat tahap alur editorial redaksi. Kedua field ini **harus selalu konsisten** — dikunci via Strapi Lifecycle Hook pada content-type Article.

```
editorial_status   |  publishedAt (Strapi native)  | Kondisi yang diizinkan
-------------------+-------------------------------+-----------------------------------------------
draft              |  null                         | Artikel baru / sedang ditulis
review             |  null                         | Artikel dikirim ke editor untuk review
published          |  DateTime (non-null)           | Artikel live di frontend
```

**Aturan transisi (diterapkan via Lifecycle Hook `beforeUpdate`):**

| Aktor | Transisi yang diizinkan |
|---|---|
| Penulis | `draft` → `review` saja (tidak boleh set ke `published` atau mengisi `publishedAt`) |
| Editor | `review` → `published` (otomatis mengisi `publishedAt = now()`) atau `review` → `draft` (tolak) |
| Editor | `published` → `draft` (unpublish, otomatis set `publishedAt = null`) |
| Super Admin | Semua transisi |

**Konsekuensi inkonsistensi yang dicegah:**
- Dilarang: `editorial_status = published` dengan `publishedAt = null`
- Dilarang: `editorial_status = draft/review` dengan `publishedAt` terisi
- Hook akan throw error dan batalkan update jika aturan dilanggar

> **Catatan implementasi:** Lifecycle hook ini ditulis di `src/api/article/content-types/article/lifecycles.js`. Detail kode ada di `AI_PROMPTS.md` Prompt 10.1.

---

#### 4.1.3 Aturan Breaking News

Hanya **satu artikel** yang boleh memiliki `is_breaking_news = true` sekaligus. Ini ditegakkan via Lifecycle Hook:

- Saat Editor men-set `is_breaking_news = true` pada artikel X, sistem otomatis men-set `is_breaking_news = false` pada **seluruh** artikel lain yang sebelumnya `true`.
- Tidak ada mekanisme "multiple breaking news aktif" — jika kebutuhan ini muncul di masa depan, akan dibahas di Fase 2.
- Field `breaking_news_priority` disediakan untuk edge case: jika karena kondisi race condition ada >1 artikel dengan `is_breaking_news = true`, frontend mengambil artikel dengan `breaking_news_priority` tertinggi sebagai headline utama.
- Di homepage: jika tidak ada artikel dengan `is_breaking_news = true`, tampilkan artikel terbaru (`published_at` terbaru) sebagai headline utama — **tanpa** breaking news ticker/banner.

---

#### 4.1.4 Relasi Author ↔ Strapi User

Content-type `Author` **bukan** entitas independen yang sepenuhnya terpisah dari sistem autentikasi Strapi. Setiap Author harus terhubung ke tepat satu Strapi User (akun login), via relasi one-to-one.

**Struktur Author:**

| Field | Tipe | Keterangan |
|---|---|---|
| `name` | Text | Required; nama tampil di artikel |
| `photo` | Media (single, image) | Foto profil |
| `bio` | Text | Biografi singkat |
| `role_label` | Enumeration: `penulis` \| `editor` \| `admin` | Label display untuk halaman /redaksi — berbeda dari role akses Strapi |
| `user` | Relation one-to-one → Strapi User (plugin users-permissions) | **Required** — Author TIDAK BOLEH dibuat tanpa Strapi User yang terhubung |

**SOP Onboarding Anggota Redaksi Baru:**
1. Super Admin membuat akun Strapi User (email + password) dengan role yang sesuai (Editor/Penulis)
2. Super Admin membuat entri Author baru dan link ke User yang baru dibuat
3. Penulis login ke Strapi Admin dan membuat artikel — field `author` di artikel diisi dengan entri Author yang sesuai

> **Mengapa tidak langsung pakai Strapi User?** Strapi User mengandung data sensitif (email, hash password). Content-type Author memisahkan data display publik (nama, foto, bio) dari data autentikasi. Relasi one-to-one menjembatani keduanya.

---

#### 4.1.5 Custom Middleware untuk Pembatasan Penulis (Self-Edit Only)

Role "Penulis" dibatasi hanya dapat membuat dan mengedit artikel yang `author` field-nya terhubung ke Author yang berelasi dengan Strapi User mereka sendiri.

**Ini TIDAK dapat dikonfigurasi hanya dari menu Users & Permissions di Strapi Admin UI.** Membutuhkan custom policy yang:

1. Intercept request `PUT /api/articles/:id`
2. Ambil artikel yang hendak diedit dari database
3. Bandingkan `article.author.user.id` dengan `ctx.state.user.id` (user yang sedang login)
4. Jika tidak sama, return `403 Forbidden`
5. Untuk `POST /api/articles`: otomatis set `author` ke Author yang terhubung dengan user yang sedang login

> **File implementasi:** `src/api/article/policies/is-own-article.js` — detail ada di `AI_PROMPTS.md` Prompt 10.1.

---

### 4.2 Modul Frontend Publik (Next.js)

| ID | Kebutuhan | Prioritas | Catatan Implementasi |
|---|---|---|---|
| F-09 | Homepage dengan headline utama, breaking news ticker (hanya muncul jika ada breaking news aktif), kategori berita | Must Have | |
| F-10 | Halaman detail artikel dengan gambar, isi, related articles, share button | Must Have | |
| F-11 | Halaman kategori (listing berita per kategori) dengan pagination | Must Have | |
| F-12 | Fitur pencarian berita berbasis keyword | Must Have | Lihat Bagian 4.2.1 untuk spesifikasi search |
| F-13 | Desain responsif (mobile-first, karena mayoritas trafik media adalah mobile) | Must Have | |
| F-14 | Sitemap.xml otomatis update | Must Have | |
| F-15 | Schema markup `NewsArticle` (JSON-LD) di tiap artikel | Must Have | |
| F-16 | Integrasi slot iklan Google AdSense (header, in-article, sidebar) | Must Have | Gunakan komponen `AdSlot` terpisah |
| F-17 | Halaman statis: About, Contact, Privacy Policy, Redaksi/Editorial Team | Must Have | |
| F-18 | Open Graph tag otomatis (agar tampil bagus saat dibagikan ke medsos) | Must Have | Dinaikkan dari Should Have karena kritikal untuk viralitas berita |
| F-19 | Halaman 404 (Not Found) dan 500 (Server Error) kustom | Must Have | |
| F-20 | Integrasi Google Analytics 4 (GA4) — tracking pageview, event share, search | Must Have | Lihat Bagian 4.2.2 |
| F-21 | Dark mode | Could Have | |

---

#### 4.2.1 Spesifikasi Fitur Search (Fase 1 MVP)

Fitur search di Fase 1 menggunakan **Strapi built-in filter** dengan operator `$containsi` (case-insensitive contains) pada PostgreSQL. Ini setara dengan `ILIKE '%keyword%'` query.

**Yang dicakup Fase 1:**
- Search berdasarkan `title` dan `excerpt`
- Hasil diurutkan berdasarkan `published_at` descending
- Tampilkan maksimal 20 hasil per halaman

**Keterbatasan yang diterima di Fase 1:**
- Search pada body konten artikel (`content`) tidak diaktifkan — ILIKE pada kolom Rich Text berukuran besar sangat lambat
- Tidak ada fuzzy match / toleransi typo
- Tidak ada ranking relevansi

**Roadmap Fase 2:** Implementasi full-text search menggunakan PostgreSQL `tsvector`/`tsquery` (native, tanpa service eksternal) atau integrasi Meilisearch/Algolia jika traffic sudah signifikan.

> **Catatan untuk frontend:** Tampilkan pesan "Mencari: [keyword]..." dan state "Tidak ada hasil untuk [keyword]" secara eksplisit. Jangan tampilkan halaman kosong tanpa keterangan.

---

#### 4.2.2 Integrasi Google Analytics 4 (GA4)

GA4 adalah pengganti `views_count` di database dan sumber data utama untuk semua metrik performa konten.

**Events yang harus di-track:**
| Event | Trigger |
|---|---|
| `page_view` | Setiap halaman dimuat (otomatis via gtag.js) |
| `article_view` | Saat halaman detail artikel dimuat (kirim: `article_slug`, `article_category`, `article_author`) |
| `share_click` | Saat tombol share diklik (kirim: `platform` = whatsapp/facebook/twitter, `article_slug`) |
| `search_submit` | Saat user submit search (kirim: `search_term`) |
| `breaking_news_click` | Saat user klik dari breaking news ticker/banner |

**Implementasi:**
- Gunakan `@next/third-parties` (`GoogleTagManager` atau `GoogleAnalytics` component) — bukan script manual
- GA Measurement ID disimpan di environment variable `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Aktifkan hanya di `NODE_ENV=production` untuk menghindari polusi data saat development

**Catatan privasi:**
- Privacy Policy wajib menyebutkan penggunaan GA4 dan cookie analytics
- Tidak memerlukan cookie consent banner (karena media berita umum, bukan layanan berbayar), tapi ini bisa ditinjau ulang sesuai regulasi yang berlaku.

---

### 4.3 Modul Infrastruktur

| ID | Kebutuhan | Prioritas | Catatan Implementasi |
|---|---|---|---|
| F-22 | Database PostgreSQL bawaan cPanel ("PostgreSQL Databases"), koneksi lokal (`localhost`) ke Strapi | Must Have | |
| F-23 | Storage media di Cloudflare R2, terhubung via plugin upload provider Strapi (S3-compatible) | Must Have | |
| F-24 | CDN & DNS via Cloudflare, proxy untuk `news.jobenapp.cloud` dan `cms.news.jobenapp.cloud` | Must Have | |
| F-25 | ISR di Next.js dengan dua lapisan revalidation: (a) time-based 60 detik, (b) on-demand via webhook dari Strapi | Must Have | Lihat Bagian 4.3.1 untuk detail arsitektur ISR |
| F-26 | Backup otomatis database (cPanel Backup Wizard/JetBackup) + cron job `pg_dump` terjadwal sebagai lapisan kedua | Should Have | |
| F-27 | Kesiapan migrasi ke cloud/Google Cloud: Dockerfile, dokumentasi environment variable terpusat, dan panduan migrasi database disiapkan sejak awal | Should Have | |

---

#### 4.3.1 Arsitektur ISR Dua Lapisan

**Masalah dengan ISR time-based saja di shared hosting:**
Proses Next.js di Passenger (cPanel) bisa di-idle saat tidak ada traffic. Ketika proses idle, background revalidation berhenti. Artikel baru yang dipublish tidak akan muncul sampai ada request pertama yang membangunkan proses (cold start), yang bisa memakan waktu beberapa detik hingga menit.

**Solusi: Dua lapisan ISR**

**Lapisan 1 — Time-based ISR (60 detik):**
```
revalidate = 60  // di setiap page yang fetch data dari Strapi
```
Berjalan otomatis. Menangani update berkala saat proses aktif.

**Lapisan 2 — On-demand Revalidation via Webhook:**
```
Strapi lifecycle hook (afterCreate/afterUpdate/afterDelete pada Article)
    │
    └──► POST https://news.jobenapp.cloud/api/revalidate
             body: { secret: REVALIDATION_SECRET, slug: article.slug }
             │
             └──► Next.js API Route /api/revalidate/route.js
                      │  (validasi REVALIDATION_SECRET)
                      └──► revalidatePath('/') — homepage
                           revalidatePath(`/artikel/${slug}`)
                           revalidatePath(`/kategori/${category_slug}`)
```

Ketika Editor mempublish artikel di Strapi, Strapi otomatis kirim webhook ke Next.js, yang langsung meng-invalidasi cache halaman terkait — tanpa menunggu 60 detik.

**Environment variables baru yang diperlukan:**
- `REVALIDATION_SECRET` — string acak panjang, diset di kedua sisi (Strapi env + Next.js env) untuk autentikasi webhook

**Mitigasi cold start:**
- Cron job ping setiap 10 menit ke `https://news.jobenapp.cloud` dan `https://cms.news.jobenapp.cloud/api` (via cPanel Cron Jobs) agar proses tetap aktif.

---

## 5. Kebutuhan Non-Fungsional

| Kategori | Target | Catatan |
|---|---|---|
| **Performa** | Homepage load < 3 detik di 4G; Core Web Vitals lolos (LCP < 2.5s, CLS < 0.1) | Diukur via Google PageSpeed Insights / Lighthouse |
| **Skalabilitas** | Fase awal (cPanel shared hosting): kapasitas dibatasi resource quota hosting, dimitigasi dengan caching agresif via Cloudflare + ISR dua lapisan. Fase lanjutan: migrasi ke Google Cloud (Cloud Run/Compute Engine) | |
| **SEO** | > 90% artikel ter-index Google dalam **7 hari** sejak publish | Target < 24 jam tidak realistis untuk domain baru. Indexing speed bergantung crawl budget dan domain authority yang bertumbuh seiring waktu. Gunakan Google Search Console "URL Inspection" untuk request indexing manual artikel penting. |
| **Keamanan** | Role-based access control, HTTPS wajib (AutoSSL cPanel/Cloudflare), rate limiting API Strapi | |
| **Ketersediaan (Uptime)** | Target 99.5% | |
| **Kepatuhan AdSense** | Konten orisinal, tanpa konten terlarang, UX bersih dari iklan mengganggu | Minimal 20–30 artikel orisinal + semua halaman legal aktif sebelum daftar |
| **Analitik** | Semua metrik performa konten (pageviews, bounce rate, traffic source) diukur via GA4 | Tidak menggunakan counter database internal |

---

## 6. Arsitektur Teknis

### 6.1 Arsitektur Saat Ini — cPanel / Shared Hosting

```
Cloudflare (DNS + CDN + SSL Proxy)
        │
        ├── news.jobenapp.cloud ───────► cPanel Node.js App #1: Next.js (SSR/ISR)
        │                                        │
        │                                        └──► /api/revalidate (webhook endpoint)
        │
        └── cms.news.jobenapp.cloud ───► cPanel Node.js App #2: Strapi (CMS/API)
                                                  │
                                                  ├──► PostgreSQL bawaan cPanel
                                                  │     (koneksi localhost, tanpa SSL)
                                                  │
                                                  ├──► Cloudflare R2 (media gambar/video)
                                                  │
                                                  └──► Webhook → news.jobenapp.cloud/api/revalidate
                                                        (dipicu saat artikel publish/update/delete)
```

**Stack:**
- Hosting: cPanel Shared Hosting, fitur "Setup Node.js App" (Passenger)
- CMS: Strapi v5 (role-based, headless, REST API only — GraphQL tidak diaktifkan)
- Frontend: Next.js (App Router, ISR dua lapisan)
- Database: PostgreSQL bawaan cPanel (koneksi `localhost`)
- Media Storage: Cloudflare R2 (S3-compatible)
- CDN/DNS: Cloudflare
- Analitik: Google Analytics 4
- Monetisasi: Google AdSense

### 6.2 Jalur Migrasi ke Cloud Server / Google Cloud (Fondasi)

Disiapkan sejak awal agar bisa dieksekusi kapan saja tanpa rombak arsitektur:

```
cPanel Node.js App (Strapi + Next.js)
        │  dikemas ulang via Dockerfile yang sudah disiapkan
        ▼
Google Cloud
        ├── Cloud Run / Compute Engine ── menjalankan container Strapi & Next.js
        ├── Cloud SQL for PostgreSQL ──── hasil migrasi via pg_dump/pg_restore
        └── Cloudflare R2 tetap dipakai (S3-compatible, tidak perlu migrasi storage)

DNS & CDN tetap Cloudflare — saat migrasi cukup ubah A/CNAME record dari IP
shared hosting ke endpoint Cloud Run/Compute Engine (gunakan TTL rendah
sebelum migrasi untuk meminimalkan downtime).
```

Prinsip desain agar migrasi mulus:
- Semua kredensial & konfigurasi lewat **environment variable** (tidak ada hardcode path/host khusus cPanel di kode aplikasi)
- Media selalu di Cloudflare R2 — tidak pernah di local disk server
- Dockerfile untuk Strapi & Next.js disiapkan sejak Fase 1 (lihat `AI_PROMPTS.md` Prompt 10.7)

---

## 7. Metrik Keberhasilan (Success Metrics)

| Metrik | Target Fase 1 (3 bulan pertama) | Cara Ukur |
|---|---|---|
| Jumlah artikel published | 150+ artikel | Strapi dashboard |
| Waktu load homepage | < 3 detik | Google PageSpeed Insights |
| Approval Google AdSense | Diterima | — |
| Index rate di Google Search Console | > 90% artikel ter-index dalam 7 hari | Google Search Console |
| Bounce rate | < 60% | Google Analytics 4 |
| Uptime | > 99% | UptimeRobot (gratis) atau monitoring cPanel |
| Pageviews per artikel (rata-rata) | Baseline bulan pertama, diukur di GA4 | GA4 |

---

## 8. Roadmap & Prioritas

### 🟢 Fase 0 — Persiapan (Minggu 1)
1. Setup akun & tools: domain `news.jobenapp.cloud` (sudah ada), akun hosting cPanel, buat subdomain `cms.news.jobenapp.cloud`, aktifkan Cloudflare (DNS + CDN), siapkan GitHub repo
2. Tentukan struktur kategori berita & editorial guideline (SOP redaksi)
3. Rekrut/briefing tim redaksi (role: siapa jadi editor, siapa penulis)

### 🟡 Fase 1 — Fondasi Teknis (Minggu 2-4)
4. Buat database PostgreSQL via cPanel (menu "PostgreSQL Databases"): buat database, buat user, assign privilege ALL
5. Install & konfigurasi Strapi v5 (development di Replit dulu, deployment ke cPanel di Fase 4)
6. Buat content-type sesuai spesifikasi Bagian 4.1.1: Article, Category, Tag, Author, Page
7. Implementasi Lifecycle Hooks: state machine status artikel (Bagian 4.1.2) + enforcer breaking news satu aktif (Bagian 4.1.3)
8. Implementasi custom policy self-edit untuk role Penulis (Bagian 4.1.5)
9. Setup role & permission (Super Admin, Editor, Penulis, Kontributor)
10. Setup Cloudflare R2 + hubungkan plugin upload provider ke Strapi
11. Testing alur upload gambar/video dari Strapi ke R2

### 🟤 Fase Paralel — Fondasi Migrasi Cloud (opsional, tidak menunda go-live)
11a. Siapkan Dockerfile untuk Strapi & Next.js (disimpan di repo, tidak dijalankan di cPanel)
11b. Dokumentasikan seluruh environment variable dalam `.env.example`
11c. Susun `MIGRATION.md`: langkah pg_dump/pg_restore ke Cloud SQL dan deploy container ke Cloud Run

### 🟠 Fase 2 — Frontend Dasar (Minggu 4-6)
12. Setup project Next.js (App Router), hubungkan REST API ke Strapi
13. Bangun homepage (headline, breaking news ticker kondisional, grid per kategori)
14. Bangun halaman detail artikel
15. Bangun halaman kategori & search (LIKE query, sesuai spesifikasi Bagian 4.2.1)
16. Bangun halaman 404 (`not-found.js`) dan 500 (`error.js`) kustom
17. Implementasi ISR dua lapisan: time-based 60 detik + webhook on-demand (Bagian 4.3.1)
18. Implementasi desain responsif (mobile-first)

### 🔵 Fase 3 — SEO, Analitik & Kepatuhan AdSense (Minggu 6-7)
19. Implementasi sitemap.xml otomatis
20. Tambahkan schema markup NewsArticle (JSON-LD)
21. Tambahkan Open Graph meta tag (og:title, og:image, og:description, Twitter Card)
22. Pasang Google Analytics 4 (GA4) via `@next/third-parties` + setup custom events (Bagian 4.2.2)
23. Buat halaman wajib: About, Contact, Privacy Policy (mention GA4), Redaksi
24. Setup Google Search Console + submit sitemap (`https://news.jobenapp.cloud/sitemap.xml`)
25. Siapkan slot placeholder AdSense via komponen `AdSlot` (header, in-article, sidebar)

### 🟣 Fase 4 — Deployment & Konten (Minggu 7-9)
26. Buat 2 Node.js App terpisah di cPanel:
    - App Strapi → `cms.news.jobenapp.cloud`
    - App Next.js → `news.jobenapp.cloud`
27. Build production (`strapi build` / `next build`) via Terminal cPanel/SSH, restart masing-masing app
28. Arahkan DNS via Cloudflare + aktifkan SSL (AutoSSL)
29. Setup cron job ping setiap 10 menit untuk anti-idle Passenger
30. Redaksi mulai isi konten (target 20-30 artikel orisinal sebelum daftar AdSense)
31. QA menyeluruh: kecepatan, mobile, broken link, alur approval, webhook revalidation, 404/500

### ⚪ Fase 5 — Monetisasi & Go-Live (Minggu 9-10)
32. Daftar Google AdSense
33. Pasang kode AdSense resmi ke komponen `AdSlot` setelah approve
34. Soft launch — pantau traffic (GA4), uptime, error log, resource usage cPanel
35. Public launch / promosi

### Roadmap Lanjutan (Fase 2 Produk — setelah stabil)
- Sistem komentar pembaca
- Push notification (web push)
- Newsletter/email digest
- Video streaming terintegrasi (Cloudflare Stream)
- Aplikasi mobile (native/PWA)
- GraphQL API (jika ada kebutuhan klien mobile/third-party)
- Full-text search (PostgreSQL `tsvector` atau Meilisearch) untuk akurasi pencarian lebih baik
- **Migrasi ke Google Cloud** (eksekusi jalur migrasi di Bagian 6.2) apabila traffic melampaui kapasitas shared hosting

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Traffic melonjak tiba-tiba (berita viral) menyebabkan server lambat/down | Tinggi | CDN Cloudflare + ISR dua lapisan mengurangi beban server asal; jika kapasitas shared hosting terlampaui, eksekusi migrasi ke Google Cloud (Bagian 6.2) |
| Keterbatasan resource shared hosting cPanel (kuota CPU/RAM/jumlah proses) | Tinggi | Pantau resource cPanel berkala; siapkan jalur migrasi ke Google Cloud |
| Proses Node.js (Passenger) idle/berhenti saat tidak ada trafik | Sedang | Cron job ping setiap 10 menit ke kedua endpoint; ISR on-demand via webhook memastikan update tetap tersampaikan saat proses aktif |
| Webhook revalidation gagal (Next.js tidak bisa dihubungi saat Strapi publish) | Sedang | Time-based ISR 60 detik sebagai fallback; log webhook error di Strapi; tambahkan retry sederhana (1x) di lifecycle hook |
| Bug lifecycle hook state machine menyebabkan artikel tidak bisa dipublish | Sedang | Unit test lifecycle hook sebelum deployment; sediakan fallback via Super Admin yang bisa bypass lewat Strapi Admin UI |
| Konten dianggap duplikat/plagiat saat review AdSense | Tinggi | SOP redaksi wajib artikel orisinal |
| Tim redaksi belum familiar dengan Strapi | Sedang | Buat panduan/SOP internal + sesi training singkat |
| Video besar membebani storage R2 | Sedang | Kompres video sebelum upload; evaluasi Cloudflare Stream jika volume naik |
| Approval AdSense ditolak karena halaman legal belum lengkap | Sedang | Pastikan Privacy Policy, About, Contact sudah live sebelum daftar |
| Domain baru: artikel lambat ter-index Google | Sedang | Submit sitemap ke Search Console; gunakan "Request Indexing" manual untuk artikel penting; target realistis 7 hari (bukan 24 jam) |

---

## Lampiran A — Ringkasan Custom Code yang Dibutuhkan di Strapi

Berikut daftar kode kustom yang **tidak dapat dibuat hanya dari Strapi Admin UI** dan harus ditulis manual:

| File | Fungsi |
|---|---|
| `src/api/article/content-types/article/lifecycles.js` | (1) Enforce state machine `editorial_status` ↔ `publishedAt`; (2) Enforce hanya satu `is_breaking_news = true` aktif sekaligus |
| `src/api/article/policies/is-own-article.js` | Membatasi Penulis hanya bisa edit/delete artikel milik sendiri |
| `src/api/revalidate/routes/revalidate.js` *(atau via Strapi lifecycle ke webhook eksternal)* | Kirim HTTP POST ke Next.js `/api/revalidate` setelah Article publish/update/delete |

Detail implementasi lengkap ada di `AI_PROMPTS.md`.

---

## Lampiran B — Environment Variables Lengkap

### Strapi (`cms.news.jobenapp.cloud`)
```
# Database
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cpaneluser_newsdb
DATABASE_USERNAME=cpaneluser_newsuser
DATABASE_PASSWORD=<isi_di_cpanel>
DATABASE_SSL=false

# Strapi Keys (generate via: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
APP_KEYS=<key1>,<key2>,<key3>,<key4>
API_TOKEN_SALT=<random>
ADMIN_JWT_SECRET=<random>
JWT_SECRET=<random>
TRANSFER_TOKEN_SALT=<random>

# Cloudflare R2
R2_ACCESS_KEY_ID=<dari_r2_dashboard>
R2_SECRET_ACCESS_KEY=<dari_r2_dashboard>
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=<nama_bucket>
R2_PUBLIC_URL=https://<custom_domain_r2_atau_public_url>

# Webhook ke Next.js (untuk on-demand revalidation)
NEXTJS_REVALIDATION_URL=https://news.jobenapp.cloud/api/revalidate
REVALIDATION_SECRET=<random_string_panjang>

# Runtime
NODE_ENV=production
```

### Next.js (`news.jobenapp.cloud`)
```
# Strapi API
NEXT_PUBLIC_STRAPI_API_URL=https://cms.news.jobenapp.cloud
STRAPI_API_TOKEN=<api_token_read_only_dari_strapi>

# ISR On-demand Revalidation
REVALIDATION_SECRET=<sama_dengan_di_strapi>

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Runtime
NODE_ENV=production
```

---

## 11. Catatan Tambahan

- Prioritas "Must Have" pada Bagian 4 adalah syarat minimum agar situs bisa go-live dan layak didaftarkan ke AdSense.
- Jangan daftar AdSense sebelum minimal 20-30 artikel orisinal published dan seluruh halaman legal aktif.
- Development CMS/Strapi dimulai di Replit; untuk production dijalankan di cPanel shared hosting via "Setup Node.js App".
- Alur kerja pengembangan: **Replit (develop + build) → GitHub (push) → cPanel (pull/deploy)**. Lihat detail di `AI_PROMPTS.md` Bagian 11.
- Pantau kuota resource cPanel (CPU/RAM/proses) secara berkala. Jalur migrasi ke cloud sudah disiapkan (Bagian 6.2).
- Semua prompt implementasi ada di dokumen terpisah: **`AI_PROMPTS.md`**.
