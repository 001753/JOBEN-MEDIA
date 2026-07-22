'use strict';

/**
 * Setup Script — Inisialisasi JOBEN Agent pertama kali
 * Jalankan: node scripts/setup.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logger = require('../src/utils/logger');

const DIRS_TO_CREATE = [
  path.join(__dirname, '../data'),
  path.join(__dirname, '../logs'),
  path.join(__dirname, '../src/config'),
];

const DATA_FILES = {
  'data/state.json': {
    date: new Date().toISOString().split('T')[0],
    articlesPublished: 0,
    articlesTarget: 30,
    breakingPublished: 0,
    lastPublishedAt: null,
    nextScheduledAt: null,
    agentStatus: 'idle',
    queueLength: 0,
    errors24h: 0,
    apiKeyActive: 0,
    apiKeyTotal: 0,
    totalPublishedEver: 0,
    startedAt: null,
  },
  'data/queue.json': { queue: [], lastModified: null },
  'data/keys.json': { keys: [], lastRotationIndex: 0, savedAt: null },
};

async function main() {
  console.log('\n🤖 JOBEN NEWS AI AGENT — Setup\n');
  console.log('='.repeat(50));

  // 1. Buat direktori
  console.log('\n📁 Membuat direktori...');
  for (const dir of DIRS_TO_CREATE) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('  ✅ Created:', path.relative(path.join(__dirname, '..'), dir));
    } else {
      console.log('  ✓  Exists:', path.relative(path.join(__dirname, '..'), dir));
    }
  }

  // 2. Inisialisasi data files
  console.log('\n📄 Inisialisasi data files...');
  const rootDir = path.join(__dirname, '..');
  for (const [filePath, defaultData] of Object.entries(DATA_FILES)) {
    const fullPath = path.join(rootDir, filePath);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, JSON.stringify(defaultData, null, 2));
      console.log('  ✅ Created:', filePath);
    } else {
      console.log('  ✓  Exists:', filePath);
    }
  }

  // 3. Cek .env
  console.log('\n🔑 Cek environment variables...');
  const envFile = path.join(rootDir, '.env');
  if (!fs.existsSync(envFile)) {
    console.log('  ⚠️  File .env belum ada!');
    console.log('  → Salin .env.example ke .env dan isi semua nilai');
  } else {
    console.log('  ✓  .env ditemukan');
  }

  // 4. Validasi key environment
  const REQUIRED_ENVS = [
    'STRAPI_API_URL',
    'STRAPI_API_TOKEN',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ADMIN_CHAT_ID',
    'DASHBOARD_JWT_SECRET',
  ];

  const GEMINI_KEYS = Array.from({ length: 15 }, (_, i) =>
    `GEMINI_KEY_${String(i + 1).padStart(2, '0')}`
  );

  console.log('\n  Required env vars:');
  let missingCount = 0;
  for (const key of REQUIRED_ENVS) {
    if (process.env[key]) {
      console.log(`  ✅ ${key}`);
    } else {
      console.log(`  ❌ ${key} — BELUM DIISI`);
      missingCount++;
    }
  }

  const geminiCount = GEMINI_KEYS.filter(k => process.env[k]).length;
  if (geminiCount > 0) {
    console.log(`  ✅ GEMINI_KEY_* — ${geminiCount} key ditemukan`);
  } else {
    console.log('  ❌ GEMINI_KEY_* — tidak ada key Gemini!');
    missingCount++;
  }

  // 5. Test koneksi (opsional)
  if (missingCount === 0) {
    console.log('\n🔌 Test koneksi...');

    // Test Telegram
    try {
      const { getInstance: getTelegram } = require('../src/services/telegramNotifier');
      const telegram = getTelegram();
      const botInfo = await telegram.verify();
      if (botInfo.ok) {
        console.log(`  ✅ Telegram Bot: @${botInfo.username}`);
      } else {
        console.log('  ❌ Telegram Bot: token tidak valid');
      }
    } catch (e) {
      console.log('  ⚠️  Telegram:', e.message);
    }

    // Test R2
    try {
      const { getInstance: getR2 } = require('../src/services/r2Client');
      const r2 = getR2();
      const r2Ok = await r2.testConnection();
      console.log(r2Ok ? '  ✅ Cloudflare R2: terhubung' : '  ❌ Cloudflare R2: gagal');
    } catch (e) {
      console.log('  ⚠️  R2:', e.message);
    }

    // Test Strapi
    try {
      const { getInstance: getStrapi } = require('../src/services/strapiClient');
      const strapi = getStrapi();
      await strapi.getAllAuthors();
      console.log('  ✅ Strapi API: terhubung');
    } catch (e) {
      console.log('  ⚠️  Strapi:', e.message);
    }
  } else {
    console.log(`\n⚠️  ${missingCount} environment variable belum diisi.`);
    console.log('   Setup koneksi akan dilewati.');
  }

  // 6. SQLite database
  console.log('\n🗄️  Inisialisasi database SQLite...');
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(rootDir, 'data/published.db');
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        strapi_id       TEXT UNIQUE,
        strapi_doc_id   TEXT,
        title           TEXT NOT NULL,
        slug            TEXT UNIQUE NOT NULL,
        category        TEXT NOT NULL,
        subcategory     TEXT,
        author_name     TEXT,
        source_url      TEXT,
        source_name     TEXT,
        word_count      INTEGER,
        quality_score   REAL,
        published_at    DATETIME,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        status          TEXT DEFAULT 'published',
        error_msg       TEXT,
        gemini_key_used TEXT,
        generation_ms   INTEGER
      );

      CREATE TABLE IF NOT EXISTS topics_used (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_hash  TEXT UNIQUE,
        topic_title TEXT,
        used_at     DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_key_usage (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id      TEXT,
        used_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        success     BOOLEAN,
        error_code  TEXT,
        latency_ms  INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
      CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
      CREATE INDEX IF NOT EXISTS idx_topics_used_hash ON topics_used(topic_hash);
      CREATE INDEX IF NOT EXISTS idx_key_usage_key_id ON api_key_usage(key_id);
    `);

    db.close();
    console.log('  ✅ SQLite database siap: data/published.db');
  } catch (e) {
    console.log('  ❌ SQLite error:', e.message);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (missingCount === 0) {
    console.log('✅ Setup selesai! Agent siap dijalankan.');
    console.log('\nLangkah berikutnya:');
    console.log('  1. node scripts/seedAuthors.js  — Seed 10 author ke Strapi');
    console.log('  2. node scripts/testWriter.js   — Test generate 1 artikel');
    console.log('  3. pm2 start ecosystem.config.js — Jalankan agent production');
  } else {
    console.log(`⚠️  Setup selesai dengan ${missingCount} item perlu dilengkapi.`);
    console.log('\nPerbaiki dulu:');
    console.log('  1. Edit file .env dan isi semua nilai yang kosong');
    console.log('  2. Jalankan setup lagi: node scripts/setup.js');
  }
  console.log('');
}

main().catch(e => {
  console.error('\n❌ Setup gagal:', e.message);
  process.exit(1);
});
