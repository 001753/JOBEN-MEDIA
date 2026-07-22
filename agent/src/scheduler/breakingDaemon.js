'use strict';

/**
 * Breaking News Daemon — Proses terpisah untuk monitoring real-time
 *
 * Poll setiap 5 menit:
 * 1. Fetch RSS sumber breaking (Reuters, AP, BBC)
 * 2. Filter: artikel < 2 jam terakhir
 * 3. Evaluasi dengan Gemini: Tier 1 (publish < 15 menit) atau Tier 2 (priority queue)
 * 4. Tier 1: Bypass scheduler → langsung pipeline breaking
 * 5. Tier 2: Inject ke priority queue scheduler
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const logger = require('../utils/logger');
const settings = require('../config/settings.json');
const prompts = require('../config/prompts');
const { todayWIB } = require('../utils/dateHelper');

const { getInstance: getGeminiPool } = require('../services/geminiPool');
const { getInstance: getStrapiClient } = require('../services/strapiClient');
const { getInstance: getR2Client } = require('../services/r2Client');
const telegramFactory = require('../services/telegramNotifier');
const rssReaderFactory = require('../services/rssReader');

const TrendScoutAgent = require('../agents/trendScout');
const WriterAgent = require('../agents/writer');
const QualityGate = require('../agents/qualityGate');
const ImageGenAgent = require('../agents/imageGen');
const InternalLinkerAgent = require('../agents/internalLinker');
const PublisherAgent = require('../agents/publisher');
const TimeManager = require('./timeManager');

const DB_FILE = path.join(__dirname, '../../data/published.db');
const BREAKING_LOG_FILE = path.join(__dirname, '../../data/breaking-seen.json');

let isProcessing = false;
let seenUrls = new Set();

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

function loadSeenUrls() {
  try {
    if (fs.existsSync(BREAKING_LOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(BREAKING_LOG_FILE, 'utf8'));
      // Hanya ingat 2 jam terakhir
      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      const filtered = (data.seen || []).filter(s => new Date(s.seenAt).getTime() > cutoff);
      seenUrls = new Set(filtered.map(s => s.url));
      return filtered;
    }
  } catch {}
  return [];
}

function saveSeenUrl(url) {
  try {
    let seen = loadSeenUrls();
    seen = seen.filter(s => s.url !== url);
    seen.push({ url, seenAt: new Date().toISOString() });
    // Batasi 500 item
    seen = seen.slice(-500);
    const dir = path.dirname(BREAKING_LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BREAKING_LOG_FILE, JSON.stringify({ seen }, null, 2));
    seenUrls.add(url);
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// BREAKING EVALUATOR
// ─────────────────────────────────────────────────────────────

async function evaluateForBreaking(articles, geminiPool) {
  if (articles.length === 0) return { breaking: [], normal: [] };

  try {
    const prompt = prompts.breakingEval.evaluate(articles);

    const raw = await geminiPool.generateText({
      userPrompt: prompt,
      useSearch: false,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });

    const result = geminiPool.parseJsonResponse(raw);
    return result;
  } catch (err) {
    logger.warn('[breaking-daemon] Gagal evaluasi breaking dengan Gemini', { error: err.message });
    return { breaking: [], normal: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// BREAKING PIPELINE
// ─────────────────────────────────────────────────────────────

async function processBreaking(article, { geminiPool, strapiClient, r2Client, telegram, db, settings }) {
  const startTime = Date.now();
  logger.agent(`[breaking-daemon] Proses breaking: "${article.title}"`);

  const timeManager = new TimeManager(settings);
  const trendScout = new TrendScoutAgent({ geminiPool, rssReader: null, db, settings });
  const writer = new WriterAgent({ geminiPool, settings });
  const qualityGate = new QualityGate({ geminiPool, settings });

  const imageGen = new ImageGenAgent({ geminiPool, r2Client, settings });
  const internalLinker = new InternalLinkerAgent({ geminiPool, strapiClient, settings });
  const publisher = new PublisherAgent({ strapiClient, telegramNotifier: telegram, db, timeManager, settings });

  // Build topicData dari artikel breaking
  const topicData = {
    topic: article.title,
    category: 'Breaking News',
    subcategory: 'Terkini',
    indonesia_angle: 'Dampak dan relevansi berita ini bagi Indonesia',
    urgency: 'breaking',
    source_indices: [1],
    keywords: [],
    sourceSnippets: `[${article.source}] ${article.title}\nURL: ${article.url}\n${article.description || ''}`,
  };

  // Writer — mode breaking (300-400 kata)
  let draft;
  try {
    draft = await writer.run(topicData, 'breaking');
  } catch (err) {
    logger.error('[breaking-daemon] Writer error', { error: err.message });
    return;
  }

  // Quality Gate — lebih longgar untuk breaking
  let finalDraft = draft;
  try {
    // Override min word count untuk breaking
    const breakingSettings = {
      ...settings,
      quality: { ...settings.quality, minWordCount: 250 },
    };
    const gate = new QualityGate({ geminiPool, settings: breakingSettings });
    const result = await gate.run(draft, []);
    if (result.passed) {
      finalDraft = result.article;
      finalDraft._qualityScore = result.score;
    }
  } catch (err) {
    if (err.code === 'BLACKLIST_HIT' || err.code === 'DUPLICATE_DETECTED') {
      logger.warn(`[breaking-daemon] Breaking news ditolak: ${err.code}`);
      return;
    }
    // Lanjut meski quality gate error (breaking = urgent)
    logger.warn('[breaking-daemon] Quality gate error (lanjut untuk breaking)', { error: err.message });
  }

  // Image Gen
  let imageResult = null;
  try {
    imageResult = await imageGen.run(finalDraft);
  } catch (err) {
    logger.warn('[breaking-daemon] ImageGen gagal (lanjut)', { error: err.message });
  }

  // Publisher
  try {
    const published = await publisher.run(finalDraft, imageResult);
    const elapsed = Date.now() - startTime;
    logger.agent(`[breaking-daemon] ✅ Breaking published dalam ${elapsed}ms: "${published.title}"`);

    // Notifikasi Telegram breaking
    await telegram?.sendCritical(
      `🔴 BREAKING NEWS dipublish!\n\n${finalDraft.title}\n\n⏱️ ${Math.round(elapsed / 1000)} detik dari deteksi ke publish\n📖 ${published.url || ''}`
    ).catch(() => {});

  } catch (err) {
    logger.error('[breaking-daemon] Publisher error', { error: err.message });
    await telegram?.notifyError(`⚠️ Breaking news gagal dipublish: "${draft.title}"`, { detail: err.message }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN TICK
// ─────────────────────────────────────────────────────────────

async function breakingTick(services) {
  if (isProcessing) return;

  const { geminiPool, rssReader } = services;

  // Fetch RSS dari sumber breaking saja (< 2 jam)
  let recentArticles;
  try {
    recentArticles = await rssReader.fetchBreaking();
  } catch (err) {
    logger.warn('[breaking-daemon] Gagal fetch RSS', { error: err.message });
    return;
  }

  if (!recentArticles || recentArticles.length === 0) return;

  // Filter: hapus yang sudah pernah diproses
  const newArticles = recentArticles.filter(a => !seenUrls.has(a.url));
  if (newArticles.length === 0) return;

  logger.agent(`[breaking-daemon] ${newArticles.length} artikel baru untuk dievaluasi`);

  // Tandai sebagai seen
  newArticles.forEach(a => saveSeenUrl(a.url));

  // Evaluasi dengan Gemini
  const { breaking = [] } = await evaluateForBreaking(newArticles.slice(0, 10), geminiPool);

  if (breaking.length === 0) {
    logger.agent('[breaking-daemon] Tidak ada breaking news tier 1/2');
    return;
  }

  // Proses Tier 1 segera
  const tier1 = breaking.filter(b => b.tier === 1);
  for (const b of tier1.slice(0, 1)) { // Proses 1 tier 1 per tick
    const article = newArticles[b.index - 1];
    if (!article) continue;

    isProcessing = true;
    try {
      await processBreaking(article, services);
    } finally {
      isProcessing = false;
    }
  }

  // Tier 2: inject ke priority queue (shared queue.json) untuk diproses scheduler utama
  const tier2 = breaking.filter(b => b.tier === 2);
  for (const b of tier2.slice(0, 2)) {
    const article = newArticles[b.index - 1];
    if (!article) continue;

    logger.agent(`[breaking-daemon] Tier 2 dideteksi: "${article.title}" — inject ke priority queue`);

    // Tulis ke queue.json secara langsung (shared file antara daemon dan scheduler)
    try {
      const queueFile = require('path').join(__dirname, '../../data/queue.json');
      const fs = require('fs');
      let queueData = { items: [] };
      if (fs.existsSync(queueFile)) {
        queueData = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
      }
      const qItem = {
        id: `q_breaking_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        priority: 1, // Hot news priority
        topicData: {
          topic: article.title,
          category: 'Berita',
          subcategory: 'Terkini',
          indonesia_angle: 'Dampak dan relevansi berita ini bagi Indonesia',
          urgency: 'high',
          source_indices: [1],
          keywords: [],
          sourceSnippets: `[${article.source}] ${article.title}\nURL: ${article.url}\n${article.description || ''}`,
        },
        source: 'breaking-daemon-tier2',
        contentType: 'reguler',
        forcedCategory: null,
        addedAt: new Date().toISOString(),
        status: 'pending',
      };
      queueData.items = queueData.items || [];
      queueData.items.push(qItem);
      // Sort by priority desc
      queueData.items.sort((a, z) => (z.priority || 0) - (a.priority || 0));
      queueData.savedAt = new Date().toISOString();

      const dir = require('path').dirname(queueFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(queueFile, JSON.stringify(queueData, null, 2));
      logger.agent(`[breaking-daemon] Tier 2 dimasukkan ke queue: "${article.title}"`);
    } catch (err) {
      logger.warn('[breaking-daemon] Gagal inject Tier 2 ke queue', { error: err.message });
    }

    // Notifikasi Telegram
    await services.telegram?.notifyBreakingDetected({
      title: article.title,
      source: article.source,
      tier: 2,
      keywords: [],
    }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────

async function main() {
  logger.info('═══════════════════════════════════════════');
  logger.info('  JOBEN NEWS — Breaking News Daemon Start');
  logger.info('═══════════════════════════════════════════');

  loadSeenUrls();

  // Init services
  const geminiPool = getGeminiPool();
  const strapiClient = getStrapiClient();
  const r2Client = getR2Client();
  const telegram = new telegramFactory.TelegramNotifier();
  geminiPool.setTelegramNotifier(telegram);

  const sourcesConfig = require('../config/sources.json');
  const rssReader = new rssReaderFactory.RssReader({ sources: sourcesConfig.sources || sourcesConfig });

  const dbDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  geminiPool.setDatabase(db);

  const services = { geminiPool, strapiClient, r2Client, telegram, db, settings };

  // Cron: setiap 5 menit
  cron.schedule(settings.scheduler.breakingTickCron || '*/5 * * * *', async () => {
    await breakingTick(services).catch(err => {
      logger.error('[breaking-daemon] Tick error', { error: err.message });
    });
  });

  logger.info('[breaking-daemon] Daemon siap, monitoring setiap 5 menit');
  await telegram.sendInfo('🟡 Breaking News Daemon dimulai').catch(() => {});
}

process.on('SIGTERM', () => {
  logger.info('[breaking-daemon] Shutdown...');
  process.exit(0);
});

if (require.main === module) {
  main().catch(err => {
    logger.error('Breaking daemon fatal:', { error: err.message });
    process.exit(1);
  });
}
