'use strict';

/**
 * RssReader — Multi-source RSS/Atom parser
 *
 * Fitur:
 * - Fetch paralel dari 16+ sumber RSS (PRD §5.1.B)
 * - Filter: max age (48 jam reguler / 2 jam breaking)
 * - Deduplication by URL hash
 * - Snippet normalization
 * - Breaking news keyword detection (Tier 1 & Tier 2)
 * - Blacklist domain check
 * - Weighted scoring per sumber
 * - Error isolation per source (satu source gagal tidak hentikan semua)
 * - Concurrency limit untuk menghindari throttling
 */

const Parser = require('rss-parser');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { isFresh, isBreakingFresh, parseRssDate } = require('../utils/dateHelper');
const sourcesConfig = require('../config/sources.json');

const CONCURRENCY_LIMIT = parseInt(process.env.RSS_CONCURRENCY || '5', 10);
const FETCH_TIMEOUT_MS = parseInt(process.env.RSS_TIMEOUT_MS || '15000', 10);
const MIN_SNIPPET_LENGTH = parseInt(process.env.RSS_MIN_SNIPPET || '100', 10);

// RSS Parser config dengan custom fields
const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'JOBEN-NEWS-Agent/1.0 (+https://news.jobenapp.cloud)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
    ],
  },
});

// Deduplication cache — URL hash → timestamp
const _seenUrls = new Map();
const DEDUP_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Cleanup setiap 6 jam

// Cleanup cache lama
setInterval(() => {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [hash, ts] of _seenUrls.entries()) {
    if (ts < cutoff) _seenUrls.delete(hash);
  }
}, DEDUP_CLEANUP_INTERVAL_MS).unref();

class RssReader {
  constructor() {
    this._sources = sourcesConfig.sources;
    this._breakingKeywords = sourcesConfig.breakingKeywords;
    this._blacklistDomains = new Set(sourcesConfig.blacklistDomains || []);
  }

  // ─────────────────────────────────────────────
  // FETCH ALL SOURCES
  // ─────────────────────────────────────────────

  /**
   * Fetch semua sumber RSS aktif secara paralel (dengan concurrency limit)
   * @param {Object} options
   * @param {boolean} options.breakingOnly - Hanya ambil sumber yang breakingCandidate
   * @param {number} options.maxAgeHours - Override max age (default: dari source config)
   * @returns {Promise<Array<RssItem>>} Semua artikel terfilter & normalized
   */
  async fetchAll({ breakingOnly = false, maxAgeHours = null } = {}) {
    const activeSources = this._sources.filter(s => {
      if (!s.active) return false;
      if (breakingOnly && !s.breakingCandidate) return false;
      return true;
    });

    logger.rss(`Fetching ${activeSources.length} RSS sources (breakingOnly: ${breakingOnly})...`);
    const startTime = Date.now();

    // Fetch dengan concurrency limit
    const results = await this._fetchWithConcurrency(activeSources, maxAgeHours);

    // Flatten & deduplicate
    const allItems = [];
    const seenInThisBatch = new Set();

    for (const { source, items } of results) {
      for (const item of items) {
        const urlHash = this._hashUrl(item.url);

        // Skip duplikat dalam batch ini
        if (seenInThisBatch.has(urlHash)) continue;
        seenInThisBatch.add(urlHash);

        // Skip yang sudah pernah diproses (cross-fetch dedup)
        if (_seenUrls.has(urlHash)) continue;
        _seenUrls.set(urlHash, Date.now());

        allItems.push(item);
      }
    }

    // Sort: breaking first, lalu by date desc
    allItems.sort((a, b) => {
      if (a.isBreaking && !b.isBreaking) return -1;
      if (!a.isBreaking && b.isBreaking) return 1;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    const elapsed = Date.now() - startTime;
    logger.rss(`Fetch selesai: ${allItems.length} items dari ${activeSources.length} sumber (${elapsed}ms)`);

    return allItems;
  }

  /**
   * Fetch sumber breaking news saja (untuk breaking daemon — setiap 5 menit)
   * @returns {Promise<Array<RssItem>>}
   */
  async fetchBreaking() {
    return this.fetchAll({ breakingOnly: true, maxAgeHours: 2 });
  }

  /**
   * Fetch satu sumber RSS tertentu
   * @param {string} sourceId
   * @returns {Promise<Array<RssItem>>}
   */
  async fetchSource(sourceId) {
    const source = this._sources.find(s => s.id === sourceId);
    if (!source) throw new Error(`Source tidak ditemukan: ${sourceId}`);

    const result = await this._fetchOne(source);
    return result.items;
  }

  // ─────────────────────────────────────────────
  // CONCURRENCY CONTROL
  // ─────────────────────────────────────────────

  /**
   * Fetch banyak sumber dengan concurrency limit
   * @param {Array} sources
   * @param {number|null} maxAgeHoursOverride
   * @returns {Promise<Array<{source, items}>>}
   */
  async _fetchWithConcurrency(sources, maxAgeHoursOverride) {
    const results = [];
    const queue = [...sources];
    const running = [];

    const processNext = async () => {
      if (queue.length === 0) return;
      const source = queue.shift();

      try {
        const result = await this._fetchOne(source, maxAgeHoursOverride);
        results.push(result);
      } catch (err) {
        logger.warn(`[rss] Source "${source.id}" gagal diambil: ${err.message}`);
        results.push({ source, items: [] });
      }
    };

    // Batch pertama
    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, sources.length); i++) {
      running.push(processNext());
    }

    // Process sisa
    while (queue.length > 0) {
      await Promise.race(running);
      running.length = 0;

      const batch = Math.min(CONCURRENCY_LIMIT, queue.length);
      for (let i = 0; i < batch; i++) {
        running.push(processNext());
      }
    }

    await Promise.all(running);
    return results;
  }

  // ─────────────────────────────────────────────
  // FETCH ONE SOURCE
  // ─────────────────────────────────────────────

  /**
   * Fetch dan parse satu sumber RSS
   * @param {Object} source - Source config object
   * @param {number|null} maxAgeHoursOverride
   * @returns {Promise<{source, items: RssItem[]}>}
   */
  async _fetchOne(source, maxAgeHoursOverride = null) {
    const maxAge = maxAgeHoursOverride || source.maxAgeHours || 48;

    let feed;
    try {
      logger.rss(`Fetching: ${source.name} (${source.url})`);
      feed = await parser.parseURL(source.url);
    } catch (err) {
      logger.warn(`[rss] Gagal fetch ${source.name}: ${err.message}`);
      return { source, items: [] };
    }

    const items = [];
    const feedItems = feed.items || [];

    for (const raw of feedItems) {
      try {
        const item = this._normalizeItem(raw, source, maxAge);
        if (item) items.push(item);
      } catch (err) {
        logger.debug(`[rss] Skip item error: ${err.message}`);
      }
    }

    logger.rss(`${source.name}: ${items.length}/${feedItems.length} items valid`);
    return { source, items };
  }

  // ─────────────────────────────────────────────
  // NORMALIZE & FILTER
  // ─────────────────────────────────────────────

  /**
   * Normalize satu RSS item menjadi format standar
   * Return null jika item tidak memenuhi kriteria
   * @param {Object} raw - Raw RSS item dari parser
   * @param {Object} source - Source config
   * @param {number} maxAgeHours
   * @returns {RssItem|null}
   */
  _normalizeItem(raw, source, maxAgeHours) {
    // 1. URL wajib ada
    const url = raw.link || raw.guid;
    if (!url || typeof url !== 'string') return null;

    // 2. Judul wajib ada
    const title = this._cleanText(raw.title);
    if (!title || title.length < 10) return null;

    // 3. Cek blacklist domain
    try {
      const domain = new URL(url).hostname;
      if (this._blacklistDomains.has(domain)) return null;
    } catch { return null; }

    // 4. Cek tanggal publish
    const publishedAt = parseRssDate(raw.pubDate || raw.isoDate || raw.date);
    if (!publishedAt) return null;
    if (!isFresh(publishedAt, maxAgeHours)) return null;

    // 5. Ekstrak snippet/description
    const description = this._extractSnippet(raw);
    if (description.length < MIN_SNIPPET_LENGTH) return null;

    // 6. Breaking news detection
    const breakingInfo = this._detectBreaking(title, description, source);

    return {
      url,
      title,
      description,
      publishedAt: publishedAt.toISOString(),
      source: source.name,
      sourceId: source.id,
      sourceCategory: source.category,
      sourceLang: source.language,
      sourceWeight: source.weight,
      isBreaking: breakingInfo.isBreaking,
      breakingTier: breakingInfo.tier,
      breakingKeywords: breakingInfo.keywords,
      thumbnail: this._extractThumbnail(raw),
      author: raw.creator || raw.author || '',
    };
  }

  /**
   * Ekstrak snippet bersih dari berbagai field RSS
   * @param {Object} raw
   * @returns {string}
   */
  _extractSnippet(raw) {
    const candidates = [
      raw.contentSnippet,
      raw.summary,
      raw.description,
      raw.contentEncoded,
      raw.content,
    ];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'string') continue;
      const cleaned = this._cleanText(candidate);
      if (cleaned.length >= MIN_SNIPPET_LENGTH) return cleaned.substring(0, 1000);
    }

    return '';
  }

  /**
   * Bersihkan HTML tags dan whitespace berlebihan dari teks
   * @param {string} text
   * @returns {string}
   */
  _cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/<[^>]+>/g, ' ')          // Hapus HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')              // Normalisasi whitespace
      .trim();
  }

  /**
   * Ekstrak thumbnail URL dari RSS item
   * @param {Object} raw
   * @returns {string|null}
   */
  _extractThumbnail(raw) {
    if (raw.mediaContent?.$.url) return raw.mediaContent.$.url;
    if (raw.mediaThumbnail?.$.url) return raw.mediaThumbnail.$.url;
    if (raw.enclosure?.url && raw.enclosure.type?.startsWith('image/')) {
      return raw.enclosure.url;
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // BREAKING NEWS DETECTION
  // ─────────────────────────────────────────────

  /**
   * Deteksi apakah artikel adalah breaking news
   * @param {string} title
   * @param {string} description
   * @param {Object} source
   * @returns {{isBreaking: boolean, tier: number|null, keywords: string[]}}
   */
  _detectBreaking(title, description, source) {
    const searchText = `${title} ${description}`.toLowerCase();
    const foundKeywords = [];

    // Cek Tier 1 keywords (urgent)
    for (const kw of this._breakingKeywords.tier1) {
      if (searchText.includes(kw.toLowerCase())) {
        foundKeywords.push(kw);
      }
    }

    if (foundKeywords.length > 0) {
      return { isBreaking: true, tier: 1, keywords: foundKeywords };
    }

    // Cek Tier 2 keywords (high priority)
    if (source.breakingCandidate) {
      const tier2Matches = [];
      for (const kw of this._breakingKeywords.tier2) {
        if (searchText.includes(kw.toLowerCase())) {
          tier2Matches.push(kw);
        }
      }

      if (tier2Matches.length >= 2) {
        return { isBreaking: true, tier: 2, keywords: tier2Matches };
      }
    }

    return { isBreaking: false, tier: null, keywords: [] };
  }

  // ─────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────

  /**
   * Hash URL untuk deduplication
   * @param {string} url
   * @returns {string}
   */
  _hashUrl(url) {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  /**
   * Filter items hanya yang breaking (untuk daemon)
   * @param {Array<RssItem>} items
   * @returns {{tier1: RssItem[], tier2: RssItem[]}}
   */
  separateBreaking(items) {
    return {
      tier1: items.filter(i => i.isBreaking && i.breakingTier === 1),
      tier2: items.filter(i => i.isBreaking && i.breakingTier === 2),
    };
  }

  /**
   * Format items untuk prompt Gemini (ringkas)
   * @param {Array<RssItem>} items
   * @param {number} maxItems
   * @returns {Array<Object>}
   */
  formatForPrompt(items, maxItems = 80) {
    return items.slice(0, maxItems).map(item => ({
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
      description: item.description.substring(0, 300),
      url: item.url,
      isBreaking: item.isBreaking,
    }));
  }

  /**
   * Dapatkan statistik fetch terakhir
   * @param {Array<{source, items}>} results
   * @returns {Object}
   */
  getStats(results) {
    return {
      totalSources: results.length,
      successSources: results.filter(r => r.items.length > 0).length,
      totalItems: results.reduce((sum, r) => sum + r.items.length, 0),
      breakingCount: results.reduce((sum, r) => sum + r.items.filter(i => i.isBreaking).length, 0),
      bySource: results.map(r => ({
        source: r.source.name,
        count: r.items.length,
        breaking: r.items.filter(i => i.isBreaking).length,
      })),
    };
  }

  /**
   * Clear deduplication cache (untuk testing)
   */
  clearDedupCache() {
    _seenUrls.clear();
  }

  /**
   * Daftar sumber aktif
   * @returns {Array}
   */
  getActiveSources() {
    return this._sources.filter(s => s.active);
  }
}

// Singleton
let _instance = null;

function getInstance() {
  if (!_instance) {
    _instance = new RssReader();
  }
  return _instance;
}

module.exports = { RssReader, getInstance };
