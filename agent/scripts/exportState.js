'use strict';

/**
 * exportState.js — Export state + DB ke JSON untuk backup / debug
 *
 * Usage:
 *   node scripts/exportState.js
 *   node scripts/exportState.js --output ./backup-2026-07-23.json
 *   node scripts/exportState.js --limit 100   (max artikel di export, default 200)
 *
 * Output: JSON file berisi snapshot lengkap state sistem saat ini
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');

// ─── Paths ────────────────────────────────────────────────
const DATA_DIR         = path.join(__dirname, '../data');
const STATE_FILE       = path.join(DATA_DIR, 'state.json');
const QUEUE_FILE       = path.join(DATA_DIR, 'queue.json');
const KEYS_FILE        = path.join(DATA_DIR, 'keys.json');
const CALENDAR_FILE    = path.join(DATA_DIR, 'editorial-calendar.json');
const PUBLISHED_DB     = path.join(DATA_DIR, 'published.db');
const SETTINGS_FILE    = path.join(__dirname, '../src/config/settings.json');

// ─── Args ─────────────────────────────────────────────────
function getArg(name, defaultVal) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : defaultVal;
}

const outputFile = getArg('--output', null);
const limit      = parseInt(getArg('--limit', '200'), 10);

// ─── Helper ───────────────────────────────────────────────
function safeRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { _error: err.message };
  }
}

/**
 * Mask semua field "key" di array keys (nilai API key tidak boleh di-export plain)
 */
function maskKeys(keysData) {
  if (!keysData || !Array.isArray(keysData.keys)) return keysData;
  return {
    ...keysData,
    keys: keysData.keys.map(k => ({
      ...k,
      key: k.key ? k.key.slice(0, 8) + '****' : null,
    })),
  };
}

function readDatabase(dbPath, articleLimit) {
  if (!fs.existsSync(dbPath)) return { available: false };

  try {
    const db = new Database(dbPath, { readonly: true });

    const articles = db.prepare(
      `SELECT id, title, slug, category, subcategory, author_name,
              word_count, quality_score, published_at, created_at,
              status, error_msg, generation_ms
       FROM articles
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(articleLimit);

    const totalArticles = db.prepare('SELECT COUNT(*) as cnt FROM articles').get().cnt;

    const topicsUsed = db.prepare(
      `SELECT topic_title, used_at FROM topics_used ORDER BY used_at DESC LIMIT 50`
    ).all();

    const keyUsageSummary = db.prepare(
      `SELECT key_id,
              COUNT(*) as total_calls,
              SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
              AVG(latency_ms) as avg_latency_ms
       FROM api_key_usage
       GROUP BY key_id`
    ).all();

    db.close();

    return {
      available      : true,
      totalArticles,
      exportedArticles: articles.length,
      articles,
      topicsUsed,
      keyUsageSummary,
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────
function main() {
  console.log('\n========================================');
  console.log('  JOBEN NEWS — Export State & Database');
  console.log('========================================\n');

  const exportedAt = new Date().toISOString();
  const today      = exportedAt.slice(0, 10);

  // Kumpulkan semua data
  console.log('📂 Membaca state.json...');
  const state = safeRead(STATE_FILE);

  console.log('📋 Membaca queue.json...');
  const queue = safeRead(QUEUE_FILE);

  console.log('🔑 Membaca keys.json (nilai di-mask)...');
  const keys = maskKeys(safeRead(KEYS_FILE));

  console.log('📅 Membaca editorial-calendar.json...');
  const calendar = safeRead(CALENDAR_FILE);

  console.log('⚙️  Membaca settings.json...');
  const settings = safeRead(SETTINGS_FILE);

  console.log(`🗄️  Membaca published.db (max ${limit} artikel terbaru)...`);
  const database = readDatabase(PUBLISHED_DB, limit);

  // Build export object
  const exportData = {
    _meta: {
      exportedAt,
      exportedBy : 'exportState.js',
      nodeVersion: process.version,
      version    : '1.0',
    },
    state,
    queue,
    keys,
    editorialCalendar: calendar,
    settings,
    database,
  };

  // Tentukan output path
  const defaultOutput = path.join(DATA_DIR, `export-${today}.json`);
  const finalOutput   = outputFile || defaultOutput;

  // Tulis file
  console.log(`\n💾 Menyimpan export ke: ${finalOutput}`);
  fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
  fs.writeFileSync(finalOutput, JSON.stringify(exportData, null, 2), 'utf8');

  const sizeKB = (fs.statSync(finalOutput).size / 1024).toFixed(1);
  console.log(`✅ Export selesai!`);
  console.log(`   File   : ${finalOutput}`);
  console.log(`   Ukuran : ${sizeKB} KB`);
  console.log(`   Artikel: ${database.exportedArticles || 0} / ${database.totalArticles || 0} total`);
  console.log(`   Queue  : ${(queue?.items || []).length} item\n`);
}

main();
