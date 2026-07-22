'use strict';

/**
 * TrendScout Agent — Analisis tren dari RSS + pilih topik terbaik untuk ditulis
 *
 * Proses:
 * 1. Terima artikel RSS dari rssReader
 * 2. Kirim ke Gemini + Search Grounding untuk analisis tren
 * 3. Cek published.db untuk hindari duplikasi (72 jam)
 * 4. Return topik terpilih dengan konteks lengkap
 */

const logger = require('../utils/logger');
const prompts = require('../config/prompts');

class TrendScoutAgent {
  constructor({ geminiPool, rssReader, db, settings }) {
    this.gemini = geminiPool;
    this.rss = rssReader;
    this.db = db;
    this.settings = settings;
  }

  /**
   * Jalankan analisis tren dan kembalikan topik terpilih
   * @param {Object} options
   * @param {boolean} options.breakingOnly - Hanya cari breaking news
   * @param {string} options.forcedCategory - Paksa kategori tertentu
   * @returns {Promise<Object>} Topik terpilih dengan metadata
   */
  async run({ breakingOnly = false, forcedCategory = null } = {}) {
    logger.agent('[trend-scout] Mulai analisis tren...');

    // 1. Fetch artikel RSS terbaru
    const maxAge = breakingOnly
      ? this.settings.content.breakingNewsMaxAge
      : this.settings.content.regularNewsMaxAge;

    let articles = await this.rss.fetchAll({ maxAgeHours: maxAge });

    if (articles.length === 0) {
      logger.warn('[trend-scout] Tidak ada artikel RSS yang bisa diambil');
      return null;
    }

    // Batasi jumlah artikel untuk prompt
    const maxSources = this.settings.content.maxSourcesPerAnalysis || 50;
    if (articles.length > maxSources) {
      // Prioritaskan artikel terbaru
      articles = articles.slice(0, maxSources);
    }

    logger.agent(`[trend-scout] Menganalisis ${articles.length} artikel RSS...`);

    // 2. Ambil topik yang sudah ditulis (72 jam) untuk hindari duplikasi
    const alreadyPublished = await this._getRecentTopics();

    // 3. Analisis tren dengan Gemini
    const topics = await this._analyzeTrends(articles, alreadyPublished);

    if (!topics || topics.length === 0) {
      logger.warn('[trend-scout] Gemini tidak menghasilkan topik yang valid');
      return null;
    }

    // 4. Filter dan pilih topik terbaik
    const selected = await this._selectBestTopic(topics, articles, forcedCategory, breakingOnly);

    if (!selected) {
      logger.warn('[trend-scout] Tidak ada topik yang memenuhi kriteria');
      return null;
    }

    // 5. Enrich dengan snippet sumber
    selected.sourceSnippets = this._buildSourceSnippets(selected, articles);

    logger.agent(`[trend-scout] Topik terpilih: "${selected.topic}"`, {
      category: selected.category,
      urgency: selected.urgency,
    });

    return selected;
  }

  /**
   * Kirim artikel RSS ke Gemini untuk analisis tren
   */
  async _analyzeTrends(articles, alreadyPublished) {
    const userPrompt = prompts.trendScout.user(articles, alreadyPublished);

    try {
      const raw = await this.gemini.generateText({
        systemPrompt: prompts.trendScout.system,
        userPrompt,
        useSearch: this.settings.gemini.useSearchGrounding,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 4096,
        },
      });

      const topics = this.gemini.parseJsonResponse(raw);

      if (!Array.isArray(topics)) {
        throw new Error('Response bukan array');
      }

      logger.agent(`[trend-scout] Gemini menghasilkan ${topics.length} topik kandidat`);
      return topics;

    } catch (err) {
      logger.error('[trend-scout] Gagal analisis tren dengan Gemini', { error: err.message });
      throw err;
    }
  }

  /**
   * Pilih topik terbaik dari kandidat, dengan filter duplikasi
   */
  async _selectBestTopic(topics, articles, forcedCategory = null, breakingOnly = false) {
    for (const topic of topics) {
      // Filter breaking only
      if (breakingOnly && topic.urgency !== 'breaking') continue;

      // Filter by forced category
      if (forcedCategory && topic.category !== forcedCategory) continue;

      // Cek duplikasi di SQLite
      const isDuplicate = await this._isDuplicate(topic.topic);
      if (isDuplicate) {
        logger.agent(`[trend-scout] Skip "${topic.topic}" — topik serupa sudah ditulis dalam 72 jam`);
        continue;
      }

      // Cek diversity rules
      const overQuota = await this._isOverCategoryQuota(topic.category);
      if (overQuota) {
        logger.agent(`[trend-scout] Skip "${topic.topic}" — kuota kategori ${topic.category} hari ini penuh`);
        continue;
      }

      return topic;
    }

    // Jika semua difilter habis, ambil topik pertama tanpa filter diversity
    // (fallback agar agent tidak idle)
    if (topics.length > 0 && !breakingOnly) {
      logger.warn('[trend-scout] Semua topik difilter, pakai topik pertama sebagai fallback');
      const fallback = topics[0];
      const isDuplicate = await this._isDuplicate(fallback.topic);
      if (!isDuplicate) return fallback;
    }

    return null;
  }

  /**
   * Cek apakah topik sudah ditulis dalam 72 jam terakhir (by topic hash similarity)
   */
  async _isDuplicate(topicText) {
    if (!this.db) return false;

    try {
      const windowHours = this.settings.quality.duplicateWindowHours || 72;
      const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

      const rows = this.db.prepare(
        'SELECT topic_title FROM topics_used WHERE used_at >= ?'
      ).all(since);

      // Simple overlap check: kata kunci utama
      const topicWords = topicText.toLowerCase().split(/\s+/).filter(w => w.length > 4);

      for (const row of rows) {
        const existingWords = row.topic_title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const intersection = topicWords.filter(w => existingWords.includes(w));
        const overlapRatio = intersection.length / Math.max(topicWords.length, 1);

        if (overlapRatio >= 0.5) {
          return true; // 50%+ overlap dianggap duplikat
        }
      }

      return false;
    } catch (err) {
      logger.warn('[trend-scout] Gagal cek duplikasi', { error: err.message });
      return false;
    }
  }

  /**
   * Cek kuota kategori hari ini (max 3 artikel per subkategori)
   */
  async _isOverCategoryQuota(category) {
    if (!this.db) return false;

    try {
      const maxPerSub = this.settings.diversity.maxArticlesPerSubcategoryPerDay || 3;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const row = this.db.prepare(
        'SELECT COUNT(*) as count FROM articles WHERE category = ? AND published_at >= ? AND status = "published"'
      ).get(category, todayStart.toISOString());

      return (row?.count || 0) >= maxPerSub;
    } catch {
      return false;
    }
  }

  /**
   * Ambil judul topik yang sudah ditulis dalam 72 jam terakhir
   */
  async _getRecentTopics() {
    if (!this.db) return [];

    try {
      const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const rows = this.db.prepare(
        'SELECT topic_title FROM topics_used WHERE used_at >= ?'
      ).all(since);
      return rows.map(r => r.topic_title);
    } catch {
      return [];
    }
  }

  /**
   * Catat topik yang sudah dipilih ke SQLite
   */
  async recordTopicUsed(topicText) {
    if (!this.db) return;

    try {
      const hash = Buffer.from(topicText.toLowerCase()).toString('base64').substring(0, 32);
      this.db.prepare(
        'INSERT OR IGNORE INTO topics_used (topic_hash, topic_title) VALUES (?, ?)'
      ).run(hash, topicText);
    } catch (err) {
      logger.warn('[trend-scout] Gagal catat topik', { error: err.message });
    }
  }

  /**
   * Bangun snippet sumber untuk Writer agent
   */
  _buildSourceSnippets(topic, articles) {
    const indices = topic.source_indices || [];
    const relevant = indices
      .map(i => articles[i - 1])
      .filter(Boolean)
      .slice(0, 5);

    if (relevant.length === 0) {
      // Fallback: ambil 3 artikel pertama
      return articles.slice(0, 3).map(a =>
        `[${a.source}] ${a.title}\n${a.description || a.snippet || ''}`.trim()
      ).join('\n\n---\n\n');
    }

    return relevant.map(a =>
      `[${a.source}] ${a.title}\nURL: ${a.url}\n${a.description || a.snippet || ''}`.trim()
    ).join('\n\n---\n\n');
  }
}

module.exports = TrendScoutAgent;
