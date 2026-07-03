# AI Implementation Prompts — JOBEN NEWS Portal Berita
# Panduan Pengembangan Berbasis Replit → GitHub → cPanel

**Versi:** 1.2
**Tanggal:** 3 Juli 2026
**Dokumen terkait:** `PRD.md`

---

## Petunjuk Penggunaan

Jalankan prompt berikut **secara berurutan** sesuai roadmap di PRD Bagian 8. Setiap prompt dirancang untuk satu sesi pengembangan di Replit.

### Alur Kerja Utama (Replit → GitHub → cPanel)
```
1. Develop & build di Replit
       │
       ▼
2. Push ke GitHub (git push origin main)
       │
       ▼
3. Di cPanel: pull dari GitHub via Terminal SSH
   (git pull origin main)
   lalu jalankan npm install & restart app
```

Detail lengkap alur ini ada di **Bagian 11** dokumen ini.

### Aturan Penggunaan Prompt
- Jalankan **satu prompt per sesi** agar AI tidak mengerjakan terlalu banyak hal sekaligus
- Sesuaikan nama project, domain, dan kredensial sebelum dipakai
- Setiap prompt bersifat **incremental** — mengasumsikan prompt sebelumnya sudah selesai
- Prompt 10.7 bisa dijalankan kapan saja secara paralel (tidak menunda go-live)

---

## 10.1 Prompt — Setup Strapi CMS + Lifecycle Hooks + Custom Policy (Fase 1)

```
Saya ingin membangun backend CMS untuk portal berita menggunakan Strapi v5
(headless CMS). Backend ini nantinya dijalankan di cPanel shared hosting via
fitur "Setup Node.js App" (Passenger), pada subdomain cms.news.jobenapp.cloud.

Buatkan project Strapi v5 baru dengan konfigurasi berikut:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PostgreSQL bawaan cPanel, koneksi LOKAL (Strapi dan database di server yang sama).
Gunakan environment variable berikut (akan diisi manual di cPanel):
  DATABASE_CLIENT=postgres
  DATABASE_HOST=localhost
  DATABASE_PORT=5432
  DATABASE_NAME        (format cPanel: cpaneluser_namadb)
  DATABASE_USERNAME    (format cPanel: cpaneluser_namauser)
  DATABASE_PASSWORD
  DATABASE_SSL=false

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. CONTENT-TYPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

a. Article — field-field berikut:
   - title              (Text, required)
   - slug               (UID, based on title)
   - content            (Rich Text / Blocks)
   - excerpt            (Text, ringkasan untuk meta description & card preview)
   - cover_image        (Media, single, image only)
   - video_url          (Text, opsional, untuk embed video eksternal)
   - category           (Relation, many-to-one → Category)
   - tags               (Relation, many-to-many → Tag)
   - author             (Relation, many-to-one → Author, required)
   - editorial_status   (Enumeration: draft | review | published, default: draft)
   - is_breaking_news   (Boolean, default false)
   - breaking_news_priority (Integer, default 0)
   - published_at       (DateTime — diisi otomatis via lifecycle hook, jangan diisi manual)

   CATATAN PENTING: JANGAN tambahkan field views_count. Statistik views
   ditangani oleh Google Analytics 4, bukan database.

b. Category:
   - name        (Text, required)
   - slug        (UID, based on name)
   - description (Text, opsional)

c. Tag:
   - name (Text, required)
   - slug (UID, based on name)

d. Author:
   - name       (Text, required) — nama tampil di artikel
   - photo      (Media, single, image)
   - bio        (Text)
   - role_label (Enumeration: penulis | editor | admin) — label display untuk halaman /redaksi
   - user       (Relation, one-to-one → plugin::users-permissions.user, required)
                Setiap Author WAJIB terhubung ke satu Strapi User untuk login.

e. Page (untuk halaman statis: About, Privacy Policy, Contact, Redaksi):
   - title   (Text, required)
   - slug    (UID, based on title)
   - content (Rich Text)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. LIFECYCLE HOOKS — WAJIB DIIMPLEMENTASI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buatkan file src/api/article/content-types/article/lifecycles.js dengan
dua fungsi utama yang dipanggil di hook beforeUpdate dan beforeCreate:

FUNGSI A — State Machine editorial_status ↔ publishedAt:

Aturan yang harus di-enforce:
  - editorial_status=draft    → publishedAt HARUS null
  - editorial_status=review   → publishedAt HARUS null
  - editorial_status=published → publishedAt HARUS DateTime non-null (set ke now() jika belum diisi)
  - Transisi yang valid (berdasarkan role user yang sedang login):
      * Penulis  : hanya boleh draft→review (tidak boleh set published)
      * Editor   : boleh review→published, review→draft, published→draft
      * Super Admin: semua transisi
  - Jika ada pelanggaran, throw error dengan pesan yang jelas agar frontend bisa tampilkan
  - Jika editorial_status diubah ke published dan publishedAt masih null,
    otomatis set publishedAt = new Date() (jangan throw error, isi otomatis)
  - Jika editorial_status diubah ke draft/review dan publishedAt terisi,
    otomatis set publishedAt = null

FUNGSI B — Enforce satu breaking news aktif sekaligus:

  - Saat artikel di-update dengan is_breaking_news = true:
    1. Cari semua artikel lain yang is_breaking_news = true
    2. Set semua artikel tersebut menjadi is_breaking_news = false via strapi.db.query
    3. Baru lanjutkan update artikel yang sedang diproses
  - Ini harus berjalan di hook beforeUpdate (sebelum save)
  - Log ke console saat ada artikel yang di-reset agar mudah di-debug

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. CUSTOM POLICY — Self-Edit untuk Role Penulis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buatkan src/api/article/policies/is-own-article.js:
  - Intercept request update (PUT) dan delete (DELETE) pada Article
  - Ambil artikel dari database berdasarkan ID di params
  - Ambil Author yang terhubung ke ctx.state.user (user yang sedang login)
  - Bandingkan article.author.id dengan author.id milik user yang login
  - Jika tidak sama, kembalikan 403 Forbidden dengan pesan:
    "Anda hanya dapat mengedit artikel yang Anda buat sendiri."
  - Jika role user adalah Editor atau Super Admin, skip policy ini (izinkan semua)

Buatkan juga middleware untuk POST Article (create baru):
  - Otomatis set field author ke Author yang terhubung ke user yang sedang login
  - Jika user yang login tidak punya entri Author yang terhubung, kembalikan 400 Bad Request:
    "Akun Anda belum memiliki profil Author. Hubungi Super Admin."

Daftarkan policy ini di src/api/article/routes/article.js untuk route
update dan delete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. WEBHOOK — On-Demand Revalidation ke Next.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buatkan src/api/article/content-types/article/lifecycles.js (tambahkan ke
file yang sudah ada di poin 3) — hook afterCreate, afterUpdate, afterDelete:

  - Setelah artikel berhasil dibuat/diupdate/dihapus dengan editorial_status=published:
    1. Kirim HTTP POST ke process.env.NEXTJS_REVALIDATION_URL
       dengan body JSON:
         { "secret": process.env.REVALIDATION_SECRET,
           "slug": article.slug,
           "categorySlug": article.category?.slug }
       dan header: { "Content-Type": "application/json" }
    2. Gunakan node-fetch atau native fetch (Node 18+) — jangan install package baru
       jika Node 18+ sudah tersedia
    3. Jika request gagal (network error atau response bukan 2xx):
       - Log error ke console dengan detail (URL, status code, body)
       - Jangan throw error / jangan batalkan operasi Strapi yang sudah berhasil
       - Tambahkan satu kali retry setelah 2 detik

  Environment variable baru yang diperlukan:
    NEXTJS_REVALIDATION_URL=https://news.jobenapp.cloud/api/revalidate
    REVALIDATION_SECRET=<random string panjang, sama dengan yang di Next.js>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. ROLE & PERMISSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Setup di menu Users & Permissions Plugin:
  - Super Admin : akses penuh ke semua content-type
  - Editor      : create, update, publish/unpublish Article; CRUD Category, Tag;
                  tidak bisa hapus atau buat User
  - Penulis     : create Article (author otomatis = diri sendiri);
                  update Article milik sendiri saja (via custom policy);
                  tidak bisa set editorial_status = published;
                  tidak bisa akses Category/Tag CRUD
  - Kontributor Media: hanya akses upload media (plugin upload), tidak bisa
                       create atau edit artikel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. CORS & API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Konfigurasi CORS di config/middlewares.js:
  origins yang diizinkan:
    - https://news.jobenapp.cloud (production frontend)
    - http://localhost:3000 (development)
    - http://localhost:3001 (development alternatif)

Aktifkan REST API untuk semua content-type.
JANGAN aktifkan GraphQL — tidak dibutuhkan di Fase 1.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. STARTUP FILE UNTUK CPANEL (PASSENGER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buatkan file server.js di root project yang:
  - Menjalankan Strapi dan memastikan listen di process.env.PORT
    (BUKAN port 1337 hardcode — cPanel menetapkan port sendiri via Passenger)
  - Contoh isi:
      process.env.PORT = process.env.PORT || 1337;
      const strapi = require('@strapi/strapi');
      strapi().start();
  - Jelaskan bahwa file ini yang harus diset sebagai "Application startup file"
    di panel cPanel > Setup Node.js App

Setelah selesai, jelaskan cara generate API Token read-only dari Strapi Admin
(Settings > API Tokens > Create new token, type: Read-only) untuk dipakai
di frontend Next.js sebagai STRAPI_API_TOKEN.
```

---

## 10.2 Prompt — Integrasi Cloudflare R2 sebagai Storage Media (Fase 1)

```
Project Strapi v5 saya sudah berjalan. Sekarang saya ingin mengganti default
upload provider (local storage) menjadi Cloudflare R2, karena media tidak boleh
disimpan di local disk server (alasan: kuota disk shared hosting terbatas, dan
memudahkan migrasi ke cloud di masa depan).

Tolong:

1. Install provider upload yang kompatibel dengan Cloudflare R2.
   R2 mendukung S3-compatible API. Gunakan @strapi/provider-upload-aws-s3
   yang dikonfigurasi dengan endpoint R2. Install via npm.

2. Buatkan file konfigurasi config/plugins.js dengan environment variable
   berikut (akan diisi manual di cPanel, JANGAN hardcode nilai apapun di kode):
     R2_ACCESS_KEY_ID
     R2_SECRET_ACCESS_KEY
     R2_ENDPOINT          (format: https://<account_id>.r2.cloudflarestorage.com)
     R2_BUCKET_NAME
     R2_PUBLIC_URL        (URL publik untuk akses file, bisa custom domain R2)

3. Konfigurasi mendukung:
   - Upload gambar: jpg, jpeg, png, webp, gif (maks 10MB per file)
   - Upload video: mp4, mov (maks 100MB per file)
   - Tambahkan validasi tipe file dan ukuran — tolak file yang tidak sesuai
     dengan error message yang jelas

4. Pastikan URL file yang tersimpan di database menggunakan R2_PUBLIC_URL
   (bukan endpoint internal R2), agar file bisa diakses publik dari frontend.

5. Setelah dikonfigurasi, jelaskan langkah verifikasi:
   - Cara test upload dari admin panel Strapi
   - Cara konfirmasi file tersimpan di R2 (bukan local disk):
     cek via Cloudflare dashboard > R2 > nama bucket
   - Cara konfirmasi URL gambar yang tersimpan di database Article menggunakan
     R2_PUBLIC_URL (bukan path lokal)
```

---

## 10.3 Prompt — Frontend Next.js: Setup & Homepage (Fase 2)

```
Saya ingin membangun frontend portal berita menggunakan Next.js (App Router)
yang mengambil data dari Strapi v5 via REST API. Frontend ini akan di-deploy
di domain news.jobenapp.cloud, mengambil data dari Strapi di
cms.news.jobenapp.cloud.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SETUP DASAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Next.js versi terbaru dengan App Router
- Tailwind CSS untuk styling
- Environment variable:
    NEXT_PUBLIC_STRAPI_API_URL=https://cms.news.jobenapp.cloud
    STRAPI_API_TOKEN=<api_token_read_only>
    REVALIDATION_SECRET=<sama_dengan_di_strapi>
    NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
    NODE_ENV=production

- Buatkan lib/strapi.js berisi fungsi-fungsi fetch ke Strapi REST API:
    * getArticles(params)        — ambil daftar artikel published
    * getArticleBySlug(slug)     — ambil satu artikel berdasarkan slug
    * getBreakingNews()          — ambil artikel dengan is_breaking_news=true,
                                   ordered by breaking_news_priority DESC, limit 1
    * getArticlesByCategory(slug, page, pageSize)
    * getCategories()
    * searchArticles(keyword, page) — search pada field title dan excerpt saja
                                      (gunakan filter $containsi, bukan content body
                                      untuk menjaga performa)
    * getPage(slug)              — ambil halaman statis (About, Privacy Policy, dsb)
  Semua fungsi harus:
    - Include penanganan error yang eksplisit (throw error dengan pesan jelas,
      jangan return undefined atau null diam-diam)
    - Include header Authorization: Bearer ${STRAPI_API_TOKEN}
    - Gunakan revalidate dari parameter atau default 60 detik

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. HALAMAN HOMEPAGE (app/page.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Layout homepage:
  - Breaking news banner/ticker: HANYA tampil jika ada artikel dengan
    is_breaking_news=true. Jika tidak ada breaking news aktif, banner ini
    TIDAK ditampilkan (jangan tampilkan banner kosong atau placeholder).
  - Headline utama: jika ada breaking news aktif → tampilkan artikel tersebut
    sebagai hero section. Jika tidak ada → tampilkan artikel terbaru.
  - Grid artikel terbaru dikelompokkan per kategori (4 artikel per kategori)
  - Setiap article card menampilkan: gambar thumbnail (Next.js Image component),
    judul, badge kategori, tanggal publish, excerpt singkat

- Desain mobile-first, responsif penuh (breakpoint: mobile, tablet, desktop)
- Style: bersih, modern, mirip CNN Indonesia/detik.com
  Warna: breaking news = merah tegas, kategori = warna netral, typography jelas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ISR DUA LAPISAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LAPISAN 1 — Time-based ISR:
  export const revalidate = 60  // di setiap page component
  Semua halaman yang fetch data dari Strapi gunakan revalidate=60.

LAPISAN 2 — On-demand Revalidation via Webhook:
  Buatkan app/api/revalidate/route.js (Next.js API Route):
  - Method: POST
  - Validasi: cek request body memiliki field "secret" yang cocok dengan
    process.env.REVALIDATION_SECRET. Jika tidak cocok, return 401 Unauthorized.
  - Jika valid, jalankan:
      revalidatePath('/')                          // homepage
      revalidatePath(`/artikel/${body.slug}`)      // halaman artikel spesifik
      revalidatePath(`/kategori/${body.categorySlug}`) // halaman kategori
      revalidatePath('/sitemap.xml')               // sitemap
  - Return JSON: { revalidated: true, timestamp: new Date().toISOString() }
  - Jika revalidatePath gagal, return 500 dengan detail error (untuk debugging)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. KOMPONEN REUSABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buatkan komponen berikut di folder components/:
  - Header.js    : logo, navigasi kategori dinamis (fetch dari Strapi),
                   link ke halaman pencarian
  - Footer.js    : link ke About, Privacy Policy, Contact, Redaksi;
                   copyright year otomatis
  - ArticleCard.js: gambar thumbnail, judul, badge kategori, tanggal, excerpt;
                    responsive untuk card besar (hero) dan kecil (grid)
  - AdSlot.js    : komponen placeholder slot iklan AdSense.
                   Props: position (enum: 'header' | 'in-article' | 'sidebar')
                   Untuk sekarang render div kosong dengan komentar:
                   {/* AdSense slot: {position} — isi kode AdSense setelah approve */}
                   Gunakan komponen ini di Header (position=header) dan
                   siapkan di halaman artikel & sidebar kategori.
```

---

## 10.4 Prompt — Halaman Artikel, Kategori, Search, 404 & 500 (Fase 2)

```
Lanjutan dari project Next.js portal berita (production: news.jobenapp.cloud).
Buatkan halaman-halaman berikut:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. HALAMAN DETAIL ARTIKEL (app/artikel/[slug]/page.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fetch artikel dari Strapi berdasarkan slug. Tampilkan:
  - Judul artikel (H1)
  - Gambar cover (Next.js Image, lazy loading, alt = judul)
  - Nama penulis + foto kecil + tanggal publish
  - Badge kategori + daftar tag
  - Isi artikel (render dari Rich Text/Blocks Strapi dengan parser yang tepat)
  - Komponen AdSlot position="in-article" di tengah artikel (setelah paragraf ke-3
    atau 30% dari panjang konten, mana yang lebih dulu)
  - Tombol share ke: WhatsApp, Facebook, Twitter/X
    (gunakan link share standar masing-masing platform, bukan plugin berat)
  - Section "Artikel Terkait": ambil 4 artikel dari kategori yang sama,
    kecuali artikel yang sedang dibaca. Tampilkan dalam format ArticleCard kecil.

Metadata SEO (via generateMetadata()):
  - title: `${artikel.title} | JOBEN NEWS`
  - description: artikel.excerpt
  - openGraph:
      title, description, images: [cover_image URL], type: 'article',
      publishedTime: published_at, authors: [author.name],
      url: `https://news.jobenapp.cloud/artikel/${slug}`
  - twitter: card: 'summary_large_image', title, description, images

JSON-LD schema markup (tambahkan di <head> via script tag):
  Tipe: "NewsArticle"
  Field wajib:
    headline, image, datePublished, dateModified (= updatedAt dari Strapi),
    author: { @type: "Person", name: author.name },
    publisher: { @type: "Organization", name: "JOBEN NEWS",
                 logo: { @type: "ImageObject", url: "https://news.jobenapp.cloud/logo.png" } },
    url: `https://news.jobenapp.cloud/artikel/${slug}`,
    description: excerpt

ISR: export const revalidate = 60
generateStaticParams: ambil 50 artikel terbaru untuk pre-render saat build.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. HALAMAN KATEGORI (app/kategori/[slug]/page.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Tampilkan nama kategori sebagai judul halaman (H1)
- Daftar artikel dalam kategori tersebut, 10 artikel per halaman
- Pagination sederhana: tombol "Sebelumnya" / "Berikutnya" dengan query param ?page=N
- Layout dua kolom: daftar artikel (kiri, lebar), sidebar (kanan, sempit)
- Sidebar berisi: komponen AdSlot position="sidebar"
- generateMetadata(): title = `${kategori.name} — Berita Terkini | JOBEN NEWS`
- ISR: export const revalidate = 60

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. HALAMAN PENCARIAN (app/cari/page.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Search box di bagian atas halaman, query diambil dari URL search param (?q=keyword)
- Fetch hasil via searchArticles(keyword) dari lib/strapi.js
  (search pada title dan excerpt saja — bukan content body)
- Tampilkan: jumlah hasil ("Ditemukan X hasil untuk "keyword""),
  daftar ArticleCard, atau pesan eksplisit "Tidak ada hasil untuk "keyword""
  (JANGAN tampilkan halaman kosong tanpa keterangan)
- Pagination jika hasil > 20
- Halaman ini menggunakan client component untuk search box (agar URL berubah
  saat user submit tanpa page reload penuh), tapi daftar hasil bisa server component
- generateMetadata(): title = `Hasil pencarian: "${keyword}" | JOBEN NEWS`
- Halaman pencarian TIDAK menggunakan ISR (data harus selalu fresh)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. HALAMAN 404 (app/not-found.js) — WAJIB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Tampilkan pesan yang jelas: "Halaman Tidak Ditemukan (404)"
- Subjudul: "Artikel atau halaman yang Anda cari tidak tersedia atau sudah dihapus."
- Sediakan: tombol kembali ke homepage, link ke halaman pencarian
- Desain konsisten dengan tema situs (pakai Header dan Footer yang sama)
- Jangan tampilkan stack trace atau error detail ke publik

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. HALAMAN 500 (app/error.js) — WAJIB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Ini adalah Error Boundary Next.js ('use client' component)
- Tampilkan pesan: "Terjadi Kesalahan (500)"
- Subjudul: "Server sedang mengalami gangguan. Silakan coba lagi beberapa saat."
- Sediakan: tombol "Coba Lagi" (panggil reset() dari props) dan link ke homepage
- Jangan tampilkan error.message atau stack trace ke publik
  (di development mode boleh ditampilkan untuk debugging)
- Desain konsisten dengan tema situs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. CATATAN UMUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Semua halaman harus mobile-responsive
- Gunakan loading.js (Next.js Suspense) di setiap route untuk loading state
- Gunakan Next.js Image component untuk semua gambar dari Cloudflare R2
  (tambahkan domain R2 ke next.config.js > images.remotePatterns)
```

---

## 10.5 Prompt — SEO, Sitemap, GA4, dan Halaman Legal (Fase 3)

```
Lanjutan project Next.js portal berita (production: news.jobenapp.cloud).
Sekarang saya butuh kelengkapan SEO, analitik, dan halaman legal untuk
keperluan pendaftaran Google AdSense.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SITEMAP DINAMIS (app/sitemap.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate sitemap.xml secara dinamis:
  - Base URL: https://news.jobenapp.cloud
  - Ambil SEMUA artikel published dari Strapi (pagination jika perlu,
    sampai semua artikel ter-cover)
  - Setiap artikel: URL /artikel/{slug}, lastModified = updatedAt dari Strapi,
    changeFrequency = 'daily', priority = 0.8
  - Tambahkan halaman statis: /, /about, /privacy-policy, /contact, /redaksi
    dengan priority = 0.5 dan changeFrequency = 'monthly'
  - Tambahkan halaman kategori: /kategori/{slug} untuk semua kategori
    dengan priority = 0.6 dan changeFrequency = 'daily'
  - Gunakan revalidate = 3600 (update sitemap setiap 1 jam)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ROBOTS.TXT (app/robots.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  - Allow: / (semua halaman publik)
  - Disallow: /api/ (jangan crawl API routes)
  - Disallow: /admin (jika ada — tapi admin Strapi di subdomain berbeda,
    ini hanya pencegahan)
  - Sitemap: https://news.jobenapp.cloud/sitemap.xml
  - Host: https://news.jobenapp.cloud

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. HALAMAN STATIS (app/[slug]/page.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buatkan komponen generic yang fetch konten dari content-type "Page" di Strapi
berdasarkan slug. Halaman yang harus tersedia:
  - /about           → Tentang Kami
  - /privacy-policy  → Kebijakan Privasi
                       WAJIB menyebut penggunaan Google Analytics 4 (GA4)
                       dan cookie analytics di bagian Data yang Dikumpulkan.
                       Sertakan teks standar: "Kami menggunakan Google Analytics
                       untuk memahami bagaimana pengunjung menggunakan situs ini.
                       GA4 menggunakan cookie untuk mengumpulkan data anonim
                       tentang interaksi pengguna."
  - /contact         → Kontak (form atau informasi kontak)
  - /redaksi         → Susunan Redaksi: tampilkan daftar Author dengan
                       role_label = editor atau admin dari Strapi,
                       bukan dari content-type Page (fetch dari Author API)

generateStaticParams: buat untuk slug: about, privacy-policy, contact
generateMetadata(): title = `${page.title} | JOBEN NEWS`
ISR: revalidate = 3600 (halaman legal jarang berubah)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. METADATA DEFAULT (app/layout.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tambahkan metadata default:
  - title: { default: 'JOBEN NEWS', template: '%s | JOBEN NEWS' }
  - description: 'Portal berita terkini Indonesia'
  - metadataBase: new URL('https://news.jobenapp.cloud')
  - openGraph default: type 'website', site_name 'JOBEN NEWS',
    image default (logo situs)
  - favicon: /favicon.ico
  - Canonical URL otomatis per halaman

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. GOOGLE ANALYTICS 4 (GA4) — WAJIB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Install @next/third-parties. Pasang di app/layout.js:

  import { GoogleAnalytics } from '@next/third-parties/google';

  // Di dalam <body>, setelah konten utama:
  {process.env.NODE_ENV === 'production' && (
    <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
  )}

Buatkan komponen lib/analytics.js dengan fungsi helper untuk custom events:
  export function trackArticleView(slug, category, author) {
    if (typeof window === 'undefined') return;
    window.gtag?.('event', 'article_view', {
      article_slug: slug,
      article_category: category,
      article_author: author,
    });
  }

  export function trackShareClick(platform, slug) {
    if (typeof window === 'undefined') return;
    window.gtag?.('event', 'share_click', { platform, article_slug: slug });
  }

  export function trackSearchSubmit(searchTerm) {
    if (typeof window === 'undefined') return;
    window.gtag?.('event', 'search_submit', { search_term: searchTerm });
  }

  export function trackBreakingNewsClick(slug) {
    if (typeof window === 'undefined') return;
    window.gtag?.('event', 'breaking_news_click', { article_slug: slug });
  }

Panggil fungsi-fungsi ini di:
  - Halaman artikel (trackArticleView) — via useEffect di client component
  - Tombol share (trackShareClick) — onClick handler
  - Search submit (trackSearchSubmit) — onSubmit handler
  - Breaking news banner (trackBreakingNewsClick) — onClick handler

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. SLOT PLACEHOLDER ADSENSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pastikan komponen AdSlot.js dari prompt 10.3 sudah terpasang di:
  - app/layout.js atau Header.js untuk position="header" (leaderboard 728x90)
  - app/artikel/[slug]/page.js untuk position="in-article" (setelah paragraf ke-3)
  - app/kategori/[slug]/page.js untuk position="sidebar" di sidebar kanan

Komponen AdSlot harus:
  - Render div dengan className yang mudah diidentifikasi (mis. "ad-slot-header")
  - Tampilkan placeholder visual kecil (abu-abu, border dashed) selama development
    agar posisi iklan terlihat
  - Ada prop 'isProduction' — saat false, tampilkan placeholder; saat true (NEXT_PUBLIC
    env var), tampilkan slot AdSense yang sesungguhnya
```

---

## 10.6 Prompt — Deployment ke cPanel/Shared Hosting (Fase 4)

```
Saya akan deploy project Strapi v5 dan Next.js ini ke shared hosting cPanel
menggunakan fitur "Setup Node.js App" (Passenger). Saya TIDAK punya akses
root. Domain: news.jobenapp.cloud (Next.js) dan cms.news.jobenapp.cloud (Strapi).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. STRAPI — PERSIAPAN DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

a) Konfirmasi file server.js di root sudah ada (dari prompt 10.1) dengan:
   process.env.PORT = process.env.PORT || 1337;
   const strapi = require('@strapi/strapi');
   strapi().start();
   File ini adalah "Application startup file" di cPanel.

b) Checklist environment variable yang harus diisi di cPanel
   (Setup Node.js App > Environment Variables):
   DATABASE_CLIENT, DATABASE_HOST=localhost, DATABASE_PORT=5432,
   DATABASE_NAME, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_SSL=false,
   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME,
   R2_PUBLIC_URL, APP_KEYS, API_TOKEN_SALT, ADMIN_JWT_SECRET, JWT_SECRET,
   TRANSFER_TOKEN_SALT, NEXTJS_REVALIDATION_URL, REVALIDATION_SECRET,
   NODE_ENV=production

c) Urutan perintah di Terminal cPanel/SSH setelah upload file:
   npm install --production
   NODE_ENV=production npm run build   (build Strapi admin panel)
   → Kemudian restart app via cPanel panel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. NEXT.JS — PERSIAPAN DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

a) Buatkan file server.js kustom di root Next.js project yang menjalankan
   Next.js secara programmatic agar kompatibel dengan Passenger:
   const { createServer } = require('http');
   const { parse } = require('url');
   const next = require('next');
   const port = parseInt(process.env.PORT, 10) || 3000;
   const dev = process.env.NODE_ENV !== 'production';
   const app = next({ dev });
   const handle = app.getRequestHandler();
   app.prepare().then(() => {
     createServer((req, res) => {
       const parsedUrl = parse(req.url, true);
       handle(req, res, parsedUrl);
     }).listen(port, () => {
       console.log(`Next.js ready on port ${port}`);
     });
   });
   File ini adalah "Application startup file" Next.js di cPanel.

b) Checklist environment variable Next.js di cPanel:
   NEXT_PUBLIC_STRAPI_API_URL=https://cms.news.jobenapp.cloud
   STRAPI_API_TOKEN, REVALIDATION_SECRET,
   NEXT_PUBLIC_GA_MEASUREMENT_ID, NODE_ENV=production

c) Urutan perintah build Next.js di Terminal cPanel/SSH:
   npm install
   npm run build   (next build)
   → Restart app via cPanel panel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PANDUAN LANGKAH DI CPANEL (tanpa SSH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buatkan dokumentasi langkah-langkah cPanel (tanpa SSH murni):
  a. Cara membuat subdomain cms.news.jobenapp.cloud di cPanel > Domains/Subdomains
  b. Cara membuat PostgreSQL Database + User di cPanel > PostgreSQL Databases,
     lalu assign user ke database dengan privilege ALL
  c. Cara membuat 2 Node.js App terpisah di cPanel > Setup Node.js App:
       App 1: Strapi → application root = folder backend, URL = cms.news.jobenapp.cloud,
               startup file = server.js
       App 2: Next.js → application root = folder frontend, URL = news.jobenapp.cloud,
               startup file = server.js
  d. Cara mengisi environment variable di masing-masing app
  e. Cara mengaktifkan SSL AutoSSL untuk kedua domain/subdomain
  f. Cara membuat Cron Job anti-idle (cPanel > Cron Jobs):
       Interval: setiap 10 menit
       Command 1: curl -s https://cms.news.jobenapp.cloud/api > /dev/null
       Command 2: curl -s https://news.jobenapp.cloud > /dev/null

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. KETERBATASAN SHARED HOSTING — KAPAN MIGRASI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Jelaskan:
  - Batas resource yang umum di shared hosting (CPU quota, RAM per proses,
    jumlah concurrent proses)
  - Indikator yang menunjukkan sudah saatnya migrasi ke VPS/cloud:
    * CPU usage konsisten > 80% di dashboard cPanel
    * App sering di-suspend oleh hosting provider
    * Response time > 3 detik walau Cloudflare cache sudah aktif
    * Error "Resource limit exceeded" muncul di log
  - Langkah selanjutnya: eksekusi jalur migrasi di prompt 10.7
```

---

## 10.7 Prompt — Fondasi Migrasi ke Google Cloud (Opsional, disiapkan sejak awal)

```
Saya ingin menyiapkan pondasi agar project Strapi v5 dan Next.js ini suatu saat
bisa dipindahkan dari cPanel shared hosting ke Google Cloud, tanpa merombak
arsitektur. File-file berikut TIDAK akan dijalankan di cPanel sekarang —
cPanel tetap memakai Node.js Selector seperti prompt 10.6. Ini hanya pondasi
migrasi untuk masa depan.

Tolong buatkan:

1. Dockerfile untuk Strapi (multi-stage build, production-ready):
   - Stage 1 (builder): install semua dependencies, jalankan npm run build
   - Stage 2 (runner): hanya copy hasil build + production dependencies
   - EXPOSE port dari environment variable PORT (jangan hardcode 1337)
   - Jalankan dengan user non-root untuk keamanan
   - Include .dockerignore yang exclude: node_modules, .env, .cache, build logs

2. Dockerfile untuk Next.js (multi-stage build):
   - Gunakan output: 'standalone' di next.config.js (harus sudah diset)
   - Stage 1 (builder): install dependencies, jalankan npm run build
   - Stage 2 (runner): copy .next/standalone + .next/static + public
   - EXPOSE port dari environment variable PORT
   - Jalankan dengan user non-root

3. File .env.example untuk masing-masing project yang mendaftar SEMUA
   environment variable dengan komentar penjelasan per baris.
   File ini di-commit ke GitHub (aman karena tanpa nilai asli).
   Strapi: DATABASE_*, R2_*, APP_KEYS, *_SALT, *_SECRET, NEXTJS_REVALIDATION_URL,
           REVALIDATION_SECRET, NODE_ENV
   Next.js: NEXT_PUBLIC_STRAPI_API_URL, STRAPI_API_TOKEN, REVALIDATION_SECRET,
            NEXT_PUBLIC_GA_MEASUREMENT_ID, NODE_ENV

4. Dokumen MIGRATION.md (simpan di root repo) berisi:
   a. Export database dari PostgreSQL cPanel:
        pg_dump -h localhost -U cpaneluser_newsuser -d cpaneluser_newsdb \
          -Fc -f backup_$(date +%Y%m%d).dump
   b. Restore ke Cloud SQL for PostgreSQL di Google Cloud:
        pg_restore -h <cloud_sql_host> -U <user> -d <dbname> backup_$(tanggal).dump
   c. Deploy Dockerfile ke Cloud Run:
        gcloud builds submit --tag gcr.io/<project>/strapi .
        gcloud run deploy strapi --image gcr.io/<project>/strapi \
          --platform managed --region asia-southeast2 \
          --set-env-vars DATABASE_HOST=<cloud_sql_ip>,...
   d. Konfirmasi Cloudflare R2 tidak perlu dimigrasi (S3-compatible,
      independen dari lokasi hosting)
   e. Update DNS di Cloudflare: ubah A/CNAME record dari IP shared hosting
      ke endpoint Cloud Run (gunakan TTL 60 detik minimal 30 menit sebelum
      migrasi untuk meminimalkan downtime DNS propagation)

Pastikan kode aplikasi tetap 100% berjalan normal di cPanel Node.js Selector.
Dockerfile dan MIGRATION.md hanya pondasi tambahan.
```

---

## 11. Alur Kerja Git: Replit → GitHub → cPanel

Ini adalah alur standar pengembangan untuk semua fase. Semua development dan
build dilakukan di Replit, hasil di-push ke GitHub, lalu di-pull ke cPanel.

### Setup Awal (lakukan sekali)

**Di Replit — inisialisasi repo:**
```bash
git init
git remote add origin https://github.com/<username>/joben-news-backend.git
git remote add origin https://github.com/<username>/joben-news-frontend.git
# (dua repo terpisah untuk Strapi dan Next.js, atau satu monorepo)
```

**Di cPanel — clone dari GitHub:**
```bash
# Masuk via Terminal cPanel atau SSH
cd ~/  # atau ke folder yang ditunjuk cPanel sebagai app root
git clone https://github.com/<username>/joben-news-backend.git backend
git clone https://github.com/<username>/joben-news-frontend.git frontend
```

### Alur Update Rutin

```
┌─────────────────┐     git push      ┌──────────────┐     git pull     ┌─────────────┐
│   Replit        │ ─────────────────► │   GitHub     │ ───────────────► │   cPanel    │
│  (develop)      │                   │   (repo)     │                  │ (production)│
│                 │                   │              │                  │             │
│ 1. Edit kode    │                   │              │                  │             │
│ 2. Test di      │                   │              │                  │             │
│    Replit       │                   │              │                  │             │
│ 3. npm run build│                   │              │                  │             │
│ 4. git add .    │                   │              │                  │             │
│ 5. git commit   │                   │              │                  │             │
│ 6. git push     │ ──────────────►   │              │                  │             │
└─────────────────┘                   └──────────────┘                  └─────────────┘
                                                                               │
                                                          7. git pull origin main
                                                          8. npm install (jika ada package baru)
                                                          9. npm run build (Strapi/Next.js)
                                                         10. Restart app di cPanel panel
```

### Perintah di cPanel Setiap Update

```bash
# Masuk ke folder app via Terminal cPanel
cd ~/backend   # atau path app root Strapi di cPanel

git pull origin main
npm install    # hanya jika package.json berubah
NODE_ENV=production npm run build   # hanya untuk Strapi jika ada perubahan schema/admin

# Kemudian: cPanel > Setup Node.js App > Restart app (klik tombol Restart)
# atau via terminal:
# touch tmp/restart.txt   (jika Passenger menggunakan mekanisme ini)
```

```bash
cd ~/frontend   # atau path app root Next.js di cPanel

git pull origin main
npm install     # hanya jika package.json berubah
npm run build   # selalu jalankan next build setelah perubahan kode

# Restart app via cPanel panel
```

### Branching Strategy (Sederhana)

```
main        → kode production (yang di-deploy ke cPanel)
development → kode yang sedang dikerjakan di Replit
feature/*   → fitur baru (merge ke development dulu, baru ke main)
```

**Rules:**
- Jangan push langsung ke `main` saat kode belum ditest di Replit
- Setiap perubahan ke `main` harus segera di-pull ke cPanel

### File yang TIDAK boleh di-push ke GitHub

Pastikan `.gitignore` mencakup:
```
# Environment variables (sensitif)
.env
.env.local
.env.production

# Build outputs (di-generate ulang di cPanel)
.next/
build/
dist/
.strapi/

# Dependencies (di-install ulang via npm install)
node_modules/

# Upload lokal (media di R2, bukan di repo)
public/uploads/
```

### .env.example — Wajib ada di repo

File `.env.example` (tanpa nilai sensitif) harus di-commit ke GitHub sebagai
dokumentasi. Setiap kali ada environment variable baru, update `.env.example`.
Ini juga panduan untuk mengisi env var di cPanel.

---

## 12. Checklist QA Sebelum Daftar AdSense

Lakukan checklist ini sebelum mengajukan pendaftaran Google AdSense:

### Konten & Legal
- [ ] Minimal 20-30 artikel orisinal sudah published
- [ ] Halaman /about sudah live dan informatif
- [ ] Halaman /privacy-policy sudah live dan menyebut penggunaan GA4/cookie
- [ ] Halaman /contact sudah live
- [ ] Halaman /redaksi sudah live (menampilkan tim editor)
- [ ] Tidak ada artikel yang merupakan copy-paste dari media lain

### Teknis
- [ ] Homepage load < 3 detik di Google PageSpeed Insights (mobile)
- [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1
- [ ] Semua gambar artikel menggunakan URL Cloudflare R2 (bukan lokal)
- [ ] Sitemap.xml bisa diakses di https://news.jobenapp.cloud/sitemap.xml
- [ ] Sitemap sudah di-submit ke Google Search Console
- [ ] Schema markup NewsArticle ter-validasi di Google Rich Results Test
- [ ] Open Graph tag muncul saat URL dibagikan ke WhatsApp (test via debugger FB)
- [ ] Halaman 404 muncul saat akses URL tidak valid (misal /artikel/tidak-ada)
- [ ] Halaman 404 dan 500 tidak menampilkan stack trace
- [ ] HTTPS aktif di kedua domain
- [ ] Tombol share WhatsApp, Facebook, Twitter/X berfungsi di mobile

### Monitoring & Analitik
- [ ] GA4 tracking aktif: buka GA4 Realtime report saat buka situs — harus muncul
- [ ] Tidak ada JS error di browser console (production)
- [ ] UptimeRobot atau monitoring uptime sudah setup
- [ ] Cron job anti-idle sudah aktif di cPanel

### AdSense Compliance
- [ ] Komponen AdSlot terpasang di posisi yang tepat (header, in-article, sidebar)
- [ ] Tidak ada iklan di halaman 404/500
- [ ] Konten tidak mengandung materi terlarang AdSense
