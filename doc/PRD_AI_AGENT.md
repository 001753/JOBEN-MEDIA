# PRD — JOBEN NEWS AI AGENT SYSTEM
## Kantor Berita Otonom Berbasis Kecerdasan Buatan

**Versi:** 1.0  
**Tanggal:** Juli 2026  
**Status:** Draft Final — Siap Build  
**Penulis:** Tim Arsitektur Joben News  

---

## DAFTAR ISI

1. [Executive Summary](#1-executive-summary)
2. [Latar Belakang & Tujuan](#2-latar-belakang--tujuan)
3. [Gambaran Sistem Keseluruhan](#3-gambaran-sistem-keseluruhan)
4. [Arsitektur Teknis](#4-arsitektur-teknis)
5. [FASE 1 — MVP: Mesin Produksi Artikel](#5-fase-1--mvp-mesin-produksi-artikel)
6. [FASE 2 — Intelligent: Agent yang Belajar](#6-fase-2--intelligent-agent-yang-belajar)
7. [FASE 3 — Autonomous: Redaksi Penuh](#7-fase-3--autonomous-redaksi-penuh)
8. [FASE 4 — Expanding: Multi-Output](#8-fase-4--expanding-multi-output)
9. [FASE 5 — Full Newsroom: Ekosistem Lengkap](#9-fase-5--full-newsroom-ekosistem-lengkap)
10. [Dashboard Control Center](#10-dashboard-control-center)
11. [Sistem Author & Persona](#11-sistem-author--persona)
12. [Manajemen API Key Gemini](#12-manajemen-api-key-gemini)
13. [Standar Konten & AdSense Compliance](#13-standar-konten--adsense-compliance)
14. [Keamanan & Reliabilitas](#14-keamanan--reliabilitas)
15. [Deployment & Infrastruktur cPanel](#15-deployment--infrastruktur-cpanel)
16. [Metrik Keberhasilan](#16-metrik-keberhasilan)
17. [Roadmap & Timeline](#17-roadmap--timeline)
18. [Risiko & Mitigasi](#18-risiko--mitigasi)
19. [Glosarium](#19-glosarium)

---

## 1. EXECUTIVE SUMMARY

JOBEN NEWS AI Agent System adalah platform produksi konten berita berbasis kecerdasan buatan yang dirancang untuk mengoperasikan **kantor berita otonom** pada domain `news.jobenapp.cloud`. Sistem ini mampu memproduksi, mengedit, mereview, dan mempublikasikan artikel berita teknologi secara otomatis 24 jam sehari, 7 hari seminggu — tanpa intervensi manusia untuk operasional harian.

### Target Operasional Utama
- **30 artikel/hari** untuk subkategori berdasarkan tren terkini
- **Minimal 2 breaking news/hari** untuk berita panas real-time
- **Kualitas jurnalistik** setara media teknologi Indonesia profesional
- **Lolos standar Google AdSense** untuk monetisasi
- **Dashboard kontrol** di `ai.jobenapp.cloud` untuk monitoring dan konfigurasi

### Filosofi Sistem
> *"Kecepatan mesin, kualitas manusia."* — Sistem ini tidak menggantikan jurnalis, tapi mensimulasikan redaksi berita yang bekerja tanpa henti, dengan standar editorial yang ketat, gaya bahasa yang natural, dan konten yang selalu relevan dengan kebutuhan pembaca Indonesia.

---

## 2. LATAR BELAKANG & TUJUAN

### 2.1 Konteks

JOBEN NEWS adalah portal berita teknologi berbahasa Indonesia yang dibangun di atas:
- **Strapi v5** sebagai CMS backend (`cms.news.jobenapp.cloud`)
- **Next.js 14** sebagai frontend (`news.jobenapp.cloud`)
- **Cloudflare R2** sebagai media storage
- **cPanel hosting** sebagai infrastruktur server

Produksi konten manual membutuhkan tim editorial besar dan biaya operasional tinggi. AI Agent System memungkinkan operasional redaksi berjalan dengan tim minimal sambil menghasilkan volume konten yang kompetitif.

### 2.2 Tujuan Bisnis

| Tujuan | Indikator Keberhasilan | Timeline |
|--------|------------------------|----------|
| Volume konten kompetitif | 30 artikel/hari konsisten | Fase 1 |
| Monetisasi AdSense | Approval Google AdSense | Fase 1-2 |
| Traffic organik SEO | 10.000 pageview/bulan | Fase 2 |
| Brand authority | Backlink dari media lain | Fase 3 |
| Revenue advertising | Rp 5 juta+/bulan dari AdSense | Fase 3-4 |
| Ekspansi konten | Podcast, newsletter, video | Fase 4-5 |

### 2.3 Tujuan Teknis

- Sistem berjalan **fully autonomous** dengan uptime 99%+
- **Self-healing** — restart otomatis jika ada kegagalan
- **Modular & extensible** — fitur baru bisa ditambah tanpa merombak sistem
- **Observable** — setiap aktivitas tercatat dan bisa dimonitor
- **Secure** — akses terbatas, tidak ada credential hardcode

---

## 3. GAMBARAN SISTEM KESELURUHAN

### 3.1 Topologi Domain

```
┌─────────────────────────────────────────────────────────┐
│                    JOBEN NEWS ECOSYSTEM                  │
├─────────────────┬───────────────┬───────────────────────┤
│ news.jobenapp   │ cms.news.     │ ai.jobenapp.cloud      │
│ .cloud          │ jobenapp.cloud│                        │
│ (Next.js)       │ (Strapi v5)   │ (Dashboard Agent)      │
│ Port: 5000      │ Port: 3001    │ Port: 4000             │
│ Pembaca         │ Admin CMS     │ Operator/Admin         │
└────────┬────────┴───────┬───────┴──────────┬────────────┘
         │                │                  │
         │         ┌──────▼──────┐           │
         └─────────│  AI AGENT   │───────────┘
                   │  CORE       │
                   │  (PM2)      │
                   └──────┬──────┘
                          │
         ┌────────────────┼─────────────────┐
         ▼                ▼                 ▼
   Gemini API      Cloudflare R2      External RSS
   (15+ keys)      (Media Store)      (News Sources)
```

### 3.2 Alur Data Utama

```
INTERNET (Sumber Berita)
    │
    ▼
[RSS Fetcher] ──────────────────────────────┐
    │                                        │
    ▼                                        ▼
[Trend Analyzer]                    [Breaking News Watcher]
    │                                        │
    ▼                                        ▼
[Quality Pre-check]              [Priority Queue Inject]
    │
    ▼
[Writer Agent] ← prompt templates ← [Config]
    │
    ├──────────────────┐
    ▼                  ▼
[Quality Gate]    [Image Generator]
    │                  │
    ▼                  ▼
[Publisher] ←── [R2 Uploader]
    │
    ├─► Strapi REST API
    ├─► ISR Revalidation (Next.js)
    ├─► Telegram Notification
    └─► Dashboard State Update
```

### 3.3 Stack Teknologi

| Komponen | Teknologi | Versi | Alasan Pilihan |
|----------|-----------|-------|----------------|
| Runtime | Node.js | 24.x | cPanel native support, async excellent |
| Process Manager | PM2 | Latest | Monitoring, auto-restart, log management |
| AI Model (Text) | Gemini 2.5 Flash | Latest | Cepat, murah, bahasa Indonesia bagus |
| AI Model (Image) | Imagen 3 via Gemini | Latest | Hyperrealistic, terintegrasi API |
| Web Search | Gemini Search Grounding | Built-in | Real-time data tanpa API tambahan |
| Dashboard Server | Express.js | 4.x | Lightweight, proven, mudah di-maintain |
| Dashboard UI | Vanilla HTML/CSS/JS | — | Tidak perlu build step, loading cepat |
| Auth Dashboard | JWT + bcrypt | — | Secure, stateless, jangka panjang |
| State Store | JSON file + SQLite | — | Tidak perlu DB baru, simple |
| Notifikasi | Telegram Bot API | — | Real-time, gratis, mudah setup |
| HTTP Client | node-fetch / axios | — | RSS fetching, API calls |
| RSS Parser | rss-parser | Latest | Multi-format RSS/Atom support |
| Scheduler | node-cron | Latest | Cron expression, ringan |
| Media Upload | AWS SDK v3 (R2 compat) | Latest | Sudah ada di project |
| Logging | Winston | Latest | Structured logs, file rotation |
| Validation | Zod | Latest | Schema validation artikel |

---

## 4. ARSITEKTUR TEKNIS

### 4.1 Struktur Folder Lengkap

```
/home/user/joben-agent/
│
├── src/
│   ├── agents/
│   │   ├── trendScout.js          # Analisis tren + pilih topik
│   │   ├── writer.js              # Generate artikel (Gemini)
│   │   ├── imageGen.js            # Generate gambar (Imagen 3)
│   │   ├── publisher.js           # Post ke Strapi
│   │   ├── breakingWatcher.js     # Monitor breaking news real-time
│   │   ├── qualityGate.js         # Validasi kualitas artikel
│   │   ├── internalLinker.js      # Sisipkan internal links
│   │   └── articleUpdater.js      # Update artikel lama (Fase 2)
│   │
│   ├── services/
│   │   ├── geminiPool.js          # Rotasi 15+ API key Gemini
│   │   ├── strapiClient.js        # Wrapper Strapi REST API
│   │   ├── r2Client.js            # Cloudflare R2 upload
│   │   ├── rssReader.js           # Multi-source RSS parser
│   │   ├── telegramNotifier.js    # Telegram Bot notifikasi
│   │   ├── ga4Client.js           # GA4 Data API (Fase 2)
│   │   └── searchConsoleClient.js # Search Console API (Fase 2)
│   │
│   ├── scheduler/
│   │   ├── index.js               # Main scheduler loop (node-cron)
│   │   ├── queue.js               # Article queue (FIFO, priority)
│   │   ├── timeManager.js         # Jam aktif, interval dinamis
│   │   └── breakingDaemon.js      # Daemon khusus breaking news
│   │
│   ├── dashboard/
│   │   ├── server.js              # Express app entry point
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT authentication
│   │   │   └── rateLimit.js       # Rate limiting dashboard
│   │   ├── routes/
│   │   │   ├── auth.js            # Login, logout, refresh token
│   │   │   ├── overview.js        # Stats & status API
│   │   │   ├── articles.js        # Log artikel API
│   │   │   ├── queue.js           # Queue management API
│   │   │   ├── schedule.js        # Jadwal konfigurasi API
│   │   │   ├── authors.js         # Author management API
│   │   │   ├── keys.js            # API key status API
│   │   │   ├── prompts.js         # Prompt template editor API
│   │   │   ├── logs.js            # Real-time log stream (SSE)
│   │   │   ├── manual.js          # Manual trigger API
│   │   │   └── settings.js        # Global settings API
│   │   └── public/
│   │       ├── index.html         # Login page
│   │       ├── dashboard.html     # Main dashboard
│   │       ├── articles.html      # Article log viewer
│   │       ├── queue.html         # Queue manager
│   │       ├── schedule.html      # Schedule config
│   │       ├── keys.html          # API key health monitor
│   │       ├── prompts.html       # Prompt editor
│   │       ├── logs.html          # Live log viewer
│   │       ├── settings.html      # System settings
│   │       ├── css/
│   │       │   └── dashboard.css  # Dashboard styling
│   │       └── js/
│   │           ├── api.js         # API client (fetch wrapper)
│   │           ├── auth.js        # Auth & token management
│   │           └── components.js  # Reusable UI components
│   │
│   ├── config/
│   │   ├── authors.json           # 10 author persona + Strapi ID
│   │   ├── categories.json        # Semua kategori + subkategori
│   │   ├── sources.json           # Daftar RSS feed sumber
│   │   ├── prompts.js             # Semua prompt template
│   │   ├── blacklist.json         # Kata/topik yang diblacklist
│   │   └── settings.json          # Runtime config (editable)
│   │
│   └── utils/
│       ├── logger.js              # Winston logger setup
│       ├── slugify.js             # Slug generator (Indonesia-safe)
│       ├── wordCount.js           # Hitung kata artikel
│       ├── dateHelper.js          # Timezone WIB helper
│       ├── retryHelper.js         # Exponential backoff retry
│       └── sanitizer.js          # HTML/content sanitizer
│
├── data/
│   ├── state.json                 # Status hari ini (counter, dll)
│   ├── queue.json                 # Artikel dalam antrian
│   ├── published.db               # SQLite: riwayat artikel published
│   ├── keys.json                  # Status health per API key
│   └── editorial-calendar.json    # Rencana editorial mingguan
│
├── logs/
│   ├── agent-YYYY-MM-DD.log       # Log harian (Winston rotation)
│   ├── error-YYYY-MM-DD.log       # Error log terpisah
│   └── dashboard-access.log       # Access log dashboard
│
├── scripts/
│   ├── setup.js                   # Inisialisasi pertama kali
│   ├── seedAuthors.js             # Seed author ke Strapi
│   ├── testWriter.js              # Test generate 1 artikel (CLI)
│   ├── testPublish.js             # Test publish ke Strapi (CLI)
│   ├── exportState.js             # Export state untuk backup
│   └── resetDaily.js              # Reset counter harian (jam 00.00)
│
├── .env                           # Environment variables (TIDAK di-commit)
├── .env.example                   # Template env vars
├── ecosystem.config.js            # PM2 konfigurasi
├── package.json
└── README.md                      # Panduan setup & operasional
```

### 4.2 Schema State & Database

#### `data/state.json` — Status Harian
```json
{
  "date": "2026-07-22",
  "articlesPublished": 18,
  "articlesTarget": 30,
  "breakingPublished": 2,
  "lastPublishedAt": "2026-07-22T14:30:00+07:00",
  "nextScheduledAt": "2026-07-22T15:18:00+07:00",
  "agentStatus": "running",
  "queueLength": 3,
  "errors24h": 1,
  "apiKeyActive": 14,
  "apiKeyTotal": 15
}
```

#### `data/published.db` — SQLite Schema
```sql
CREATE TABLE articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  strapi_id     TEXT UNIQUE,
  strapi_doc_id TEXT,
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  category      TEXT NOT NULL,
  subcategory   TEXT,
  author_name   TEXT,
  source_url    TEXT,
  source_name   TEXT,
  word_count    INTEGER,
  quality_score REAL,
  published_at  DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  status        TEXT DEFAULT 'published', -- published|failed|rejected
  error_msg     TEXT,
  gemini_key_used TEXT,
  generation_ms INTEGER
);

CREATE TABLE topics_used (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_hash  TEXT UNIQUE,
  topic_title TEXT,
  used_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_key_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id      TEXT,
  used_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  success     BOOLEAN,
  error_code  TEXT,
  latency_ms  INTEGER
);
```

#### `data/keys.json` — Status API Key
```json
{
  "keys": [
    {
      "id": "key_01",
      "key": "AIza...",
      "status": "active",
      "dailyUsed": 45,
      "dailyLimit": 1500,
      "errorStreak": 0,
      "lastUsed": "2026-07-22T14:28:00Z",
      "lastError": null,
      "disabledUntil": null
    }
  ],
  "lastRotationIndex": 3
}
```

### 4.3 PM2 Ecosystem Config

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "joben-agent-scheduler",
      script: "src/scheduler/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      cron_restart: "0 4 * * *",  // Restart bersih jam 04.00 WIB
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Jakarta"
      },
      error_file: "logs/agent-error.log",
      out_file: "logs/agent-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "joben-breaking-daemon",
      script: "src/scheduler/breakingDaemon.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "128M",
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Jakarta"
      }
    },
    {
      name: "joben-dashboard",
      script: "src/dashboard/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "128M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        TZ: "Asia/Jakarta"
      },
      error_file: "logs/dashboard-error.log",
      out_file: "logs/dashboard-out.log"
    }
  ]
};
```

---

## 5. FASE 1 — MVP: MESIN PRODUKSI ARTIKEL

**Durasi Target:** 1-2 minggu build  
**Tujuan:** Sistem berjalan menghasilkan 30 artikel/hari + 2 breaking news secara konsisten

### 5.1 Komponen yang Dibangun

#### A. Gemini Key Pool (`src/services/geminiPool.js`)

**Fungsi:** Mengelola 15+ API key Gemini dengan rotasi cerdas, health monitoring, dan fallback otomatis.

**Algoritma Rotasi:**
```
Round-Robin dengan Skip Logic:
1. Pilih key berikutnya dari pool (index++)
2. Cek: apakah key ini sedang di-cooldown? → skip
3. Cek: apakah dailyUsed >= dailyLimit? → skip, tandai exhausted
4. Cek: errorStreak >= 3? → disable 30 menit, skip
5. Gunakan key ini → catat penggunaan
6. Jika response 429 (rate limit): 
   - Cooldown key ini 60 detik
   - Langsung coba key berikutnya
7. Jika semua key exhausted → alert Telegram + pause agent
```

**Interface:**
```javascript
const pool = new GeminiPool(keys);
const response = await pool.generateContent({
  model: "gemini-2.5-flash",
  contents: [...],
  tools: [{ googleSearch: {} }]  // Search grounding
});
```

**Health Check:** Setiap 1 jam, kirim ping ke semua key untuk update status.

---

#### B. RSS Reader (`src/services/rssReader.js`)

**Sumber RSS yang Dipantau:**

| Kategori Coverage | Sumber | URL RSS |
|-------------------|--------|---------|
| Tech General | TechCrunch | https://techcrunch.com/feed/ |
| Tech General | The Verge | https://www.theverge.com/rss/index.xml |
| Tech General | Wired | https://www.wired.com/feed/rss |
| Tech General | Ars Technica | https://feeds.arstechnica.com/arstechnica/technology-lab |
| Business Tech | Reuters Tech | https://feeds.reuters.com/reuters/technologyNews |
| AI Spesifik | MIT Tech Review | https://www.technologyreview.com/feed/ |
| Startup | TechCrunch Startups | https://techcrunch.com/category/startups/feed/ |
| Security | Krebs on Security | https://krebsonsecurity.com/feed/ |
| Security | The Hacker News | https://feeds.feedburner.com/TheHackersNews |
| Crypto | CoinDesk | https://www.coindesk.com/arc/outboundfeeds/rss/ |
| Gadget | GSMArena | https://www.gsmarena.com/rss-news-reviews.php3 |
| Dev | Hacker News Top | https://hnrss.org/frontpage |
| Breaking | AP Tech | https://rsshub.app/apnews/topics/technology |
| Breaking | BBC Tech | http://feeds.bbci.co.uk/news/technology/rss.xml |
| Indonesia | Kompas Tekno | https://tekno.kompas.com/rss/tag/all.xml |
| Indonesia | DetikInet | https://rss.detik.com/index.php/detikinet |

**Filter Artikel:**
- Maksimum umur artikel: 48 jam (untuk reguler) / 2 jam (untuk breaking)
- Minimum panjang snippet: 100 karakter
- Deduplikasi by URL hash
- Blacklist domain: sumber tidak terpercaya, clickbait farm

---

#### C. Trend Scout Agent (`src/agents/trendScout.js`)

**Input:** 50-100 artikel dari RSS Reader  
**Output:** 1 topik terpilih + konteks sumber

**Proses:**
1. Kirim semua artikel ke Gemini dengan prompt analisis tren
2. Gemini + Search Grounding menganalisis: mana yang paling trending di Indonesia?
3. Cek `published.db`: apakah topik serupa sudah ditulis dalam 72 jam terakhir?
4. Scoring berdasarkan:
   - Recency (artikel < 24 jam = skor lebih tinggi)
   - Relevance ke audiens Indonesia
   - Keunikan (belum ditulis di Joben)
   - Trending signal (banyak sumber meliput = lebih trending)
5. Return topik dengan skor tertinggi yang belum ditulis

**Prompt Template:**
```
Kamu adalah Content Strategist senior untuk portal berita teknologi 
Indonesia "JOBEN NEWS". 

Berikut adalah {N} artikel teknologi terbaru dari berbagai sumber 
internasional dan lokal:

{ARTIKEL_LIST}

Tugasmu:
1. Identifikasi 5 topik PALING TRENDING yang relevan untuk pembaca 
   teknologi Indonesia saat ini
2. Untuk setiap topik, berikan:
   - Judul topik yang spesifik
   - Mengapa ini trending sekarang
   - Sudut pandang Indonesia yang bisa ditambahkan
   - Artikel sumber mana yang paling relevan
3. Urutkan dari yang paling menarik untuk pembaca Indonesia

Format output: JSON array dengan field: topic, reason, indonesia_angle, 
source_articles[]

Pertimbangkan: dampak terhadap industri teknologi Indonesia, startup 
lokal, regulasi pemerintah Indonesia yang relevan, atau tren yang 
sudah/akan sampai di Indonesia.
```

---

#### D. Writer Agent (`src/agents/writer.js`)

**Input:** Topik terpilih + snippets sumber + metadata (kategori, subkategori, author)  
**Output:** Artikel dalam format Strapi Blocks JSON + metadata SEO

**System Prompt (Persona Jurnalis):**
```
Kamu adalah {AUTHOR_NAME}, {AUTHOR_TITLE} di JOBEN NEWS — portal berita 
teknologi Indonesia terkemuka.

IDENTITASMU:
- Wartawan senior dengan pengalaman 8 tahun meliput teknologi
- Menulis untuk pembaca Indonesia yang melek teknologi
- Gaya bahasa: profesional tapi mudah dipahami, seperti Kompas Tekno
- Mengikuti PUEBI (Pedoman Umum Ejaan Bahasa Indonesia) secara ketat

STANDAR PENULISAN:
1. STRUKTUR PIRAMIDA TERBALIK:
   - Lead/Teras: Jawab 5W1H dalam 1-2 kalimat pertama
   - Body: Fakta, detail, kutipan sumber
   - Konteks Indonesia: Dampak/relevansi untuk Indonesia
   - Penutup: Outlook atau yang perlu diwaspadai

2. GAYA BAHASA:
   - Kalimat aktif, bukan pasif
   - Satu ide per paragraf
   - Hindari kata-kata berlebihan
   - Gunakan angka/data spesifik, bukan generalisasi
   - Kutip sumber dengan atribusi yang jelas

3. YANG HARUS ADA:
   - Minimal 2 angka/statistik/tanggal yang spesifik
   - Konteks lokal Indonesia (minimal 1 paragraf)
   - Atribusi sumber yang jelas di badan artikel

4. YANG HARUS DIHINDARI:
   - Kalimat generik tanpa fakta ("Perkembangan ini sangat menarik...")
   - Judul clickbait ("MENGEJUTKAN! Ternyata...")
   - Duplikat informasi dalam satu artikel
   - Opini tanpa dasar fakta
   - Kata-kata yang tidak ada di KBBI untuk hal umum

PANJANG ARTIKEL: 500-700 kata (berita reguler), 300-400 kata (breaking news)
```

**User Prompt:**
```
Tulis artikel berita untuk topik berikut:

TOPIK: {TOPIC}
KATEGORI: {CATEGORY} > {SUBCATEGORY}
SUDUT PANDANG INDONESIA: {INDONESIA_ANGLE}

SUMBER UTAMA:
{SOURCE_SNIPPETS}

OUTPUT FORMAT (JSON):
{
  "title": "Judul artikel (max 70 karakter, faktual, menarik)",
  "slug": "url-friendly-slug-bahasa-indonesia",
  "excerpt": "Ringkasan 1-2 kalimat (max 160 karakter untuk SEO)",
  "content": [...],  // Strapi Blocks JSON format
  "seo_title": "SEO title (max 60 karakter)",
  "seo_description": "Meta description (max 155 karakter)",
  "focus_keyword": "kata kunci utama",
  "tags": ["tag1", "tag2", "tag3"],
  "source_attribution": "Nama Sumber, tanggal",
  "source_url": "URL sumber utama",
  "word_count": 0,
  "content_type": "reguler|breaking|tutorial|opini"
}

Artikel harus ORISINIL — bukan terjemahan langsung. Tambahkan 
interpretasi, konteks Indonesia, dan nilai tambah yang tidak ada 
di sumber asli.
```

**Strapi Blocks JSON Format:**
```json
[
  {
    "type": "paragraph",
    "children": [
      { "type": "text", "text": "Isi paragraf pertama (lead)..." }
    ]
  },
  {
    "type": "heading",
    "level": 2,
    "children": [
      { "type": "text", "text": "Subjudul Bagian" }
    ]
  },
  {
    "type": "paragraph",
    "children": [
      { "type": "text", "text": "Isi paragraf..." }
    ]
  }
]
```

---

#### E. Quality Gate (`src/agents/qualityGate.js`)

Setiap artikel melewati 7 pemeriksaan otomatis sebelum dipublish:

| Check | Logika | Threshold | Action jika Gagal |
|-------|--------|-----------|-------------------|
| Word Count | Hitung kata di content | Min 450 kata | Regenerate dengan instruksi "perbanyak detail" |
| Fact Density | Regex angka/tanggal/nama entitas | Min 2 fakta spesifik | Regenerate dengan instruksi "tambahkan data spesifik" |
| Keyword Density | Frekuensi kata / total kata | Max 3% per kata | Regenerate |
| Title Length | Hitung karakter judul | 40-70 karakter | Auto-trim atau regenerate |
| Meta Description | Hitung karakter | 120-155 karakter | Auto-generate ulang hanya meta |
| Blacklist Check | Regex kata sensitif (SARA, hoaks pattern) | 0 hit | Reject topik, pilih topik lain |
| Duplicate Check | Similarity vs 72 jam terakhir di Strapi | Max 25% overlap | Reject, pilih topik lain |

**Scoring:**
```
quality_score = (
  wordCount >= 500 ? 2 : 1,
  factCount >= 3 ? 2 : (factCount >= 2 ? 1 : 0),
  hasIndonesiaContext ? 2 : 0,
  hasClearAttribution ? 1 : 0,
  keywordDensity <= 2 ? 2 : 1
) / 9 * 100

Minimum untuk publish: quality_score >= 65
```

---

#### F. Image Generator (`src/agents/imageGen.js`)

**Input:** Judul + excerpt artikel  
**Output:** URL gambar di Cloudflare R2

**Proses:**
1. Generate deskripsi visual dari artikel menggunakan Gemini Flash
2. Buat image prompt yang kuat untuk Imagen 3
3. Call Imagen 3 API
4. Resize/compress output (target: max 500KB, format WebP)
5. Upload ke R2 dengan path: `covers/{YYYY}/{MM}/{slug}.webp`
6. Return R2 public URL

**Image Prompt Template:**
```
{VISUAL_DESCRIPTION}

Style: photorealistic editorial news photography, high-detail, 
professional lighting, 16:9 aspect ratio, sharp focus, 
vibrant colors, suitable for technology news website,
no text overlay, no watermark

Technical: ultra high resolution, hyperrealistic, cinematic quality,
depth of field, professional DSLR quality
```

**Spesifikasi Output:**
- Dimensi: 1280×720 piksel (16:9)
- Format: WebP
- Kualitas: 85%
- Max file size: 500KB

---

#### G. Internal Linker (`src/agents/internalLinker.js`)

Sebelum publish, agent mencari artikel lama yang relevan untuk disisipkan sebagai internal link:

1. Ambil 20 artikel terbaru dari Strapi
2. Bandingkan topik dengan artikel yang akan dipublish
3. Temukan 2-3 artikel paling relevan
4. Sisipkan link secara natural ke dalam body artikel
5. Hindari over-linking: 1 artikel tidak lebih dari 3 internal link

---

#### H. Publisher (`src/agents/publisher.js`)

**Input:** Artikel JSON + R2 image URL  
**Output:** Artikel tayang di Strapi + ISR revalidation triggered

**Proses:**
```javascript
// 1. Upload gambar ke Strapi Media Library (referensi ke R2 URL)
const mediaId = await strapiClient.createMediaEntry({
  url: r2ImageUrl,
  name: `${slug}-cover`,
  alternativeText: title,
  caption: `Ilustrasi: ${title}`
});

// 2. Resolve author ID dari mapping kategori
const authorId = authorsConfig[category].strapiId;

// 3. Resolve category & subcategory ID
const { categoryId, subcategoryId } = await strapiClient
  .resolveCategory(category, subcategory);

// 4. Resolve atau buat tags
const tagIds = await strapiClient.resolveOrCreateTags(tags);

// 5. Hitung jadwal publish (distribusi merata sepanjang hari)
const publishedAt = timeManager.getNextPublishSlot();

// 6. POST artikel ke Strapi
const article = await strapiClient.createArticle({
  title,
  slug,
  excerpt,
  content,         // Strapi Blocks JSON
  cover: mediaId,
  author: authorId,
  category: categoryId,
  subcategory: subcategoryId,
  tags: tagIds,
  seo: { title: seo_title, description: seo_description },
  source_url,
  source_attribution,
  publishedAt,
  editorial_status: "published"
});

// 7. Trigger ISR revalidation Next.js
await fetch(`${NEXTJS_REVALIDATION_URL}?secret=${REVALIDATION_SECRET}`);

// 8. Catat ke SQLite
await db.recordPublished(article);

// 9. Update state.json
state.articlesPublished++;

// 10. Notifikasi Telegram
await telegram.notifyPublished(article);
```

---

#### I. Scheduler (`src/scheduler/index.js`)

**Logika Jadwal 30 Artikel dalam 24 Jam:**

```
Jam aktif: 06.00 - 23.00 WIB (17 jam aktif)
17 jam × 60 menit = 1020 menit aktif
1020 / 30 artikel = 34 menit per artikel

Interval dasar: setiap 34 menit
Variasi: ±10 menit random (agar tidak terlalu mecanikal)
Hasil: 30 artikel tersebar natural sepanjang hari
```

**Cron Jobs:**
```
*/1 * * * *     → Main scheduler tick (cek queue setiap menit)
*/5 * * * *     → Breaking news daemon tick
0 0 * * *       → Reset daily counter
0 23 * * 0      → Generate editorial calendar mingguan (Minggu malam)
0 */1 * * *     → API key health check
0 4 * * *       → Daily cleanup + log rotation
```

**State Machine Scheduler:**
```
IDLE
  │ (waktu interval tercapai)
  ▼
TREND_SCOUTING
  │ (topik ditemukan)
  ▼
WRITING
  │ (artikel draft selesai)
  ▼
QUALITY_CHECK
  │ (pass) ────────────────► (fail) → WRITING (retry, max 3×)
  ▼                                        │
IMAGE_GENERATING                           │ (fail 3×) → SKIP + LOG
  │                                        
  ▼
PUBLISHING
  │ (success)
  ▼
NOTIFYING
  │
  ▼
IDLE (tunggu interval berikutnya)
```

---

#### J. Breaking News Daemon (`src/scheduler/breakingDaemon.js`)

**Proses terpisah dari scheduler utama:**

```
Poll setiap 5 menit:
1. Fetch RSS dari sumber breaking (Reuters, AP, BBC)
2. Filter: artikel < 2 jam terakhir
3. Deteksi keyword breaking:
   Tier 1 (langsung publish): "breaking", "just in", "urgent",
                               "emergency", "crash", "hack", "breach"
   Tier 2 (publish dalam 30 menit): nama perusahaan besar,
                               nama tokoh tech, nama produk major

4. Jika ada breaking Tier 1:
   - Bypass scheduler queue
   - Trigger writer dengan mode "breaking" (artikel 300-400 kata)
   - Target: dari deteksi ke publish < 15 menit
   - Notifikasi Telegram: "🔴 BREAKING NEWS dipublish"

5. Jika ada breaking Tier 2:
   - Masukkan ke priority queue (urutan terdepan)
   - Notifikasi Telegram: "⚡ Hot news dideteksi, akan dipublish segera"
```

---

#### K. Telegram Notifier (`src/services/telegramNotifier.js`)

**Jenis Notifikasi:**

| Event | Pesan | Urgency |
|-------|-------|---------|
| Artikel reguler published | "✅ [Kategori] Judul artikel — link" | Info |
| Breaking news published | "🔴 BREAKING: Judul — link" | High |
| Agent error | "⚠️ Error: [detail error]" | Warning |
| Agent mati (tidak ada artikel 2 jam) | "🚨 AGENT DOWN! Tidak ada artikel 2 jam terakhir" | Critical |
| API key habis | "🔑 Key {ID} habis kuota hari ini" | Warning |
| Semua key habis | "🚨 SEMUA API KEY HABIS! Agent berhenti" | Critical |
| Target harian tercapai | "🎯 Target 30 artikel hari ini tercapai!" | Info |
| Quality gate rejection | "❌ Artikel ditolak quality gate: [alasan]" | Info |

**Telegram Bot Setup:**
- 1 bot untuk notifikasi operasional (ke chat pribadi admin)
- (Fase 3) Bot terpisah untuk Telegram Channel publik Joben News

---

### 5.2 Environment Variables Fase 1

```bash
# .env

# === STRAPI ===
STRAPI_API_URL=https://cms.news.jobenapp.cloud
STRAPI_API_TOKEN=your_strapi_token_here

# === CLOUDFLARE R2 ===
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=joben-news
R2_ENDPOINT=https://your_account.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# === GEMINI API KEYS (15 keys) ===
GEMINI_KEY_01=AIza...
GEMINI_KEY_02=AIza...
GEMINI_KEY_03=AIza...
# ... sampai 15

# === NEXT.JS ISR REVALIDATION ===
NEXTJS_REVALIDATION_URL=https://news.jobenapp.cloud/api/revalidate
NEXTJS_REVALIDATION_SECRET=your_secret

# === TELEGRAM BOT ===
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_chat_id

# === DASHBOARD ===
DASHBOARD_PORT=4000
DASHBOARD_JWT_SECRET=your_jwt_secret_min_32_chars
DASHBOARD_ADMIN_USERNAME=admin
DASHBOARD_ADMIN_PASSWORD_HASH=bcrypt_hash_of_password

# === GENERAL ===
NODE_ENV=production
TZ=Asia/Jakarta
LOG_LEVEL=info
```

---

### 5.3 Deliverables Fase 1

- [ ] Project setup + package.json + PM2 config
- [ ] Gemini key pool dengan rotasi dan health check
- [ ] RSS reader multi-sumber
- [ ] Trend Scout agent (Gemini + Search Grounding)
- [ ] Writer agent (prompt jurnalis Indonesia + PUEBI)
- [ ] Quality Gate 7 pemeriksaan
- [ ] Internal Linker
- [ ] Image Generator (Imagen 3 + R2 upload)
- [ ] Publisher (Strapi REST + ISR revalidation)
- [ ] Scheduler (30 artikel/hari, jam 06-23 WIB)
- [ ] Breaking News Daemon
- [ ] Telegram Notifier
- [ ] SQLite state tracking
- [ ] Dashboard Express (basic: overview + live log)
- [ ] Scripts: setup, test, seed authors
- [ ] Documentation: README + setup guide

### 5.4 Testing Fase 1

1. **Unit test** tiap agent via CLI script
2. **Integration test**: generate 1 artikel end-to-end (trend → artikel → Strapi)
3. **Load test**: jalankan 5 artikel sekaligus, pastikan key rotation bekerja
4. **Breaking news test**: inject artikel palsu ke RSS, pastikan diprioritaskan
5. **Failure test**: nonaktifkan semua key, pastikan alert Telegram terkirim
6. **Quality gate test**: kirim artikel pendek/berkualitas rendah, pastikan ditolak

---

## 6. FASE 2 — INTELLIGENT: AGENT YANG BELAJAR

**Durasi Target:** 2-4 minggu setelah Fase 1 stabil  
**Tujuan:** Agent belajar dari performa konten dan mengoptimalkan strategi secara otomatis

### 6.1 GA4 Feedback Loop

**Sistem:** Setiap Senin jam 03.00, agent mengambil data performa dari Google Analytics 4.

**Data yang Diambil:**
```javascript
{
  // Artikel dengan pageview tertinggi minggu ini
  topArticles: [
    { title, pageviews, avgSessionDuration, bounceRate, category }
  ],
  // Kategori dengan traffic terbaik
  topCategories: [
    { category, totalPageviews, avgEngagementTime }
  ],
  // Kata kunci yang membawa traffic (via Search Console)
  topKeywords: [
    { keyword, clicks, impressions, ctr, avgPosition }
  ]
}
```

**Cara Data Mempengaruhi Agent:**

```javascript
// Diinjeksikan ke system prompt Writer setiap Senin
const performanceContext = `
INSIGHT PERFORMA MINGGU LALU:
- Artikel dengan CTR tertinggi memiliki judul pola: "${topTitlePattern}"
- Kategori paling engaging: ${topCategory} (avg ${avgTime} detik)
- Panjang artikel optimal berdasarkan data: ${optimalWordCount} kata
- Gaya penulisan terbaik dari artikel top: ${writingStyleInsight}

Gunakan insight ini untuk meningkatkan kualitas artikel minggu ini.
`;
```

### 6.2 Competitive Intelligence Engine

**Cara Kerja:**
1. Setiap 6 jam, crawl halaman utama Kompas Tekno, Detik Inet, TechInAsia ID
2. Ekstrak headline artikel 24 jam terakhir
3. Bandingkan dengan artikel yang sudah ada di Joben
4. Identifikasi "topik gap" — yang mereka tulis tapi Joben belum
5. Masukkan topik gap ke priority queue dengan label "competitive"

**Logika Gap Analysis:**
```
Jika Kompas Tekno punya 5 artikel tentang "Snapdragon X Elite"
Dan Joben hanya punya 1 artikel tentang itu
→ Flag sebagai topic gap, prioritaskan
→ Agent tidak copy, tapi tulis dengan sudut pandang berbeda
```

### 6.3 Article Update Agent

**Trigger Update:**
- Artikel > 30 hari tapi masih banyak dikunjungi (traffic masih tinggi)
- Breaking news yang sudah berkembang (ada informasi baru)
- Artikel harga produk yang sudah outdated

**Proses Update:**
1. Ambil artikel lama dari Strapi
2. Cari informasi terbaru tentang topik yang sama
3. Tambahkan section "Update [tanggal]:" di bagian atas
4. Update Strapi tanpa mengubah publishedAt (agar tidak dianggap konten baru)
5. Notifikasi Telegram: "🔄 Artikel diperbarui: [judul]"

### 6.4 SEO Intelligence

**Google Search Console Integration:**
1. Setiap minggu, ambil data keyword ranking
2. Identifikasi keyword yang posisinya di 5-20 (easy win untuk naik ke top 5)
3. Buat artikel baru atau update artikel existing yang menarget keyword tersebut
4. Track perubahan ranking setelah artikel dipublish

**Internal Linking Intelligence:**
1. Bangun "link graph" antar artikel
2. Deteksi artikel yang tidak punya incoming internal link ("orphan articles")
3. Saat artikel baru dipublish, otomatis update artikel lama yang relevan untuk menambah link ke artikel baru

### 6.5 Editorial Calendar Generator

**Proses (Setiap Minggu):**
1. Analisis tren dari RSS semua sumber
2. Cek event teknologi besar minggu depan (konferensi, earnings call, product launch)
3. Buat rencana 30-35 topik untuk 7 hari ke depan
4. Simpan ke `data/editorial-calendar.json`
5. Tampilkan di dashboard (editable oleh admin)
6. Admin bisa approve/edit/delete topik sebelum Senin jam 06.00

**Format Calendar:**
```json
{
  "week": "2026-W30",
  "generatedAt": "2026-07-20T23:00:00+07:00",
  "status": "pending_review",
  "plan": [
    {
      "date": "2026-07-21",
      "slots": [
        {
          "time": "08:00",
          "topic": "Samsung Galaxy S26 Ultra: Bocoran Spec Lengkap",
          "subcategory": "Smartphone",
          "source": "gsmarena",
          "priority": "high",
          "status": "approved"
        }
      ]
    }
  ]
}
```

### 6.6 Deliverables Fase 2

- [ ] GA4 API client + weekly data fetcher
- [ ] Performance context injector ke writer prompt
- [ ] Competitive intelligence crawler (Kompas, Detik, TechInAsia)
- [ ] Topic gap analyzer
- [ ] Article Update Agent
- [ ] Search Console API client
- [ ] Keyword opportunity analyzer
- [ ] Orphan article detector + internal link injector
- [ ] Editorial Calendar Generator
- [ ] Dashboard: halaman editorial calendar (dengan edit UI)
- [ ] Dashboard: halaman performance analytics

---

## 7. FASE 3 — AUTONOMOUS: REDAKSI PENUH

**Durasi Target:** 1-2 bulan setelah Fase 2  
**Tujuan:** Sistem operasi seperti redaksi berita sungguhan dengan human oversight yang minimal

### 7.1 Multi-Level Human Override

**Konfigurasi per Kategori:**

| Mode | Deskripsi | Kategori Default |
|------|-----------|-----------------|
| `auto-publish` | Langsung tayang tanpa review | Gadget, Tutorial, AI |
| `review-required` | Masuk draft, admin approve via dashboard | Breaking News, Opini |
| `manual-only` | Agent buat draft, manusia yang publish | Kolom Pakar, Editorial |

**Review Flow di Dashboard:**
```
Agent selesai buat artikel → status: "pending_review"
Dashboard tampilkan notifikasi: "3 artikel menunggu review"
Admin buka dashboard → preview artikel
Admin klik: [Publish Sekarang] [Publish Terjadwal] [Edit] [Reject]
Jika reject: admin isi alasan → agent belajar dari feedback
```

### 7.2 Telegram Channel Distribution

**Setup:**
- Buat Telegram Channel publik: `@JobenNews`
- Bot auto-post ke channel setelah artikel published

**Format Post:**
```
📰 *JOBEN NEWS*

[Judul Artikel]

[Excerpt 2 kalimat]

🏷️ #[Kategori] #[Tag1] #[Tag2]

📖 Baca selengkapnya: [link artikel]

— @JobenNews
```

**Strategi Posting Channel:**
- Artikel reguler: 30 menit setelah published di website
- Breaking news: langsung saat published
- Tidak semua artikel dipost ke channel (filter: quality_score >= 75)

### 7.3 Content Diversity Manager

**Masalah yang Dipecahkan:** Tanpa manajemen, agent mungkin over-coverage satu topik.

**Aturan:**
- Maks 3 artikel per subkategori per hari
- Maks 1 artikel per topik spesifik per 72 jam
- Minimal 8 kategori utama berbeda harus tercover setiap hari
- Breaking news tidak dihitung dalam kuota kategori

**Implementasi:**
```javascript
const diversityRules = {
  maxPerSubcategory: 3,
  maxSimilarTopicHours: 72,
  minCategoriesPerDay: 8,
  breakingNewsExempt: true
};
```

### 7.4 Quality Learning System

**Agent belajar dari rejection:**
1. Setiap kali admin reject artikel via dashboard → catat alasan
2. Setiap kali quality gate gagal → catat alasan
3. Mingguan: analisis pattern rejection → update prompt template
4. Simpan "lessons learned" di `data/quality-lessons.json`

```json
{
  "lessons": [
    {
      "date": "2026-07-22",
      "issue": "Artikel terlalu generik, tidak ada fakta spesifik",
      "category": "AI",
      "fix": "Tambahkan instruksi: 'wajib sertakan minimal 3 angka/statistik spesifik'",
      "addedToPrompt": true
    }
  ]
}
```

### 7.5 AdSense Compliance Monitor

**Pemeriksaan Otomatis Mingguan:**
1. Scan semua artikel bulan ini
2. Flagging artikel yang berisiko:
   - Terlalu pendek (< 400 kata)
   - Keyword density terlalu tinggi
   - Tidak ada gambar
   - Struktur heading tidak ada
3. Auto-update atau flag untuk review manual
4. Report di dashboard + Telegram

### 7.6 Deliverables Fase 3

- [ ] Multi-level review system (auto/review/manual per kategori)
- [ ] Review UI di dashboard (approve/reject dengan alasan)
- [ ] Telegram Channel auto-poster
- [ ] Content Diversity Manager
- [ ] Quality Learning System (lesson collection)
- [ ] AdSense Compliance Monitor
- [ ] Weekly performance report via Telegram
- [ ] Dashboard: halaman review queue dengan preview artikel

---

## 8. FASE 4 — EXPANDING: MULTI-OUTPUT

**Durasi Target:** 3-6 bulan setelah Fase 3 stabil  
**Tujuan:** Artikel menjadi bahan baku untuk format konten lain

### 8.1 Newsletter Engine

**Konsep:** Setiap hari Jumat jam 09.00, kirim digest mingguan ke subscriber email.

**Format Newsletter:**
```
Subject: Teknologi Terbaik Minggu Ini — JOBEN NEWS Digest

[Header dengan logo]

🔥 HIGHLIGHT MINGGU INI
→ [Artikel terpopuler 1]
→ [Artikel terpopuler 2]
→ [Artikel terpopuler 3]

📂 PER KATEGORI
→ AI & Machine Learning: [2 artikel]
→ Startup Indonesia: [2 artikel]
→ Gadget & Review: [2 artikel]

🔴 BREAKING NEWS MINGGU INI
→ [Breaking news paling penting]

[Footer dengan unsubscribe link]
```

**Infrastruktur:** Email via SMTP cPanel atau Mailgun API.

### 8.2 Podcast Script Generator

**Konsep:** Konversi top 3 artikel per minggu menjadi script podcast 5-7 menit.

**Format Output:**
```
=== JOBEN NEWS PODCAST — Edisi [Tanggal] ===

[INTRO — 30 detik]
"Selamat datang di JOBEN NEWS Podcast, saya [Host Name].
Di episode hari ini, kita akan membahas..."

[SEGMEN 1 — 2 menit]
Judul: [Artikel 1]
Script: [Konversi artikel ke bahasa spoken word]

[SEGMEN 2 — 2 menit]
...

[OUTRO — 30 detik]
"Terima kasih sudah mendengarkan JOBEN NEWS Podcast..."
```

**Output disimpan** sebagai draft di Strapi (content type baru: Podcast), siap direkam secara manual.

### 8.3 Social Media Caption Generator

**Platform yang Didukung:**

| Platform | Format | Panjang | Strategi |
|----------|--------|---------|----------|
| Twitter/X | Thread atau single tweet | Max 280 karakter | Fakta menarik + link |
| Instagram | Caption + hashtag | Max 2200 karakter | Storytelling + 15-20 hashtag |
| LinkedIn | Post artikel | Max 3000 karakter | Profesional, insight bisnis |

**Proses:**
1. Setelah artikel published, agent generate caption untuk tiap platform
2. Simpan di Strapi sebagai draft social media post
3. Admin approve via dashboard → (Fase 5) post otomatis via API

### 8.4 Multi-Language Support (Pondasi)

**Hanya bangun fondasi** di Fase 4, implementasi penuh di Fase 5:
- Struktur artikel sudah mendukung field `locale`
- Config agent mendukung parameter `language`
- Prompt template tersedia untuk bahasa Inggris

### 8.5 Deliverables Fase 4

- [ ] Newsletter Engine (generator + SMTP sender)
- [ ] Subscriber management sederhana (email list)
- [ ] Podcast Script Generator
- [ ] Social Media Caption Generator (Twitter/Instagram/LinkedIn)
- [ ] Dashboard: halaman social media drafts
- [ ] Plugin system refactor (input/output/ai plugin architecture)
- [ ] Dokumentasi plugin system untuk kontributor

---

## 9. FASE 5 — FULL NEWSROOM: EKOSISTEM LENGKAP

**Durasi Target:** 6-12 bulan  
**Tujuan:** Ekosistem konten lengkap yang beroperasi seperti kantor berita digital modern

### 9.1 Specialized Agents per Kategori

**Konsep:** Alih-alih satu agent generalis, tiap kategori punya agent dengan konteks spesifik:

| Agent | Kategori | Konteks Khusus |
|-------|----------|----------------|
| `aiAgent` | AI & ML | Papers arxiv.org, Hugging Face releases, model benchmarks |
| `cryptoAgent` | Kripto | Harga real-time CoinGecko, on-chain data, regulatory news |
| `securityAgent` | Cyber Security | CVE database, security advisories, threat intelligence |
| `gadgetAgent` | Gadget | Spec database, benchmark scores, harga toko Indonesia |
| `startupAgent` | Startup | Crunchbase data, funding rounds, local startup news |

### 9.2 Video Script Generator

**Konsep:** Script untuk konten YouTube/TikTok dari artikel.

**Format:**
- YouTube: 5-10 menit, format eksplanasi mendalam
- TikTok/Reels: 60 detik, format hook-content-CTA
- Output: script + deskripsi video + tags YouTube

### 9.3 A/B Testing Headlines

**Konsep:** Test 2 versi judul per artikel, gunakan data CTR untuk belajar.

**Implementasi:**
1. Writer generate 2-3 opsi judul per artikel
2. Simpan semua opsi
3. Gunakan judul #1 untuk publish
4. Setelah 72 jam, cek CTR di Search Console
5. Feed hasil ke learning system

### 9.4 Real-Time Collaboration (Human + AI)

**Fitur Dashboard Lanjutan:**
- Editor teks langsung di dashboard (rich text)
- AI dapat revisi artikel yang sudah ditulis manusia
- Human dapat intervensi di tengah pipeline
- Versioning: setiap edit tersimpan, bisa rollback

### 9.5 Revenue Analytics

**Dashboard Revenue:**
- Estimasi revenue AdSense berdasarkan pageview
- Artikel dengan RPM (Revenue per Mille) tertinggi
- Kategori paling menguntungkan
- Rekomendasi: fokus ke kategori yang menghasilkan lebih

### 9.6 Deliverables Fase 5

- [ ] Specialized agents per kategori (5 agent)
- [ ] YouTube + TikTok script generator
- [ ] A/B test headline system
- [ ] Human-AI collaborative editor di dashboard
- [ ] Article versioning system
- [ ] Revenue analytics dashboard
- [ ] Full English language support
- [ ] API publik Joben Agent (untuk integrasi pihak ketiga)

---

## 10. DASHBOARD CONTROL CENTER

**URL:** `ai.jobenapp.cloud`  
**Tech:** Express.js + Vanilla HTML/CSS/JS  
**Auth:** JWT login form (bukan Basic Auth)  

### 10.1 Halaman Login

**Desain:** Form login profesional, bukan halaman admin generik.
- Logo JOBEN NEWS AI
- Field: Username + Password
- "Remember me" 30 hari
- Rate limit: max 5 percobaan gagal → lockout 15 menit
- Brute force protection: exponential delay

**JWT Config:**
```javascript
{
  accessToken: { expiresIn: "2h" },
  refreshToken: { expiresIn: "30d" },
  algorithm: "HS256",
  secret: process.env.DASHBOARD_JWT_SECRET  // min 32 karakter
}
```

### 10.2 Halaman Overview (Home Dashboard)

**Widgets yang Ditampilkan:**

```
┌─────────────────────────────────────────────────────────┐
│  JOBEN NEWS AI CONTROL CENTER             [Kill Switch] │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│ Artikel  │ Breaking │ API Keys │ Queue    │ Uptime     │
│ Hari Ini │ Hari Ini │ Aktif    │ Pending  │ 24 Jam     │
│ 18/30    │ 2/2 ✓    │ 14/15    │ 3        │ 99.8%      │
├──────────┴──────────┴──────────┴──────────┴────────────┤
│  AKTIVITAS TERBARU                                       │
│  14:30  ✅ [AI] "Google Rilis Gemini 2.5 Ultra..."      │
│  13:58  ✅ [Gadget] "Review Samsung Galaxy S26..."       │
│  13:22  ❌ Quality Gate gagal: artikel terlalu pendek    │
│  12:48  ✅ [Startup] "Startup Indonesia Raih Pendanaan.."│
├─────────────────────────────────────────────────────────┤
│  JADWAL BERIKUTNYA                                       │
│  15:04 → [Software Dev] topik: "Next.js 16 Release"     │
│  15:38 → [Kripto] topik belum ditentukan                │
├─────────────────────────────────────────────────────────┤
│  HEALTH METRICS          │  ARTIKEL PER KATEGORI HARI INI│
│  Avg Generation Time: 45s│  AI: ████ 4    Gadget: ███ 3  │
│  Success Rate: 94.4%     │  Dev: ███ 3    Kripto: ██ 2   │
│  API Key Usage: 38%      │  Sec: ██ 2     Startup: ██ 2  │
└─────────────────────────────────────────────────────────┘
```

**Kill Switch:**
- Tombol merah "HENTIKAN SEMUA" di pojok kanan atas
- Konfirmasi: "Apakah kamu yakin? Semua proses agent akan dihentikan."
- Jika diaktifkan: flag `agentStatus: "killed"` di state.json
- Agent cek flag ini di setiap tick → berhenti total
- Untuk restart: tombol "AKTIFKAN KEMBALI" di halaman sama

### 10.3 Halaman Articles Log

**Fitur:**
- Tabel semua artikel yang digenerate (terbaru di atas)
- Filter: status (published/failed/rejected), kategori, tanggal
- Search by judul
- Klik artikel → preview konten + metadata
- Badge status: ✅ Published | ❌ Failed | ⏳ Queued | 👁️ Review
- Link langsung ke artikel di website (buka tab baru)
- Link ke Strapi admin edit

### 10.4 Halaman Queue Manager

**Fitur:**
- List artikel yang sedang dalam antrian
- Drag-and-drop untuk reorder priority
- Tambah topik manual ke queue
- Hapus item dari queue
- "Publish sekarang" untuk artikel yang sudah di-draft

### 10.5 Halaman Schedule Config

**Fitur:**
```
Jam Aktif Agent: [06:00] - [23:00] WIB
Target Artikel Harian: [30]
Interval Minimum Antar Artikel: [20] menit
Interval Maksimum Antar Artikel: [50] menit
Breaking News: [✓] Aktif
Breaking News Polling: setiap [5] menit

JADWAL KHUSUS:
[✓] Senin - Jumat: 30 artikel/hari
[✓] Sabtu - Minggu: 20 artikel/hari
```

### 10.6 Halaman Prompt Editor

**Fitur:**
- Edit semua prompt template langsung dari browser
- Syntax highlighting (CodeMirror)
- Preview perubahan sebelum save
- Versioning: simpan 10 versi terakhir, bisa rollback
- "Test prompt" → generate 1 artikel sample dengan prompt baru

### 10.7 Halaman API Key Monitor

**Tampilan:**
```
┌────────┬──────────┬───────────┬──────────┬─────────────┐
│ Key ID │ Status   │ Used/Day  │ Errors   │ Last Used   │
├────────┼──────────┼───────────┼──────────┼─────────────┤
│ key_01 │ 🟢 Aktif │ 45/1500   │ 0        │ 2 menit lalu│
│ key_02 │ 🟢 Aktif │ 38/1500   │ 0        │ 8 menit lalu│
│ key_03 │ 🟡 Cooldown│ 89/1500  │ 1 (429) │ 12 mnt lalu │
│ key_04 │ 🔴 Error │ 12/1500   │ 5 streak │ 45 mnt lalu │
│ ...    │          │           │          │             │
└────────┴──────────┴───────────┴──────────┴─────────────┘
[+ Tambah Key]  [Reset Daily Counter]  [Test Semua Keys]
```

### 10.8 Halaman Live Logs

**Fitur:**
- Server-Sent Events (SSE) untuk real-time log tanpa refresh
- Filter level: DEBUG / INFO / WARN / ERROR
- Auto-scroll terbaru
- Download log file (per tanggal)
- Clear display (tidak hapus file)

### 10.9 Halaman Manual Trigger

**Untuk testing dan override:**
```
[GENERATE ARTIKEL SEKARANG]
Kategori:    [Pilih kategori ▼]
Subkategori: [Pilih subkategori ▼]
Topik:       [Manual input atau kosong untuk auto]
Mode:        ( ) Reguler  (•) Breaking News
Author:      [Auto sesuai kategori ▼]
             
[▶ Generate & Publish]  [▶ Generate Draft Saja]
```

---

## 10.10 IMPLEMENTASI DASHBOARD — FASE 1: RENCANA PRESISI

> **Tujuan dokumen ini:** Menjadi kontrak implementasi tunggal yang mengatur struktur file,
> kontrak API (method · path · body · response), konvensi error, dan format data.
> Semua kode backend WAJIB mengikuti spesifikasi ini.

---

### 10.10.1 Struktur File Final

```
agent/src/dashboard/
├── server.js                     ← Express app + mount semua route
├── middleware/
│   ├── auth.js                   ← JWT verify (Bearer header atau cookie)
│   └── rateLimit.js              ← express-rate-limit: login & API limiter
└── routes/
│   ├── auth.js                   ← POST /login  POST /logout  POST /refresh  GET /me
│   ├── overview.js               ← GET /        POST /kill-switch  GET /recent-activity
│   ├── articles.js               ← GET /        GET /:id
│   ├── queue.js                  ← GET /  POST /  DELETE /:id  PUT /reorder  POST /:id/trigger
│   ├── schedule.js               ← GET /  PUT /
│   ├── authors.js                ← GET /
│   ├── keys.js                   ← GET /  POST /add  DELETE /:id  POST /reset-daily  POST /test
│   ├── prompts.js                ← GET /  PUT /  GET /versions  POST /rollback
│   ├── logs.js                   ← GET /stream (SSE)  GET /dates  GET /download/:date
│   ├── manual.js                 ← POST /generate
│   └── settings.js               ← GET /  PUT /
└── public/                       ← [Sub-bagian 2 — Frontend] HTML + CSS + JS
    ├── index.html                ← Login page
    ├── dashboard.html            ← Overview
    ├── articles.html
    ├── queue.html
    ├── schedule.html
    ├── keys.html
    ├── prompts.html
    ├── logs.html
    ├── settings.html
    ├── css/
    │   └── dashboard.css
    └── js/
        ├── api.js
        ├── auth.js
        └── components.js
```

---

### 10.10.2 Konvensi Global Backend

#### Envelope Response

```js
// Sukses
{ "ok": true, "data": <payload> }

// Sukses + paginasi
{ "ok": true, "data": [...], "meta": { "total": 245, "page": 1, "limit": 20, "pages": 13 } }

// Error
{ "ok": false, "error": "KODE_ERROR", "message": "Pesan yang bisa dibaca manusia" }
```

#### Kode Error Standar

| Kode | HTTP | Keterangan |
|---|---|---|
| `UNAUTHORIZED` | 401 | Token tidak ada atau expired |
| `FORBIDDEN` | 403 | Token valid tapi akses ditolak |
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `VALIDATION_ERROR` | 400 | Body request tidak valid |
| `RATE_LIMITED` | 429 | Terlalu banyak request |
| `INTERNAL_ERROR` | 500 | Error server tak terduga |

#### Autentikasi

- Semua route `/api/*` kecuali `/api/auth/*` wajib melewati middleware `requireAuth`
- Token dikirim via `Authorization: Bearer <accessToken>` **atau** cookie `access_token`
- Expired accessToken → client kirim `POST /api/auth/refresh` dengan refreshToken
- Middleware menempel `req.user = { username, iat, exp }` ke setiap request

---

### 10.10.3 Kontrak API Lengkap

#### `POST /api/auth/login`
```
Auth  : Tidak diperlukan
Body  : { "username": string, "password": string, "rememberMe": boolean }
200   : { "ok": true, "data": { "accessToken": string, "refreshToken": string,
          "expiresIn": 7200 } }
401   : { "ok": false, "error": "INVALID_CREDENTIALS" }
429   : { "ok": false, "error": "RATE_LIMITED", "retryAfter": 900 }
```
- Password diverifikasi dengan `bcryptjs.compare()` vs `DASHBOARD_ADMIN_PASSWORD_HASH`
- Gagal login: increment counter per-IP di memory
- 5 gagal berturut-turut dalam 15 menit → lockout, header `Retry-After` dikirim

#### `POST /api/auth/logout`
```
Auth  : Diperlukan
Body  : {}
200   : { "ok": true }
```
- Simpan token ke in-memory blacklist (valid sampai exp-nya habis)

#### `POST /api/auth/refresh`
```
Auth  : Tidak diperlukan
Body  : { "refreshToken": string }
200   : { "ok": true, "data": { "accessToken": string, "expiresIn": 7200 } }
401   : { "ok": false, "error": "INVALID_REFRESH_TOKEN" }
```

#### `GET /api/auth/me`
```
Auth  : Diperlukan
200   : { "ok": true, "data": { "username": string, "loginAt": ISO8601 } }
```

---

#### `GET /api/overview`
```
Auth  : Diperlukan
200   : { "ok": true, "data": {
    "state": <isi state.json>,
    "uptime": { "processMs": number, "startedAt": ISO8601 },
    "recentActivity": [ ...20 artikel terbaru dari SQLite ]
  }}
```
- `state.json` dibaca fresh dari disk setiap request (agent bisa update kapan saja)
- `recentActivity`: query `SELECT * FROM articles ORDER BY created_at DESC LIMIT 20`

#### `POST /api/overview/kill-switch`
```
Auth  : Diperlukan
Body  : { "action": "kill" | "activate" }
200   : { "ok": true, "data": { "agentStatus": string } }
```
- Update field `agentStatus` di `state.json`:
  - `"kill"` → set `agentStatus: "killed"`
  - `"activate"` → set `agentStatus: "idle"`

---

#### `GET /api/articles`
```
Auth   : Diperlukan
Query  : page=1  limit=20  status=published|failed|rejected|all
         category=string  date=YYYY-MM-DD  q=string
200    : { "ok": true, "data": [...], "meta": { total, page, limit, pages } }
```
- Query ke `published.db` tabel `articles`
- `q` → `WHERE title LIKE '%q%'`
- `date` → `WHERE DATE(published_at) = date`
- Selalu ORDER BY `created_at DESC`
- Mask field `gemini_key_used` sebelum return (privasi key)

#### `GET /api/articles/:id`
```
Auth  : Diperlukan
200   : { "ok": true, "data": <row artikel lengkap> }
404   : { "ok": false, "error": "NOT_FOUND" }
```

---

#### `GET /api/queue`
```
Auth  : Diperlukan
200   : { "ok": true, "data": { "items": [...], "total": number } }
```
- Baca `data/queue.json`, return field: id, priority, topicData, source,
  contentType, forcedCategory, addedAt, status

#### `POST /api/queue`
```
Auth  : Diperlukan
Body  : { "topic": string, "category": string, "subcategory": string?,
          "priority": 0|1|2, "contentType": "reguler"|"breaking" }
201   : { "ok": true, "data": { "id": string } }
400   : { "ok": false, "error": "VALIDATION_ERROR", "message": string }
```
- Validasi: `topic` wajib, `category` wajib, `priority` default 0

#### `DELETE /api/queue/:id`
```
Auth  : Diperlukan
200   : { "ok": true }
404   : { "ok": false, "error": "NOT_FOUND" }
```

#### `PUT /api/queue/reorder`
```
Auth  : Diperlukan
Body  : { "orderedIds": [string, ...] }
200   : { "ok": true, "data": { "items": [...] } }
```
- Rewrite urutan items di queue.json sesuai orderedIds

#### `POST /api/queue/:id/trigger`
```
Auth  : Diperlukan
200   : { "ok": true, "message": "Item dipindahkan ke priority tertinggi" }
404   : { "ok": false, "error": "NOT_FOUND" }
```
- Set priority item ke 2 (breaking priority) agar diproses scheduler tick berikutnya

---

#### `GET /api/schedule`
```
Auth  : Diperlukan
200   : { "ok": true, "data": { "agent": {...}, "scheduler": {...} } }
```
- Return gabungan section `agent` + `scheduler` dari `settings.json`

#### `PUT /api/schedule`
```
Auth  : Diperlukan
Body  : { "agent"?: {...partial}, "scheduler"?: {...partial} }
200   : { "ok": true, "data": { "agent": {...}, "scheduler": {...} } }
400   : VALIDATION_ERROR jika nilai tidak valid (misal activeHours.start < 0)
```
- Deep merge body ke settings.json, lalu tulis ulang file
- Validasi: `dailyTarget` 1–100, `activeHours.start` 0–23 < `end`,
  `intervalMinBase` ≥ 5

---

#### `GET /api/authors`
```
Auth  : Diperlukan
200   : { "ok": true, "data": [ { id, name, title, specialization,
          categoryMapping } ] }
```
- Baca `src/config/authors.json`, tambah field `categoryMapping` dari
  section `categoryMap` di file yang sama

---

#### `GET /api/keys`
```
Auth  : Diperlukan
200   : { "ok": true, "data": { "keys": [ {id, status, dailyUsed, dailyLimit,
          errorStreak, lastUsed, lastError, disabledUntil,
          "key": "AIza...****" ← masked} ],
          "lastRotationIndex": number, "summary": {active, cooldown,
          exhausted, disabled, total} } }
```
- `key` di-mask: tampilkan 8 karakter pertama + `****`

#### `POST /api/keys/add`
```
Auth  : Diperlukan
Body  : { "key": string }
201   : { "ok": true, "data": { "id": string } }
400   : VALIDATION_ERROR jika key tidak dimulai "AIza" atau sudah ada
```

#### `DELETE /api/keys/:keyId`
```
Auth  : Diperlukan
200   : { "ok": true }
404   : NOT_FOUND
```

#### `POST /api/keys/reset-daily`
```
Auth  : Diperlukan
200   : { "ok": true, "data": { "resetCount": number } }
```
- Set `dailyUsed: 0`, `errorStreak: 0`, status `exhausted` → `active`
- Tulis ke `data/keys.json`

#### `POST /api/keys/test`
```
Auth  : Diperlukan
Body  : { "keyId": string }
200   : { "ok": true, "data": { "keyId": string, "latencyMs": number,
          "model": string } }
400   : { "ok": false, "error": string, "data": { "keyId": string } }
```
- Kirim prompt singkat ke Gemini dengan key tersebut, ukur latency

---

#### `GET /api/prompts`
```
Auth  : Diperlukan
200   : { "ok": true, "data": { "current": { writerSystem, writerUser,
          trendScout, breakingWriter, imagePrompt },
          "version": number, "updatedAt": ISO8601 } }
```
- Baca `src/config/prompts.js` via `require()` (invalidate require cache dulu)

#### `PUT /api/prompts`
```
Auth  : Diperlukan
Body  : { "prompts": { writerSystem?, writerUser?, trendScout?,
          breakingWriter?, imagePrompt? } }
200   : { "ok": true, "data": { "version": number, "savedAt": ISO8601 } }
400   : VALIDATION_ERROR jika prompt kosong atau > 50.000 karakter
```
- Simpan versi lama ke `data/prompt-versions/v{N}.json` (max 10 versi)
- Tulis `src/config/prompts.js` baru dengan module.exports = {...}
- Invalidate require cache untuk prompts.js

#### `GET /api/prompts/versions`
```
Auth  : Diperlukan
200   : { "ok": true, "data": [ { version, savedAt, sizeBytes } ] }
```

#### `POST /api/prompts/rollback`
```
Auth  : Diperlukan
Body  : { "version": number }
200   : { "ok": true, "data": { "restoredVersion": number } }
404   : NOT_FOUND jika versi tidak ada
```

---

#### `GET /api/logs/stream`
```
Auth  : Diperlukan (token via query param ?token=... karena SSE tidak bisa set header)
Headers Response: Content-Type: text/event-stream
                  Cache-Control: no-cache
                  Connection: keep-alive
Query  : level=debug|info|warn|error (default: info)
Stream : event: log
         data: { "ts": ISO8601, "level": string, "message": string }
```
- Tail file log hari ini menggunakan `fs.watch` + `readline`
- Kirim `event: connected\ndata: {...}\n\n` saat client konek
- Kirim heartbeat `event: ping\ndata: {}\n\n` setiap 30 detik
- Filter berdasarkan level: debug=semua, info=info+warn+error, dst

#### `GET /api/logs/dates`
```
Auth  : Diperlukan
200   : { "ok": true, "data": [ "2026-07-22", "2026-07-21", ... ] }
```
- List file di folder `logs/` yang match pola `agent-YYYY-MM-DD.log`

#### `GET /api/logs/download/:date`
```
Auth  : Diperlukan (token via query ?token=...)
Param : date = YYYY-MM-DD
200   : File download (Content-Disposition: attachment; filename="agent-DATE.log")
404   : NOT_FOUND jika file tidak ada
```

---

#### `POST /api/manual/generate`
```
Auth  : Diperlukan
Body  : {
  "category"   : string,          // wajib
  "subcategory": string?,         // opsional
  "topic"      : string?,         // opsional — kosong = auto dari trendScout
  "mode"       : "reguler"|"breaking",  // default: "reguler"
  "authorId"   : string?,         // opsional — default: auto dari kategori
  "publishMode": "publish"|"draft"      // default: "publish"
}
202   : { "ok": true, "data": { "jobId": string,
          "message": "Generate artikel dimulai di background" } }
400   : VALIDATION_ERROR
503   : { "ok": false, "error": "AGENT_BUSY",
          "message": "Agent sedang memproses artikel lain" }
```
- Tidak blocking — trigger via event emitter ke scheduler, return jobId
- Status job bisa dipantau via `GET /api/manual/job/:jobId`

#### `GET /api/manual/job/:jobId`
```
Auth  : Diperlukan
200   : { "ok": true, "data": { "jobId", "status": "pending"|"running"|
          "done"|"failed", "result"?: {...}, "error"?: string } }
404   : NOT_FOUND
```

---

#### `GET /api/settings`
```
Auth  : Diperlukan
200   : { "ok": true, "data": <full settings.json> }
```

#### `PUT /api/settings`
```
Auth  : Diperlukan
Body  : <partial settings — deep merge>
200   : { "ok": true, "data": <settings.json setelah update> }
400   : VALIDATION_ERROR
```
- Validasi: tidak boleh hapus key wajib (agent, scheduler, quality, gemini)
- Tulis ulang settings.json setelah merge
- Log perubahan ke Winston dengan diff before/after

---

### 10.10.4 Middleware Spec

#### `middleware/auth.js`

```
requireAuth(req, res, next):
  1. Cek header Authorization: Bearer <token>
     Jika tidak ada → cek cookie "access_token"
     Jika tidak ada → 401 UNAUTHORIZED
  2. jwt.verify(token, JWT_SECRET)
     Jika expired → 401 UNAUTHORIZED, body: { expiredAt }
     Jika invalid  → 401 UNAUTHORIZED
  3. Cek token tidak ada di blacklist in-memory
     Jika ada       → 401 UNAUTHORIZED
  4. req.user = decoded payload
  5. next()

tokenBlacklist:
  - Map<token, expMs>
  - Cleanup expired entries setiap 10 menit via setInterval
```

#### `middleware/rateLimit.js`

```
loginLimiter:
  windowMs : 15 * 60 * 1000   (15 menit)
  max      : 5
  keyBy    : IP
  message  : { ok: false, error: "RATE_LIMITED", retryAfter: 900 }
  skipSuccessfulRequests: false

apiLimiter:
  windowMs : 60 * 1000         (1 menit)
  max      : 120
  keyBy    : IP
  message  : { ok: false, error: "RATE_LIMITED" }
  skip     : req untuk SSE (/api/logs/stream)
```

---

### 10.10.5 Format File Data

#### `data/state.json`
```json
{
  "date"              : "YYYY-MM-DD",
  "articlesPublished" : 0,
  "articlesTarget"    : 30,
  "breakingPublished" : 0,
  "breakingTarget"    : 2,
  "lastPublishedAt"   : null,
  "nextScheduledAt"   : null,
  "agentStatus"       : "idle",
  "queueLength"       : 0,
  "errors24h"         : 0,
  "apiKeyActive"      : 0,
  "apiKeyTotal"       : 0,
  "startedAt"         : "ISO8601",
  "generationStats"   : {
    "totalAttempts"   : 0,
    "totalSuccess"    : 0,
    "avgGenerationMs" : 0
  }
}
```

#### `data/queue.json`
```json
{
  "items"      : [],
  "lastUpdated": "ISO8601"
}
```

#### `data/keys.json`
```json
{
  "keys"               : [],
  "lastRotationIndex"  : 0,
  "lastResetDate"      : "YYYY-MM-DD",
  "lastUpdated"        : "ISO8601"
}
```

#### `data/editorial-calendar.json`
```json
{
  "week"       : "",
  "generatedAt": null,
  "status"     : "empty",
  "plan"       : []
}
```

---

### 10.10.6 Sub-Bagian Build

| Sub | Scope | File | Status |
|---|---|---|---|
| **1A — Backend** | Express + middleware + semua route API | 14 file | 🔲 In Progress |
| **1B — Frontend** | Semua HTML + CSS + JS vanilla | 13 file | 🔲 Belum dimulai |

**Dependencies:** 1B bergantung pada 1A (route path harus match). Build 1A tuntas dulu.

---

## 11. SISTEM AUTHOR & PERSONA

### 11.1 Daftar Author

| ID | Nama | Jabatan | Spesialisasi |
|----|------|---------|--------------|
| A01 | Rizky Aditya Pratama | Reporter Senior | Berita Teknologi, Breaking News |
| A02 | Nadia Fitriani | Tech Journalist | AI & Machine Learning |
| A03 | Bagas Nugroho | Business Reporter | Startup, Venture Capital |
| A04 | Dinda Rahmawati | Software Correspondent | Dev, Open Source, Framework |
| A05 | Fajar Setiawan | Security Analyst | Cyber Security, Privacy |
| A06 | Citra Dewi Kusuma | Gadget Reviewer | Smartphone, Laptop, Wearable |
| A07 | Hendra Wijaksana | Crypto Journalist | Kripto, Blockchain, Web3 |
| A08 | Ayu Lestari Santoso | Future Tech Writer | IoT, Quantum, Space, AR/VR |
| A09 | Bima Arya Wicaksono | Tech Educator | Tutorial, How-to, Panduan |
| A10 | Sari Indah Permata | Columnist | Opini, Analisis, Tren Industri |

### 11.2 Mapping Author per Kategori

```json
{
  "Berita": "A01",
  "Artificial Intelligence": "A02",
  "Startup": "A03",
  "Software Development": "A04",
  "Cyber Security": "A05",
  "Gadget": "A06",
  "Kripto & Blockchain": "A07",
  "Teknologi Masa Depan": "A08",
  "Tutorial": "A09",
  "Opini": "A10",
  "Breaking News": "A01"
}
```

### 11.3 Author Profile di Strapi

Setiap author harus di-seed ke Strapi dengan:
- `name`: Nama lengkap
- `slug`: nama-author-url-friendly
- `bio`: Bio 2-3 kalimat yang natural
- `avatar`: Foto avatar yang di-generate (konsisten per author)
- `role`: Jabatan/title
- `expertise`: Array bidang keahlian

### 11.4 Avatar Generation

Prompt untuk generate avatar tiap author dengan Imagen 3:
```
Professional headshot of Indonesian [male/female] journalist,
age [25-35], [description], natural office background,
professional attire, warm smile, portrait photography,
photorealistic, 1:1 aspect ratio
```

Avatar disimpan di R2 dengan path: `authors/{slug}/avatar.webp`

---

## 12. MANAJEMEN API KEY GEMINI

### 12.1 Struktur Key Pool

```javascript
class GeminiPool {
  constructor(keys) {
    this.keys = keys.map((key, i) => ({
      id: `key_${String(i+1).padStart(2,'0')}`,
      key,
      status: 'active',    // active|cooldown|exhausted|disabled
      dailyUsed: 0,
      dailyLimit: 1500,    // Free tier limit
      errorStreak: 0,
      cooldownUntil: null,
      disabledUntil: null,
      lastUsed: null,
      totalSuccess: 0,
      totalError: 0
    }));
    this.currentIndex = 0;
  }

  getNextKey() {
    // Round-robin dengan skip logic
    let attempts = 0;
    while (attempts < this.keys.length) {
      const key = this.keys[this.currentIndex % this.keys.length];
      this.currentIndex++;
      attempts++;
      
      if (key.status === 'disabled') continue;
      if (key.status === 'exhausted') continue;
      if (key.cooldownUntil && Date.now() < key.cooldownUntil) continue;
      if (key.dailyUsed >= key.dailyLimit) {
        key.status = 'exhausted';
        continue;
      }
      
      return key;
    }
    
    throw new Error('ALL_KEYS_UNAVAILABLE');
  }
}
```

### 12.2 Rate Limit Handling

```
Error 429 (Rate Limited):
  → Cooldown key 60 detik
  → Retry dengan key berbeda (immediate)
  
Error 503 (Service Unavailable):
  → Retry dengan key sama setelah 10 detik
  → Max 3 retry, lalu pindah ke key lain
  
Error 400 (Bad Request):
  → Catat error, jangan retry
  → Log prompt yang menyebabkan error
  
Error streak >= 5 pada satu key:
  → Disable key selama 30 menit
  → Alert Telegram
```

### 12.3 Daily Reset

Setiap jam 00.00 WIB:
```javascript
pool.keys.forEach(key => {
  key.dailyUsed = 0;
  key.errorStreak = 0;
  if (key.status === 'exhausted') key.status = 'active';
});
```

---

## 13. STANDAR KONTEN & ADSENSE COMPLIANCE

### 13.1 Standar Jurnalisme Indonesia

**PUEBI (Pedoman Umum Ejaan Bahasa Indonesia):**
- Penulisan kata baku sesuai KBBI
- Penggunaan huruf kapital yang benar
- Tanda baca sesuai aturan
- Penulisan bilangan dan satuan
- Penulisan kata serapan yang benar

**Struktur Piramida Terbalik (Wajib):**
```
Lead/Teras     ← WHO, WHAT, WHEN, WHERE, WHY, HOW (1-2 paragraf)
     │
Body           ← Detail, fakta pendukung, kutipan (3-4 paragraf)
     │
Konteks        ← Background, dampak Indonesia (1-2 paragraf)
     │
Penutup        ← Outlook, apa yang perlu dipantau (1 paragraf)
     │
Atribusi       ← Sumber artikel yang dikutip
```

**Kata-kata yang Wajib Dihindari:**
```javascript
const forbiddenPatterns = [
  /sebagai kesimpulan/gi,      // Ciri khas AI
  /secara keseluruhan/gi,       // Terlalu generik
  /sangat menarik/gi,           // Tanpa dasar
  /patut dicatat bahwa/gi,      // AI writing pattern
  /dalam era modern ini/gi,     // Klise
  /tidak dapat dipungkiri/gi,   // Klise
  /hal ini menunjukkan/gi,      // Terlalu formal/AI
];
```

### 13.2 Google AdSense Compliance Checklist

**Sebelum Publish (per Artikel):**
- [ ] Panjang artikel minimal 500 kata
- [ ] Ada minimal 1 gambar cover yang relevan
- [ ] Judul faktual, tidak clickbait
- [ ] Ada atribusi sumber yang jelas
- [ ] Tidak ada kata-kata blacklist (SARA, pornografi, kekerasan)
- [ ] Keyword density max 3%
- [ ] Ada H2/H3 heading di dalam artikel
- [ ] Meta description terisi (max 155 karakter)
- [ ] URL/slug yang deskriptif

**Mingguan (per Domain):**
- [ ] Tidak ada artikel duplikat
- [ ] Tidak ada periode tanpa konten > 2 hari
- [ ] Traffic tidak spike tiba-tiba dari sumber tidak natural

### 13.3 Atribusi Sumber

**Format Standar:**
```
Dalam badan artikel:
"Menurut laporan TechCrunch yang terbit Selasa (22/7), ..."
"Berdasarkan data yang dirilis Google pada Senin lalu, ..."

Di akhir artikel (sebelum penutup):
"---
*Artikel ini dikembangkan berdasarkan laporan [Nama Media], [tanggal].*"
```

**Sumber yang Diizinkan untuk Dikutip:**
- Media terpercaya: TechCrunch, The Verge, Reuters, BBC, Wired, MIT Tech Review
- Rilis resmi perusahaan (press release)
- Data dari lembaga riset (Gartner, IDC, Statista)

**Sumber yang TIDAK Diizinkan:**
- Blog pribadi tanpa kredibilitas
- Media tabloid/gossip
- Sumber anonim tanpa verifikasi

---

## 14. KEAMANAN & RELIABILITAS

### 14.1 Keamanan Dashboard

**Authentication:**
```javascript
// Login flow
1. POST /api/auth/login { username, password }
2. Verify password dengan bcrypt.compare()
3. Generate accessToken (2 jam) + refreshToken (30 hari)
4. Set refreshToken sebagai httpOnly cookie (tidak bisa diakses JS)
5. Return accessToken di response body

// Protected routes
Semua API kecuali /api/auth/* → wajib header: Authorization: Bearer <token>
Middleware verifikasi: jwt.verify(token, JWT_SECRET)

// Refresh token
POST /api/auth/refresh → gunakan cookie refreshToken → issue accessToken baru

// Logout
DELETE /api/auth/logout → invalidate refreshToken (simpan di blacklist)
```

**Rate Limiting:**
- Login endpoint: max 5 request / 15 menit per IP
- API endpoints: max 100 request / menit per user
- Manual trigger: max 3 request / jam

**Security Headers:**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  },
  hsts: { maxAge: 31536000 },
}));
```

### 14.2 Keamanan Agent

**Prinsip Least Privilege:**
- Strapi API token hanya punya permission create + read (tidak bisa delete)
- R2 bucket: agent hanya bisa upload, tidak bisa delete atau list objects lama
- Gemini key: tidak disimpan di code, hanya di `.env`

**Credential Management:**
- Semua secret di `.env` (tidak di-commit ke GitHub)
- `.gitignore` wajib include: `.env`, `data/`, `logs/`
- Rotate Gemini keys secara berkala (setiap 3 bulan)

### 14.3 Reliabilitas & Self-Healing

**PM2 Auto-restart:**
```javascript
// ecosystem.config.js
max_restarts: 10,        // Max restart dalam 1 jam
min_uptime: "30s",       // Dianggap crash jika mati < 30 detik
restart_delay: 5000,     // Tunggu 5 detik sebelum restart
```

**Circuit Breaker Pattern:**
```
Strapi API error 3× berturut → Pause publishing 10 menit
Semua Gemini key rate limited → Pause agent, tunggu cooldown tercepat
R2 upload gagal 3× → Skip gambar, publish tanpa cover + alert
ISR revalidation gagal → Log warning, lanjut (tidak critical)
```

**Watchdog:**
```javascript
// Cron setiap 30 menit: periksa apakah agent masih berjalan
// Jika tidak ada artikel published dalam 2 jam padahal jam aktif:
//   → Kirim alert Telegram critical
//   → Coba restart PM2 process
//   → Jika masih gagal → kirim alert "manual intervention required"
```

### 14.4 Backup & Recovery

**Data yang di-backup harian:**
- `data/published.db` → backup ke R2: `backups/db/YYYY-MM-DD.db`
- `data/state.json` → backup ke R2: `backups/state/YYYY-MM-DD.json`
- `src/config/` → backup ke R2: `backups/config/YYYY-MM-DD.tar.gz`

**Recovery Procedure:**
```bash
# Jika agent crash total:
pm2 restart all

# Jika database corrupt:
cp backups/db/YYYY-MM-DD.db data/published.db
pm2 restart joben-agent-scheduler

# Jika config rusak:
tar xzf backups/config/YYYY-MM-DD.tar.gz -C src/
pm2 restart all
```

---

## 15. DEPLOYMENT & INFRASTRUKTUR CPANEL

### 15.1 Struktur Domain di cPanel

| Domain | Path di cPanel | Service | Port |
|--------|----------------|---------|------|
| `news.jobenapp.cloud` | `public_html/news/` | Next.js (PM2) | 5000 |
| `cms.news.jobenapp.cloud` | *(subdomain lain)* | Strapi (PM2) | 3001 |
| `ai.jobenapp.cloud` | *(subdomain lain)* | Agent Dashboard | 4000 |

**Catatan:** Agent core (`joben-agent/`) berada di luar `public_html/` untuk keamanan — tidak bisa diakses langsung via browser.

### 15.2 Setup cPanel Node.js App

```bash
# Di cPanel → Setup Node.js App:
App root: /home/user/joben-agent
Startup file: src/dashboard/server.js
Node version: 24.x
App URL: ai.jobenapp.cloud

# Install dependencies:
cd /home/user/joben-agent
npm install --production

# Setup .env:
cp .env.example .env
nano .env  # Isi semua values

# Inisialisasi pertama:
node scripts/setup.js
node scripts/seedAuthors.js

# Start dengan PM2:
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Agar auto-start setelah server reboot
```

### 15.3 GitHub Actions Workflow

```yaml
# .github/workflows/deploy-agent.yml
name: Deploy AI Agent to cPanel

on:
  push:
    branches: [main]
    paths: ['joben-agent/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.CPANEL_HOST }}
          username: ${{ secrets.CPANEL_USER }}
          key: ${{ secrets.CPANEL_SSH_KEY }}
          script: |
            cd ~/joben-agent
            git pull origin main
            npm install --production
            pm2 restart all --update-env
```

### 15.4 cPanel Reverse Proxy Config

**Untuk `ai.jobenapp.cloud` → port 4000:**
Di cPanel → Apache Directives (atau via `.htaccess`):
```apache
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:4000/$1 [P,L]
```

Atau gunakan cPanel's built-in "Application Manager" untuk proxy ke port 4000.

---

## 16. METRIK KEBERHASILAN

### 16.1 Metrik Operasional (Fase 1)

| Metrik | Target | Cara Ukur |
|--------|--------|-----------|
| Artikel published/hari | 30 ± 3 | `state.json` |
| Breaking news/hari | Min 2 | `state.json` |
| Success rate publish | > 90% | `published.db` |
| Average generation time | < 90 detik | `published.db` |
| Agent uptime | > 99% | PM2 logs |
| Quality gate pass rate | > 85% | logs |
| API key utilization | < 70% daily quota | `keys.json` |

### 16.2 Metrik Konten (Fase 1-2)

| Metrik | Target 1 Bulan | Target 3 Bulan |
|--------|----------------|----------------|
| Total artikel | 900 | 2.700 |
| Kategori tercover/minggu | 8-10 dari 10 | 10/10 |
| Avg word count | 550+ | 600+ |
| Avg quality score | 70+ | 75+ |

### 16.3 Metrik SEO & Traffic (Fase 2-3)

| Metrik | Target 3 Bulan | Target 6 Bulan |
|--------|----------------|----------------|
| Organic pageview/bulan | 5.000 | 25.000 |
| Artikel terindex Google | 80% | 90% |
| Artikel di halaman 1 Google | 5% | 15% |
| Domain Rating (Ahrefs) | 10+ | 20+ |
| Avg CTR Search Console | 2%+ | 4%+ |

### 16.4 Metrik Bisnis (Fase 3+)

| Metrik | Target |
|--------|--------|
| Google AdSense approval | Setelah 3 bulan konten |
| AdSense revenue/bulan | Rp 1-5 juta (6 bulan) |
| Email subscriber | 500 (6 bulan) |
| Telegram channel member | 1.000 (6 bulan) |

---

## 17. ROADMAP & TIMELINE

```
JULI 2026 — Fase 1 Build (2 minggu)
├── Minggu 1: Core agent + key pool + RSS + writer + quality gate
├── Minggu 2: Image gen + publisher + scheduler + dashboard basic
└── Go-live: Agent berjalan, 30 artikel/hari

AGUSTUS 2026 — Fase 1 Stabilisasi + Fase 2 Mulai
├── Minggu 1-2: Monitor, fix bug, tuning prompt
├── Minggu 3: GA4 feedback loop + competitive intel
└── Minggu 4: Editorial calendar + article updater

SEPTEMBER 2026 — Fase 2 Complete + Fase 3 Mulai
├── Search Console integration + SEO intelligence
├── Apply AdSense (setelah 60 hari konten)
└── Multi-level review system

OKTOBER-NOVEMBER 2026 — Fase 3 Complete
├── Telegram channel distribution
├── AdSense approval (diharapkan)
└── Quality learning system

DESEMBER 2026 - JANUARI 2027 — Fase 4
├── Newsletter engine
├── Podcast script generator
└── Social media captions

FEBRUARI - JULI 2027 — Fase 5
└── Specialized agents + full newsroom features
```

---

## 18. RISIKO & MITIGASI

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Google AdSense reject (konten AI) | Sedang | Tinggi | Quality gate ketat, gaya bahasa natural, atribusi jelas |
| Gemini API berubah pricing/limit | Rendah | Tinggi | Plugin architecture → mudah ganti ke OpenAI/Anthropic |
| cPanel server downtime | Rendah | Tinggi | PM2 auto-restart, backup ke R2, monitoring alert |
| Hallucination Gemini (fakta salah) | Sedang | Tinggi | Search Grounding wajib, fact-check otomatis dengan regex |
| Konten sensitif/SARA tersebar | Rendah | Sangat Tinggi | Blacklist ketat, human review untuk kategori sensitif |
| Rate limit semua API key habis | Rendah | Sedang | Alert Telegram, queue tidak hilang, resume otomatis |
| Strapi down saat publish | Rendah | Sedang | Queue persistent, retry otomatis, artikel tidak hilang |
| R2 storage penuh | Sangat Rendah | Rendah | Monitor usage, compress gambar, free tier sangat besar |
| Duplikat konten terdeteksi Google | Sedang | Tinggi | Anti-duplikat 72 jam, diversifikasi sudut pandang |
| Competitor block crawling | Sedang | Rendah | Multiple sources, tidak terlalu bergantung 1 sumber |

---

## 19. GLOSARIUM

| Istilah | Definisi |
|---------|----------|
| **Agent** | Program AI otonom yang menjalankan tugas tertentu |
| **Breaking News** | Berita mendesak yang butuh dipublish dalam < 15 menit setelah kejadian |
| **ISR** | Incremental Static Regeneration — fitur Next.js untuk refresh halaman tanpa rebuild |
| **Piramida Terbalik** | Struktur penulisan berita: info paling penting di awal |
| **PUEBI** | Pedoman Umum Ejaan Bahasa Indonesia — standar tata bahasa resmi |
| **Quality Gate** | Proses validasi otomatis sebelum artikel dipublish |
| **Search Grounding** | Kemampuan Gemini mengakses internet real-time untuk data terkini |
| **RPM** | Revenue per Mille — pendapatan iklan per 1.000 pageview |
| **Key Pool** | Kumpulan API key yang dirotasi untuk menghindari rate limit |
| **SSE** | Server-Sent Events — teknologi push notifikasi dari server ke browser |
| **Orphan Article** | Artikel yang tidak punya satupun internal link dari artikel lain |
| **Editorial Calendar** | Rencana topik artikel yang dijadwalkan untuk periode tertentu |
| **Topic Gap** | Topik yang ditulis kompetitor tapi belum ada di Joben News |
| **Kill Switch** | Tombol darurat untuk menghentikan semua aktivitas agent seketika |
| **Cooldown** | Periode istirahat paksa untuk API key yang kena rate limit |

---

*Dokumen ini adalah living document — akan diperbarui seiring perkembangan sistem.*

**Versi History:**
| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| 1.0 | Juli 2026 | Draft awal — semua fase |

---

*JOBEN NEWS AI Agent System — PRD v1.0*  
*Confidential — Internal Use Only*
