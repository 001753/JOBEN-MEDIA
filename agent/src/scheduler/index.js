'use strict';

/**
 * Scheduler Main — Loop utama agent produksi artikel
 *
 * State Machine:
 * IDLE → TREND_SCOUTING → WRITING → QUALITY_CHECK → IMAGE_GENERATING → PUBLISHING → NOTIFYING → IDLE
 *
 * Cron Jobs:
 * - every 1 min     → Main scheduler tick
 * - 0 0 * * *       → Reset daily counter
 * - 0 every1h * * * → API key health check
 * - 0 4 * * *       → Daily cleanup
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const logger = require('../utils/logger');
const settings = require('../config/settings.json');
const { todayWIB } = require('../utils/dateHelper');

// Services (singletons)
const { getInstance: getGeminiPool } = require('../services/geminiPool');
const { getInstance: getStrapiClient } = require('../services/strapiClient');
const { getInstance: getR2Client } = require('../services/r2Client');
const rssReaderFactory = require('../services/rssReader');
const telegramFactory = require('../services/telegramNotifier');

// Agents
const TrendScoutAgent = require('../agents/trendScout');
const WriterAgent = require('../agents/writer');
const QualityGate = require('../agents/qualityGate');
const ImageGenAgent = require('../agents/imageGen');
const InternalLinkerAgent = require('../agents/internalLinker');
const PublisherAgent = require('../agents/publisher');

// Scheduler
const ArticleQueue = require('./queue');
const TimeManager = require('./timeManager');

const STATE_FILE = path.join(__dirname, '../../data/state.json');
const DB_FILE = path.join(__dirname, '../../data/published.db');

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

let db;
let queue;
let timeManager;
let geminiPool;
let strapiClient;
let r2Client;
let rssReader;
let telegram;
let trendScout;
let writer;
let qualityGate;
let imageGen;
let internalLinker;
let publisher;
let isProcessing = false;
let lastWatchdogCheck = Date.now();

function initServices() {
  logger.info('[scheduler] Inisialisasi services...');

  // Database
  const dbDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  _initDatabase(db);

  // Singleton services
  geminiPool = getGeminiPool();
  strapiClient = getStrapiClient();
  r2Client = getR2Client();

  // RSS reader (singleton — baca sources.json sendiri)
  rssReader = rssReaderFactory.getInstance();

  // Telegram
  telegram = new telegramFactory.TelegramNotifier();

  // Inject dependencies ke geminiPool
  geminiPool.setTelegramNotifier(telegram);
  geminiPool.setDatabase(db);

  // Scheduler
  queue = new ArticleQueue();
  timeManager = new TimeManager(settings);

  // Agents
  trendScout = new TrendScoutAgent({ geminiPool, rssReader, db, settings });
  writer = new WriterAgent({ geminiPool, settings });
  qualityGate = new QualityGate({ geminiPool, settings });
  imageGen = new ImageGenAgent({ geminiPool, r2Client, settings });
  internalLinker = new InternalLinkerAgent({ geminiPool, strapiClient, settings });
  publisher = new PublisherAgent({ strapiClient, telegramNotifier: telegram, db, timeManager, settings });

  logger.info('[scheduler] Semua services siap');
}

function _initDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
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
      status        TEXT DEFAULT 'published',
      error_msg     TEXT,
      gemini_key_used TEXT,
      generation_ms INTEGER
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
  `);
}

// ─────────────────────────────────────────────────────────────
// STATE HELPERS
// ─────────────────────────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (state.date === todayWIB()) return state;
    }
  } catch {}
  return freshState();
}

function freshState() {
  return {
    date: todayWIB(),
    articlesPublished: 0,
    articlesTarget: settings.agent.dailyTarget,
    breakingPublished: 0,
    lastPublishedAt: null,
    nextScheduledAt: null,
    agentStatus: 'running',
    queueLength: 0,
    errors24h: 0,
    apiKeyActive: 0,
    apiKeyTotal: geminiPool?.keys?.length || 0,
  };
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    logger.warn('[scheduler] Gagal simpan state', { error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────

/**
 * Pipeline lengkap: Trend → Write → Quality → Image → Publish
 * @param {Object} options
 */
async function runPipeline({ topicData = null, contentType = 'reguler', forcedCategory = null } = {}) {
  const state = loadState();

  // Cek kill switch
  if (state.agentStatus === 'killed') {
    logger.warn('[scheduler] Agent dihentikan via kill switch');
    return;
  }

  logger.agent(`[scheduler] Memulai pipeline (published hari ini: ${state.articlesPublished}/${state.articlesTarget})`);

  // ── Step 1: Trend Scout ──
  let selectedTopic = topicData;
  if (!selectedTopic) {
    try {
      selectedTopic = await trendScout.run({ breakingOnly: contentType === 'breaking', forcedCategory });
      if (!selectedTopic) {
        logger.warn('[scheduler] TrendScout tidak menemukan topik yang layak, skip siklus ini');
        return;
      }
    } catch (err) {
      logger.error('[scheduler] TrendScout error', { error: err.message });
      _incrementErrors(state);
      return;
    }
  }

  // ── Step 2: Writer ──
  let draft;
  try {
    draft = await writer.run(selectedTopic, contentType);
  } catch (err) {
    logger.error('[scheduler] Writer error', { error: err.message });
    _incrementErrors(state);
    return;
  }

  // ── Step 3: Quality Gate ──
  let qualityResult;
  let recentArticles = [];
  try {
    recentArticles = await strapiClient.getArticlesLast72Hours();
  } catch {}

  let passedQuality = false;
  let finalDraft = draft;

  for (let attempt = 1; attempt <= (settings.quality.maxRetries || 3); attempt++) {
    try {
      qualityResult = await qualityGate.run(finalDraft, recentArticles);

      if (qualityResult.passed) {
        passedQuality = true;
        finalDraft = qualityResult.article; // Artikel dengan auto-fix
        break;
      }

      logger.warn(`[scheduler] Quality Gate gagal (attempt ${attempt}): ${qualityResult.feedback}`);

      if (attempt < (settings.quality.maxRetries || 3)) {
        finalDraft = await writer.regenerateWithFeedback(finalDraft, qualityResult.feedback);
      }

    } catch (err) {
      if (err.code === 'BLACKLIST_HIT') {
        logger.warn('[scheduler] Artikel mengandung kata blacklist — SKIP topik ini', { hits: err.hits });
        await telegram?.sendWarning(`❌ Topik ditolak (blacklist): "${selectedTopic.topic}"`).catch(() => {});
        return;
      }
      if (err.code === 'DUPLICATE_DETECTED') {
        logger.warn('[scheduler] Artikel duplikat terdeteksi — SKIP', { overlap: err.overlapPercent });
        return;
      }
      logger.error('[scheduler] Quality Gate error', { error: err.message });
      _incrementErrors(state);
      return;
    }
  }

  if (!passedQuality) {
    logger.warn(`[scheduler] Artikel gagal Quality Gate setelah ${settings.quality.maxRetries} percobaan — SKIP`);
    await telegram?.sendWarning(`❌ Artikel gagal quality gate: "${finalDraft.title}"\n${qualityResult?.feedback || ''}`).catch(() => {});
    _recordFailed(finalDraft, 'quality_gate_fail');
    return;
  }

  finalDraft._qualityScore = qualityResult.score;

  // ── Step 4: Internal Linker ──
  try {
    finalDraft = await internalLinker.run(finalDraft);
  } catch (err) {
    logger.warn('[scheduler] Internal Linker error (lanjut)', { error: err.message });
  }

  // ── Step 5: Image Generator ──
  let imageResult = null;
  try {
    imageResult = await imageGen.run(finalDraft);
  } catch (err) {
    logger.warn('[scheduler] ImageGen error (lanjut tanpa cover)', { error: err.message });
    await telegram?.sendWarning(`⚠️ Gagal generate cover image: "${finalDraft.title}"`).catch(() => {});
  }

  // ── Step 6: Publisher ──
  try {
    const published = await publisher.run(finalDraft, imageResult);

    // Catat topik sebagai sudah dipakai
    await trendScout.recordTopicUsed(selectedTopic.topic);

    timeManager.recordPublish();

    logger.agent(`[scheduler] ✅ Pipeline selesai: "${published.title}"`, {
      url: published.url,
      score: finalDraft._qualityScore,
    });

  } catch (err) {
    logger.error('[scheduler] Publisher error', { error: err.message });
    _incrementErrors(state);
    await telegram?.notifyError(`⚠️ Gagal publish: "${finalDraft.title}"`, { detail: err.message }).catch(() => {});
  }
}

function _incrementErrors(state) {
  state.errors24h = (state.errors24h || 0) + 1;
  saveState(state);
}

function _recordFailed(draft, reason) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT OR IGNORE INTO articles (title, slug, category, status, error_msg, created_at)
      VALUES (?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)
    `).run(
      draft.title || 'Unknown',
      draft.slug || `failed-${Date.now()}`,
      draft.category || '',
      reason
    );
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// MAIN TICK — dipanggil setiap menit oleh cron
// ─────────────────────────────────────────────────────────────

async function mainTick() {
  if (isProcessing) return; // Prevent overlap

  const state = loadState();

  if (state.agentStatus === 'killed') return;
  if (!settings.agent.enabled) return;

  // Update queue length di state
  state.queueLength = queue.length;

  // Proses item dari queue jika ada (manual / pre-queued)
  if (!queue.isEmpty) {
    const qItem = queue.shift();
    if (qItem) {
      isProcessing = true;
      try {
        await runPipeline({
          topicData: qItem.topicData.topic ? qItem.topicData : null,
          contentType: qItem.contentType,
          forcedCategory: qItem.forcedCategory,
        });
      } finally {
        isProcessing = false;
      }
      return;
    }
  }

  // Cek jadwal otomatis
  if (timeManager.shouldPublishNow(state.articlesPublished)) {
    isProcessing = true;
    try {
      await runPipeline({ contentType: 'reguler' });
    } finally {
      isProcessing = false;
    }
  }

  // Update next scheduled info
  const nextInfo = timeManager.getNextPublishInfo(state.articlesPublished);
  state.nextScheduledAt = nextInfo.nextAt;
  state.agentStatus = isProcessing ? 'processing' : 'idle';
  saveState(state);

  // Watchdog: cek apakah ada 2 jam tanpa publish di jam aktif
  await _watchdog(state);
}

async function _watchdog(state) {
  const now = Date.now();
  if (now - lastWatchdogCheck < 30 * 60 * 1000) return; // Cek setiap 30 menit
  lastWatchdogCheck = now;

  if (!timeManager.isActiveHour()) return;

  if (state.lastPublishedAt) {
    const hoursSince = (now - new Date(state.lastPublishedAt).getTime()) / (1000 * 60 * 60);
    const threshold = settings.telegram.agentDownThresholdMinutes / 60;

    if (hoursSince > threshold && state.articlesPublished < state.articlesTarget) {
      logger.warn(`[watchdog] Tidak ada artikel ${Math.round(hoursSince * 60)} menit!`);
      await telegram?.sendCritical(
        `🚨 AGENT DOWN!\nTidak ada artikel dipublish dalam ${Math.round(hoursSince * 60)} menit.\nPublished hari ini: ${state.articlesPublished}/${state.articlesTarget}`
      ).catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CRON JOBS
// ─────────────────────────────────────────────────────────────

function setupCronJobs() {
  // Main tick — setiap menit
  cron.schedule(settings.scheduler.mainTickCron || '*/1 * * * *', async () => {
    await mainTick().catch(err => {
      logger.error('[scheduler] Main tick error', { error: err.message });
    });
  });

  // Reset daily counters — jam 00.00 WIB
  cron.schedule(settings.scheduler.dailyResetCron || '0 0 * * *', () => {
    logger.info('[scheduler] Reset daily counters...');
    geminiPool.resetDailyCounters();
    const freshS = freshState();
    saveState(freshS);
    logger.info('[scheduler] Reset selesai');
  }, { timezone: 'Asia/Jakarta' });

  // API key health check — setiap jam
  cron.schedule(settings.scheduler.keyHealthCheckCron || '0 */1 * * *', async () => {
    logger.info('[scheduler] API key health check...');
    try {
      const results = await geminiPool.healthCheck();
      const active = results.filter(r => r.status === 'active').length;
      const state = loadState();
      state.apiKeyActive = active;
      state.apiKeyTotal = geminiPool.keys.length;
      saveState(state);
      logger.info(`[scheduler] Key health: ${active}/${geminiPool.keys.length} aktif`);
    } catch (err) {
      logger.error('[scheduler] Key health check error', { error: err.message });
    }
  });

  // Daily cleanup — jam 04.00
  cron.schedule(settings.scheduler.cleanupCron || '0 4 * * *', async () => {
    logger.info('[scheduler] Daily cleanup...');
    try {
      // Bersihkan topics_used yang sudah > 72 jam
      const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      db.prepare('DELETE FROM topics_used WHERE used_at < ?').run(since);
      logger.info('[scheduler] Cleanup selesai');
    } catch (err) {
      logger.error('[scheduler] Cleanup error', { error: err.message });
    }
  });

  logger.info('[scheduler] Cron jobs terdaftar');
}

// ─────────────────────────────────────────────────────────────
// MANUAL TRIGGER (untuk testing / dashboard API)
// ─────────────────────────────────────────────────────────────

async function triggerManual({ topic, category, subcategory, contentType = 'reguler' }) {
  if (isProcessing) {
    throw new Error('Agent sedang memproses artikel lain. Coba lagi dalam beberapa menit.');
  }

  logger.agent(`[scheduler] Manual trigger: "${topic || 'auto'}" (${category || 'auto'})`);

  let topicData = null;
  if (topic) {
    topicData = {
      topic,
      category: category || 'Berita',
      subcategory: subcategory || '',
      indonesia_angle: '',
      urgency: contentType === 'breaking' ? 'breaking' : 'normal',
      source_indices: [],
      keywords: [],
      sourceSnippets: `Tulis artikel tentang: ${topic}`,
    };
  }

  isProcessing = true;
  try {
    await runPipeline({ topicData, contentType, forcedCategory: category });
  } finally {
    isProcessing = false;
  }
}

// ─────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────

async function main() {
  logger.info('═══════════════════════════════════════════');
  logger.info('  JOBEN NEWS AI AGENT — Scheduler Starting');
  logger.info('═══════════════════════════════════════════');

  try {
    initServices();
    setupCronJobs();

    // Startup notification
    const state = freshState();
    saveState(state);

    await telegram?.sendInfo(
      `🚀 JOBEN NEWS Agent dimulai!\nTarget hari ini: ${state.articlesTarget} artikel\nJam aktif: ${settings.agent.activeHours.start}:00 - ${settings.agent.activeHours.end}:00 WIB`
    ).catch(() => {});

    logger.info('[scheduler] Agent siap. Menunggu tick pertama...');

    // Langsung jalankan tick pertama setelah startup (tanpa delay)
    setTimeout(async () => {
      await mainTick().catch(err => logger.error('[scheduler] Initial tick error', { error: err.message }));
    }, 5000);

  } catch (err) {
    logger.error('[scheduler] Fatal error saat startup', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[scheduler] SIGTERM diterima, shutdown gracefully...');
  const state = loadState();
  state.agentStatus = 'stopped';
  saveState(state);
  await telegram?.sendWarning('⚠️ Agent dihentikan (SIGTERM)').catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[scheduler] SIGINT diterima...');
  process.exit(0);
});

// Export untuk dipakai oleh dashboard
module.exports = { triggerManual, loadState, queue, settings };

// Jalankan jika dipanggil langsung
if (require.main === module) {
  main().catch(err => {
    logger.error('Fatal:', { error: err.message });
    process.exit(1);
  });
}
