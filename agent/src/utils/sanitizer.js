'use strict';

/**
 * Sanitizer — Membersihkan dan memvalidasi konten artikel
 * Cek blacklist, pola AI berlebihan, keyword density, dll.
 */

const blacklistConfig = require('../config/blacklist.json');

// Pola AI writing yang harus dihindari (dari PRD §13.1)
const AI_WRITING_PATTERNS = [
  /sebagai kesimpulan[,\s]/gi,
  /secara keseluruhan[,\s]/gi,
  /sangat menarik[,\s]/gi,
  /patut dicatat bahwa/gi,
  /dalam era modern ini/gi,
  /tidak dapat dipungkiri/gi,
  /hal ini menunjukkan bahwa/gi,
  /penting untuk dicatat/gi,
  /perlu diperhatikan bahwa/gi,
  /pada akhirnya[,\s]/gi,
  /dengan demikian[,\s]/gi,
  /oleh karena itu[,\s]/gi,
  /berdasarkan hal tersebut/gi,
  /yang menarik untuk diperhatikan/gi,
  /tidak bisa dipungkiri/gi,
  /selain itu[,\s]/gi,          // Berlebihan jika terlalu sering
  /furthermore/gi,
  /in conclusion/gi,
  /it is worth noting/gi,
  /it should be noted/gi,
];

// Pattern clickbait
const CLICKBAIT_PATTERNS = [
  /MENGEJUTKAN!?/gi,
  /VIRAL!?/gi,
  /HEBOH!?/gi,
  /BIKIN MELONGO/gi,
  /TIDAK TERDUGA/gi,
  /TERNYATA!/gi,
  /LUAR BIASA!/gi,
  /NO\. ?[1-9] AKAN KAGET/gi,
  /\d+ hal yang akan/gi,
  /rahasia yang tidak/gi,
];

/**
 * Cek konten terhadap daftar blacklist
 * @param {string} text - Teks yang akan dicek
 * @returns {{ passed: boolean, hits: string[] }}
 */
function checkBlacklist(text) {
  if (!text || typeof text !== 'string') return { passed: true, hits: [] };

  const normalizedText = text.toLowerCase();
  const hits = [];

  // Cek kata-kata blacklist dari config
  const words = blacklistConfig.words || [];
  for (const word of words) {
    const pattern = new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(normalizedText)) {
      hits.push(`word:${word}`);
    }
  }

  // Cek pattern blacklist (regex)
  const patterns = blacklistConfig.patterns || [];
  for (const patternStr of patterns) {
    try {
      const regex = new RegExp(patternStr, 'gi');
      if (regex.test(text)) {
        hits.push(`pattern:${patternStr}`);
      }
    } catch { /* invalid regex, skip */ }
  }

  return { passed: hits.length === 0, hits };
}

/**
 * Deteksi pola penulisan AI yang berlebihan dalam teks
 * @param {string} text
 * @returns {{ score: number, patterns: string[] }} score 0-10 (makin tinggi makin "AI")
 */
function detectAiPatterns(text) {
  if (!text || typeof text !== 'string') return { score: 0, patterns: [] };

  const found = [];
  for (const pattern of AI_WRITING_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      found.push(...matches.map(m => m.trim()));
    }
  }

  // Score: 1 per pattern, max 10
  const score = Math.min(10, found.length);
  return { score, patterns: [...new Set(found)] };
}

/**
 * Deteksi pola judul clickbait
 * @param {string} title
 * @returns {boolean}
 */
function isClickbait(title) {
  if (!title) return false;
  return CLICKBAIT_PATTERNS.some(p => p.test(title));
}

/**
 * Strip HTML tags dari string
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize judul artikel
 * - Hapus quote berlebihan
 * - Normalisasi spasi
 * - Pastikan tidak diakhiri tanda baca aneh
 * @param {string} title
 * @returns {string}
 */
function sanitizeTitle(title) {
  if (!title) return '';

  return title
    .trim()
    // Hapus quote di awal/akhir
    .replace(/^["'""]|["'""]$/g, '')
    // Normalisasi tanda kutip
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Normalisasi spasi
    .replace(/\s+/g, ' ')
    // Hapus trailing punctuation kecuali tanda tanya
    .replace(/[.,;:!]+$/, '')
    .trim();
}

/**
 * Sanitize slug — pastikan format valid
 * @param {string} slug
 * @returns {string}
 */
function sanitizeSlug(slug) {
  if (!slug) return '';
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Sanitize excerpt/meta description
 * - Hapus HTML tags
 * - Potong ke panjang optimal
 * - Normalisasi spasi
 * @param {string} text
 * @param {number} maxLength - Default: 160
 * @returns {string}
 */
function sanitizeExcerpt(text, maxLength = 160) {
  if (!text) return '';

  let clean = stripHtml(text)
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length <= maxLength) return clean;

  // Potong di kata terakhir yang masuk
  clean = clean.substring(0, maxLength);
  const lastSpace = clean.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    clean = clean.substring(0, lastSpace);
  }

  return clean + '...';
}

/**
 * Validasi dan sanitize Strapi Blocks JSON
 * @param {Array} blocks
 * @returns {{ valid: boolean, blocks: Array, errors: string[] }}
 */
function sanitizeBlocks(blocks) {
  const errors = [];

  if (!Array.isArray(blocks)) {
    return { valid: false, blocks: [], errors: ['content bukan array'] };
  }

  if (blocks.length === 0) {
    return { valid: false, blocks: [], errors: ['content kosong'] };
  }

  const VALID_TYPES = ['paragraph', 'heading', 'list', 'quote', 'code', 'image', 'divider'];
  const VALID_HEADING_LEVELS = [1, 2, 3, 4, 5, 6];

  const sanitized = blocks.filter((block, i) => {
    if (!block || typeof block !== 'object') {
      errors.push(`Block ${i}: bukan object`);
      return false;
    }
    if (!VALID_TYPES.includes(block.type)) {
      errors.push(`Block ${i}: tipe '${block.type}' tidak valid`);
      return false;
    }
    if (block.type === 'heading' && !VALID_HEADING_LEVELS.includes(block.level)) {
      errors.push(`Block ${i}: level heading '${block.level}' tidak valid`);
      return false;
    }
    if (!Array.isArray(block.children) && block.type !== 'divider') {
      errors.push(`Block ${i}: children bukan array`);
      return false;
    }
    return true;
  });

  return {
    valid: errors.length === 0,
    blocks: sanitized,
    errors,
  };
}

/**
 * Cek keberadaan konten Indonesia dalam artikel
 * @param {string} text - Teks artikel
 * @returns {boolean}
 */
function hasIndonesiaContext(text) {
  if (!text) return false;
  const indonesiaKeywords = [
    'indonesia', 'jakarta', 'jawa', 'bali', 'sumatera', 'kalimantan',
    'sulawesi', 'papua', 'bandung', 'surabaya', 'medan', 'makassar',
    'rupiah', 'rp.', 'idr', 'ojk', 'kominfo', 'kemkominfo',
    'gojek', 'tokopedia', 'grab', 'shopee', 'traveloka', 'bukalapak',
    'startup indonesia', 'pemerintah indonesia', 'kemendag',
    'bi ', 'bank indonesia', 'bumn', 'umkm',
  ];

  const lowerText = text.toLowerCase();
  return indonesiaKeywords.some(kw => lowerText.includes(kw));
}

/**
 * Cek apakah ada atribusi sumber yang jelas dalam teks
 * @param {string} text
 * @returns {boolean}
 */
function hasSourceAttribution(text) {
  if (!text) return false;
  const attributionPatterns = [
    /menurut\s+\w+/i,
    /berdasarkan\s+(?:laporan|data|riset|survei)/i,
    /dilaporkan oleh/i,
    /kata\s+\w+\s+kepada/i,
    /ungkap\s+\w+/i,
    /dikutip dari/i,
    /dikembangkan berdasarkan/i,
    /sumber:/i,
    /via\s+\w+/i,
  ];
  return attributionPatterns.some(p => p.test(text));
}

module.exports = {
  checkBlacklist,
  detectAiPatterns,
  isClickbait,
  stripHtml,
  sanitizeTitle,
  sanitizeSlug,
  sanitizeExcerpt,
  sanitizeBlocks,
  hasIndonesiaContext,
  hasSourceAttribution,
};
