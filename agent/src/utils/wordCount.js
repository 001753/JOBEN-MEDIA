'use strict';

/**
 * Word Count — Hitung kata dari berbagai format konten
 * Mendukung: plain text, HTML, dan Strapi Blocks JSON
 */

/**
 * Hitung kata dari plain text
 * @param {string} text
 * @returns {number}
 */
function countWordsFromText(text) {
  if (!text || typeof text !== 'string') return 0;

  return text
    .trim()
    .replace(/\s+/g, ' ')       // Normalisasi whitespace
    .split(' ')
    .filter(word => word.length > 0)
    .length;
}

/**
 * Strip HTML tags dan hitung kata
 * @param {string} html
 * @returns {number}
 */
function countWordsFromHtml(html) {
  if (!html || typeof html !== 'string') return 0;

  const plainText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // Hapus script
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')    // Hapus style
    .replace(/<[^>]+>/g, ' ')                           // Hapus tag HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return countWordsFromText(plainText);
}

/**
 * Ekstrak semua teks dari Strapi Blocks JSON (rich text)
 * @param {Array} blocks - Array block Strapi
 * @returns {string} Gabungan semua teks
 */
function extractTextFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return '';

  const texts = [];

  function processNode(node) {
    if (!node) return;

    if (node.type === 'text' && typeof node.text === 'string') {
      texts.push(node.text);
      return;
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(processNode);
    }
  }

  blocks.forEach(processNode);
  return texts.join(' ');
}

/**
 * Hitung kata dari Strapi Blocks JSON
 * @param {Array} blocks - Strapi Blocks JSON array
 * @returns {number}
 */
function countWordsFromBlocks(blocks) {
  const text = extractTextFromBlocks(blocks);
  return countWordsFromText(text);
}

/**
 * Hitung kata dari konten apapun (auto-detect format)
 * @param {string|Array} content
 * @returns {number}
 */
function countWords(content) {
  if (!content) return 0;

  if (Array.isArray(content)) {
    // Strapi Blocks JSON
    return countWordsFromBlocks(content);
  }

  if (typeof content === 'string') {
    if (content.trim().startsWith('<')) {
      // HTML
      return countWordsFromHtml(content);
    }
    // Plain text
    return countWordsFromText(content);
  }

  return 0;
}

/**
 * Estimasi waktu baca artikel (dalam menit)
 * Rata-rata pembaca Indonesia: 200-250 kata/menit
 * @param {number} wordCount
 * @param {number} wpm - Kata per menit (default: 225)
 * @returns {number} Estimasi menit (minimal 1)
 */
function estimateReadTime(wordCount, wpm = 225) {
  return Math.max(1, Math.ceil(wordCount / wpm));
}

/**
 * Hitung frekuensi kata kunci (untuk keyword density check)
 * @param {string|Array} content
 * @param {string} keyword
 * @returns {{ count: number, density: number }}
 */
function keywordDensity(content, keyword) {
  const text = Array.isArray(content)
    ? extractTextFromBlocks(content)
    : (typeof content === 'string' ? content : '');

  const totalWords = countWordsFromText(text);
  if (totalWords === 0) return { count: 0, density: 0 };

  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();

  // Hitung kemunculan kata kunci (case-insensitive, whole word)
  const regex = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  const matches = normalizedText.match(regex);
  const count = matches ? matches.length : 0;
  const density = totalWords > 0 ? (count / totalWords) * 100 : 0;

  return { count, density: parseFloat(density.toFixed(2)) };
}

/**
 * Hitung jumlah fakta spesifik (angka, tanggal, nama brand)
 * @param {string|Array} content
 * @returns {number}
 */
function countSpecificFacts(content) {
  const text = Array.isArray(content)
    ? extractTextFromBlocks(content)
    : (typeof content === 'string' ? content : '');

  let count = 0;

  // Angka/persentase/mata uang
  const numberPattern = /\b\d+(?:[.,]\d+)?(?:\s*(?:%|persen|juta|miliar|triliun|ribu|USD|IDR|Rp))?/g;
  const numbers = text.match(numberPattern) || [];
  count += numbers.filter(n => n.trim().length > 1).length;

  // Tanggal
  const datePattern = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;
  const dates = text.match(datePattern) || [];
  count += dates.length;

  // Hindari double count yang terlalu besar
  return Math.min(count, 20);
}

module.exports = {
  countWords,
  countWordsFromText,
  countWordsFromHtml,
  countWordsFromBlocks,
  extractTextFromBlocks,
  estimateReadTime,
  keywordDensity,
  countSpecificFacts,
};
