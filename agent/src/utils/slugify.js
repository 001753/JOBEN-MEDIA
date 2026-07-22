'use strict';

/**
 * Slugify — Konversi judul Indonesia ke URL-safe slug
 * Mendukung karakter khusus Bahasa Indonesia & diakritik umum
 */

// Map karakter beraksara ke ASCII
const CHAR_MAP = {
  // Vokal beraksara
  'à':'a','á':'a','â':'a','ã':'a','ä':'a','å':'a','æ':'ae',
  'è':'e','é':'e','ê':'e','ë':'e',
  'ì':'i','í':'i','î':'i','ï':'i',
  'ò':'o','ó':'o','ô':'o','õ':'o','ö':'o','ø':'o',
  'ù':'u','ú':'u','û':'u','ü':'u',
  'ý':'y','ÿ':'y',
  'ñ':'n','ç':'c',
  // Kapital
  'À':'a','Á':'a','Â':'a','Ã':'a','Ä':'a','Å':'a','Æ':'ae',
  'È':'e','É':'e','Ê':'e','Ë':'e',
  'Ì':'i','Í':'i','Î':'i','Ï':'i',
  'Ò':'o','Ó':'o','Ô':'o','Õ':'o','Ö':'o','Ø':'o',
  'Ù':'u','Ú':'u','Û':'u','Ü':'u',
  'Ý':'y','Ñ':'n','Ç':'c',
};

/**
 * Konversi string ke slug URL-friendly
 * @param {string} text - Teks input (judul artikel)
 * @param {Object} options
 * @param {number} options.maxLength - Panjang maksimum slug (default: 80)
 * @param {string} options.separator - Pemisah kata (default: '-')
 * @returns {string} Slug yang bersih
 */
function slugify(text, options = {}) {
  const { maxLength = 80, separator = '-' } = options;

  if (!text || typeof text !== 'string') return '';

  let slug = text
    // Normalize unicode
    .normalize('NFKD')
    // Ganti karakter beraksara
    .replace(/[^\u0000-\u007E]/g, (char) => CHAR_MAP[char] || '')
    // Lowercase
    .toLowerCase()
    // Ganti & dengan 'dan'
    .replace(/&/g, 'dan')
    // Ganti + dengan 'plus'
    .replace(/\+/g, 'plus')
    // Ganti % dengan 'persen'
    .replace(/%/g, 'persen')
    // Hapus karakter yang tidak diizinkan
    .replace(/[^a-z0-9\s-]/g, '')
    // Trim whitespace
    .trim()
    // Ganti spasi/tanda hubung berulang dengan satu separator
    .replace(/[\s-]+/g, separator);

  // Potong sesuai maxLength, hindari memotong di tengah kata
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    // Potong di separator terakhir agar tidak ada kata terpotong
    const lastSep = slug.lastIndexOf(separator);
    if (lastSep > maxLength * 0.7) {
      slug = slug.substring(0, lastSep);
    }
  }

  // Hapus trailing/leading separator
  slug = slug.replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '');

  return slug;
}

/**
 * Generate slug unik dengan timestamp suffix jika diperlukan
 * @param {string} text - Teks judul
 * @param {Set|Array} existingSlugs - Koleksi slug yang sudah ada
 * @returns {string} Slug unik
 */
function slugifyUnique(text, existingSlugs = []) {
  const existing = new Set(Array.isArray(existingSlugs) ? existingSlugs : [...existingSlugs]);
  const base = slugify(text);

  if (!existing.has(base)) return base;

  // Coba dengan angka suffix
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }

  // Fallback: timestamp suffix
  return `${base}-${Date.now()}`;
}

/**
 * Validasi apakah string adalah slug yang valid
 * @param {string} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Ekstrak slug dari URL lengkap
 * @param {string} url
 * @returns {string}
 */
function extractSlugFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

module.exports = { slugify, slugifyUnique, isValidSlug, extractSlugFromUrl };
