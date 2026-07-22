'use strict';

/**
 * Quality Gate — 7 pemeriksaan otomatis sebelum artikel dipublish
 *
 * Checks:
 * 1. Word Count — min 450 kata
 * 2. Fact Density — min 2 fakta spesifik (angka/tanggal/entitas)
 * 3. Keyword Density — max 3% per kata
 * 4. Title Length — 40-70 karakter
 * 5. Meta Description — 120-155 karakter (auto-fix via Gemini jika gagal)
 * 6. Blacklist Check — 0 kata sensitif
 * 7. Duplicate Check — max 25% overlap dengan 72 jam terakhir
 *
 * Scoring: quality_score >= 65 untuk publish
 */

const logger = require('../utils/logger');
const prompts = require('../config/prompts');
const { countWordsInBlocks, extractPlainText } = require('../utils/wordCount');
const blacklist = require('../config/blacklist.json');

const FORBIDDEN_PATTERNS = [
  /sebagai kesimpulan/gi,
  /secara keseluruhan/gi,
  /sangat menarik/gi,
  /patut dicatat bahwa/gi,
  /dalam era modern ini/gi,
  /tidak dapat dipungkiri/gi,
  /hal ini menunjukkan bahwa/gi,
];

class QualityGate {
  constructor({ geminiPool, settings }) {
    this.gemini = geminiPool;
    this.settings = settings;
  }

  /**
   * Jalankan semua pemeriksaan kualitas
   * @param {Object} article - Draft artikel dari Writer
   * @param {Array} recentArticles - Artikel 72 jam terakhir untuk cek duplikat
   * @returns {Promise<Object>} { passed, score, checks, feedback, article }
   */
  async run(article, recentArticles = []) {
    logger.agent(`[quality-gate] Memeriksa artikel: "${article.title}"`);

    const q = this.settings.quality;
    const checks = {};
    const issues = [];

    // Ekstrak teks dari Strapi Blocks
    const plainText = extractPlainText(article.content);
    const wordCount = article.word_count || countWordsInBlocks(article.content);

    // ─── Check 1: Word Count ─────────────────────────────
    const wcPassed = wordCount >= q.minWordCount;
    checks.wordCount = {
      passed: wcPassed,
      value: wordCount,
      threshold: q.minWordCount,
      message: wcPassed ? `OK (${wordCount} kata)` : `Terlalu pendek: ${wordCount} kata (min ${q.minWordCount})`,
    };
    if (!wcPassed) {
      issues.push(`Artikel terlalu pendek (${wordCount} kata). Tambahkan lebih banyak detail, konteks Indonesia, dan fakta pendukung hingga minimal ${q.minWordCount} kata.`);
    }

    // ─── Check 2: Fact Density ───────────────────────────
    const factCount = this._countFacts(plainText);
    const factPassed = factCount >= q.minFactCount;
    checks.factDensity = {
      passed: factPassed,
      value: factCount,
      threshold: q.minFactCount,
      message: factPassed ? `OK (${factCount} fakta)` : `Kurang fakta: ${factCount} (min ${q.minFactCount})`,
    };
    if (!factPassed) {
      issues.push(`Kurang fakta spesifik (${factCount} ditemukan, min ${q.minFactCount}). Tambahkan minimal ${q.minFactCount - factCount} angka/statistik/tanggal yang konkret.`);
    }

    // ─── Check 3: Keyword Density ────────────────────────
    const keywordDensity = this._checkKeywordDensity(plainText, article.focus_keyword);
    const kdPassed = keywordDensity <= q.maxKeywordDensityPercent;
    checks.keywordDensity = {
      passed: kdPassed,
      value: keywordDensity.toFixed(2),
      threshold: q.maxKeywordDensityPercent,
      message: kdPassed ? `OK (${keywordDensity.toFixed(1)}%)` : `Terlalu tinggi: ${keywordDensity.toFixed(1)}% (max ${q.maxKeywordDensityPercent}%)`,
    };
    if (!kdPassed) {
      issues.push(`Keyword density terlalu tinggi (${keywordDensity.toFixed(1)}%). Variasikan penggunaan kata kunci.`);
    }

    // ─── Check 4: Title Length ───────────────────────────
    const titleLen = (article.title || '').length;
    const titlePassed = titleLen >= q.minTitleLength && titleLen <= q.maxTitleLength;
    checks.titleLength = {
      passed: titlePassed,
      value: titleLen,
      message: titlePassed
        ? `OK (${titleLen} karakter)`
        : titleLen < q.minTitleLength
          ? `Judul terlalu pendek (${titleLen} karakter)`
          : `Judul terlalu panjang (${titleLen} karakter, max ${q.maxTitleLength})`,
    };
    if (!titlePassed) {
      if (titleLen > q.maxTitleLength) {
        // Auto-trim judul
        article.title = article.title.substring(0, q.maxTitleLength - 3) + '...';
        checks.titleLength.passed = true;
        checks.titleLength.message = `Auto-trimmed ke ${article.title.length} karakter`;
        logger.agent('[quality-gate] Judul auto-trimmed');
      } else {
        issues.push(`Judul terlalu pendek (${titleLen} karakter, min ${q.minTitleLength}).`);
      }
    }

    // ─── Check 5: Meta Description ───────────────────────
    const metaLen = (article.seo_description || '').length;
    const metaPassed = metaLen >= q.minMetaLength && metaLen <= q.maxMetaLength;
    checks.metaDescription = {
      passed: metaPassed,
      value: metaLen,
      message: metaPassed ? `OK (${metaLen} karakter)` : `Meta description ${metaLen < q.minMetaLength ? 'terlalu pendek' : 'terlalu panjang'}: ${metaLen} karakter`,
    };
    if (!metaPassed) {
      // Auto-fix via Gemini
      try {
        const fixedMeta = await this._fixMetaDescription(article);
        if (fixedMeta && fixedMeta.length >= q.minMetaLength && fixedMeta.length <= q.maxMetaLength) {
          article.seo_description = fixedMeta;
          checks.metaDescription.passed = true;
          checks.metaDescription.message = `Auto-fixed: ${fixedMeta.length} karakter`;
          logger.agent('[quality-gate] Meta description auto-fixed');
        }
      } catch {
        issues.push(`Meta description tidak valid (${metaLen} karakter). Harus ${q.minMetaLength}-${q.maxMetaLength} karakter.`);
      }
    }

    // ─── Check 6: Blacklist ──────────────────────────────
    const blacklistHits = this._checkBlacklist(plainText + ' ' + (article.title || ''));
    const blacklistPassed = blacklistHits.length === 0;
    checks.blacklist = {
      passed: blacklistPassed,
      value: blacklistHits.length,
      hits: blacklistHits,
      message: blacklistPassed ? 'OK (tidak ada kata terlarang)' : `Ditemukan kata terlarang: ${blacklistHits.join(', ')}`,
    };
    // Blacklist = hard reject, tidak bisa di-fix
    if (!blacklistPassed) {
      const err = new Error(`BLACKLIST_HIT: ${blacklistHits.join(', ')}`);
      err.code = 'BLACKLIST_HIT';
      err.hits = blacklistHits;
      throw err;
    }

    // ─── Check 7: Duplicate ──────────────────────────────
    const dupScore = this._checkDuplicate(article, recentArticles);
    const dupPassed = dupScore <= (q.duplicateThresholdPercent / 100);
    checks.duplicate = {
      passed: dupPassed,
      value: Math.round(dupScore * 100),
      threshold: q.duplicateThresholdPercent,
      message: dupPassed
        ? `OK (${Math.round(dupScore * 100)}% overlap)`
        : `Terlalu mirip artikel lain: ${Math.round(dupScore * 100)}% overlap`,
    };
    if (!dupPassed) {
      const err = new Error(`DUPLICATE_DETECTED: ${Math.round(dupScore * 100)}% overlap dengan artikel yang sudah ada`);
      err.code = 'DUPLICATE_DETECTED';
      err.overlapPercent = Math.round(dupScore * 100);
      throw err;
    }

    // ─── Cek AI-writing patterns ─────────────────────────
    const aiPatternCount = this._countAIPatterns(plainText);
    checks.aiPatterns = {
      passed: aiPatternCount === 0,
      value: aiPatternCount,
      message: aiPatternCount === 0 ? 'OK' : `Ditemukan ${aiPatternCount} pola penulisan AI yang perlu dihindari`,
    };
    if (aiPatternCount > 0) {
      issues.push(`Hapus pola penulisan AI: "sebagai kesimpulan", "patut dicatat bahwa", dll.`);
    }

    // ─── Scoring ─────────────────────────────────────────
    const score = this._calculateScore({ wordCount, factCount, article, checks });

    const passed = score >= q.minQualityScore && checks.wordCount.passed && blacklistPassed && dupPassed;

    const result = {
      passed,
      score,
      checks,
      article, // Dikembalikan dengan auto-fix yang sudah diterapkan
      feedback: issues.length > 0 ? issues.join('\n') : null,
    };

    logger.agent(`[quality-gate] Hasil: ${passed ? 'PASS' : 'FAIL'} (score: ${score})`, {
      title: article.title,
      issues: issues.length,
    });

    return result;
  }

  /**
   * Hitung skor kualitas 0-100
   */
  _calculateScore({ wordCount, factCount, article, checks }) {
    let score = 0;

    // Word count (0-20 poin)
    if (wordCount >= 600) score += 20;
    else if (wordCount >= 500) score += 15;
    else if (wordCount >= 450) score += 10;

    // Fact density (0-20 poin)
    if (factCount >= 4) score += 20;
    else if (factCount >= 3) score += 15;
    else if (factCount >= 2) score += 10;

    // Memiliki context Indonesia (0-15 poin) — heuristik sederhana
    const plainText = extractPlainText(article.content);
    const indonesiaSignals = (plainText.match(/indonesia|jakarta|rupiah|ojk|kominfo|bumn|gojek|tokopedia|grab|bukalapak/gi) || []).length;
    if (indonesiaSignals >= 3) score += 15;
    else if (indonesiaSignals >= 1) score += 8;

    // Title length OK (0-10 poin)
    if (checks.titleLength.passed) score += 10;

    // Meta description OK (0-10 poin)
    if (checks.metaDescription.passed) score += 10;

    // Keyword density OK (0-10 poin)
    if (checks.keywordDensity.passed) score += 10;

    // H2 headings ada (0-10 poin)
    const headings = (article.content || []).filter(b => b.type === 'heading' && b.level === 2);
    if (headings.length >= 2) score += 10;
    else if (headings.length === 1) score += 5;

    // Source attribution (0-5 poin)
    if (article.source_attribution && article.source_url) score += 5;

    return Math.min(100, score);
  }

  /**
   * Hitung jumlah fakta spesifik (angka, tanggal, nama entitas)
   */
  _countFacts(text) {
    let count = 0;

    // Angka/statistik: "45%", "$3 miliar", "10.000", "Rp 500 juta"
    const numbers = text.match(/\b\d+[\.,]?\d*\s*(%|persen|juta|miliar|triliun|ribu|\$|USD|IDR|Rp|GB|TB|MB|GHz|fps|km|meter)\b/gi) || [];
    count += numbers.length;

    // Angka besar standalone
    const bigNumbers = text.match(/\b\d{4,}\b/g) || [];
    count += Math.min(bigNumbers.length, 3); // max 3 dari big numbers

    // Tanggal
    const dates = text.match(/\b(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)|(?:Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\s*\([\d\/]+\)|[\d]{4}-[\d]{2}-[\d]{2})\b/gi) || [];
    count += dates.length;

    // Tahun sebagai fakta kontekstual
    const years = text.match(/\b20[1-3]\d\b/g) || [];
    count += Math.min(years.length, 2);

    return Math.min(count, 10); // Cap di 10 agar tidak inflate skor
  }

  /**
   * Hitung keyword density
   */
  _checkKeywordDensity(text, focusKeyword) {
    if (!focusKeyword || !text) return 0;

    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;

    const keyword = focusKeyword.toLowerCase();
    const matches = words.filter(w => w.includes(keyword)).length;
    return (matches / words.length) * 100;
  }

  /**
   * Cek kata-kata blacklist
   */
  _checkBlacklist(text) {
    const hits = [];
    const terms = blacklist.terms || blacklist.blacklist || [];

    for (const term of terms) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        hits.push(term);
      }
    }

    return hits;
  }

  /**
   * Hitung overlap dengan artikel yang ada
   */
  _checkDuplicate(article, recentArticles) {
    if (!recentArticles || recentArticles.length === 0) return 0;

    const newTitle = (article.title || '').toLowerCase();
    const newWords = new Set(newTitle.split(/\s+/).filter(w => w.length > 3));

    let maxOverlap = 0;

    for (const existing of recentArticles) {
      const existTitle = (existing.title || '').toLowerCase();
      const existWords = new Set(existTitle.split(/\s+/).filter(w => w.length > 3));

      // Jaccard similarity
      const intersection = [...newWords].filter(w => existWords.has(w)).length;
      const union = new Set([...newWords, ...existWords]).size;

      if (union > 0) {
        const similarity = intersection / union;
        maxOverlap = Math.max(maxOverlap, similarity);
      }
    }

    return maxOverlap;
  }

  /**
   * Hitung pola penulisan AI yang harus dihindari
   */
  _countAIPatterns(text) {
    let count = 0;
    for (const pattern of FORBIDDEN_PATTERNS) {
      const matches = text.match(pattern) || [];
      count += matches.length;
    }
    return count;
  }

  /**
   * Auto-fix meta description via Gemini
   */
  async _fixMetaDescription(article) {
    const prompt = prompts.qualityGate.metaFix(
      article.title,
      article.excerpt || article.seo_description || '',
      article.focus_keyword || ''
    );

    const raw = await this.gemini.generateText({
      userPrompt: prompt,
      useSearch: false,
      generationConfig: { temperature: 0.4, maxOutputTokens: 256 },
    });

    return raw.trim().replace(/^["']|["']$/g, '');
  }
}

module.exports = QualityGate;
