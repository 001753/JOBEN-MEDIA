'use strict';

/**
 * Date Helper — Utilitas tanggal dengan timezone WIB (Asia/Jakarta, UTC+7)
 * Semua operasi waktu menggunakan WIB sebagai default
 */

const TZ = 'Asia/Jakarta';
const UTC_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB = UTC+7

/**
 * Nama bulan dalam Bahasa Indonesia
 */
const BULAN_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

/**
 * Dapatkan Date sekarang dalam WIB
 * @returns {Date}
 */
function nowWIB() {
  return new Date(Date.now());
}

/**
 * Dapatkan ISO string sekarang dengan offset WIB (+07:00)
 * @returns {string} e.g. "2026-07-22T14:30:00+07:00"
 */
function nowISO() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + UTC_OFFSET_MS);
  const iso = wibTime.toISOString().replace('Z', '');
  return `${iso}+07:00`;
}

/**
 * Format tanggal ke string Indonesia
 * @param {Date|string|number} date
 * @param {Object} options
 * @param {boolean} options.withTime - Sertakan waktu (default: false)
 * @param {boolean} options.withDay - Sertakan nama hari (default: false)
 * @returns {string} e.g. "22 Juli 2026" atau "Selasa, 22 Juli 2026 pukul 14:30 WIB"
 */
function formatDateID(date, options = {}) {
  const { withTime = false, withDay = false } = options;
  const d = new Date(date);

  // Konversi ke WIB
  const wib = new Date(d.getTime() + UTC_OFFSET_MS);

  const day = wib.getUTCDate();
  const month = BULAN_ID[wib.getUTCMonth()];
  const year = wib.getUTCFullYear();

  let result = `${day} ${month} ${year}`;

  if (withDay) {
    const dayName = HARI_ID[wib.getUTCDay()];
    result = `${dayName}, ${result}`;
  }

  if (withTime) {
    const hours = String(wib.getUTCHours()).padStart(2, '0');
    const minutes = String(wib.getUTCMinutes()).padStart(2, '0');
    result += ` pukul ${hours}:${minutes} WIB`;
  }

  return result;
}

/**
 * Format tanggal ke string pendek untuk slug/filename
 * @param {Date|string|number} date
 * @returns {string} e.g. "2026-07-22"
 */
function formatDateSlug(date) {
  const d = new Date(date);
  const wib = new Date(d.getTime() + UTC_OFFSET_MS);
  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wib.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Cek apakah artikel masih "fresh" (dalam batas umur tertentu)
 * @param {Date|string} publishedAt - Waktu terbit artikel sumber
 * @param {number} maxAgeHours - Maksimum umur dalam jam (default: 48)
 * @returns {boolean}
 */
function isFresh(publishedAt, maxAgeHours = 48) {
  const pub = new Date(publishedAt);
  if (isNaN(pub.getTime())) return false;
  const ageMs = Date.now() - pub.getTime();
  return ageMs <= maxAgeHours * 60 * 60 * 1000;
}

/**
 * Cek apakah breaking news masih layak (< 2 jam)
 * @param {Date|string} publishedAt
 * @returns {boolean}
 */
function isBreakingFresh(publishedAt) {
  return isFresh(publishedAt, 2);
}

/**
 * Dapatkan jam WIB saat ini (0-23)
 * @returns {number}
 */
function currentHourWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + UTC_OFFSET_MS);
  return wib.getUTCHours();
}

/**
 * Cek apakah jam sekarang termasuk jam aktif agent (06:00 - 23:00 WIB)
 * @param {number} startHour - Jam mulai (default: 6)
 * @param {number} endHour - Jam selesai (default: 23)
 * @returns {boolean}
 */
function isActiveHour(startHour = 6, endHour = 23) {
  const hour = currentHourWIB();
  return hour >= startHour && hour < endHour;
}

/**
 * Hitung menit sampai jam aktif berikutnya
 * @param {number} startHour
 * @returns {number} Menit menunggu
 */
function minutesUntilActiveHour(startHour = 6) {
  const now = new Date();
  const wib = new Date(now.getTime() + UTC_OFFSET_MS);
  const currentHour = wib.getUTCHours();
  const currentMinute = wib.getUTCMinutes();

  if (currentHour < startHour) {
    return (startHour - currentHour) * 60 - currentMinute;
  }

  // Sudah lewat, hitung sampai besok
  return (24 - currentHour + startHour) * 60 - currentMinute;
}

/**
 * Buat timestamp WIB untuk logging
 * @returns {string} e.g. "2026-07-22 14:30:00 WIB"
 */
function logTimestamp() {
  const now = new Date();
  const wib = new Date(now.getTime() + UTC_OFFSET_MS);
  return wib.toISOString().replace('T', ' ').replace('Z', '') + ' WIB';
}

/**
 * Hitung selisih waktu dalam format human-readable
 * @param {Date|string} from
 * @param {Date|string} to - Default: sekarang
 * @returns {string} e.g. "5 menit lalu", "2 jam lalu"
 */
function timeAgo(from, to = new Date()) {
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec} detik lalu`;
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return `${diffDay} hari lalu`;
}

/**
 * Dapatkan tanggal hari ini dalam format WIB (YYYY-MM-DD)
 * @returns {string}
 */
function todayWIB() {
  return formatDateSlug(new Date());
}

/**
 * Parse berbagai format tanggal RSS (RFC 2822, ISO 8601, dll)
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseRssDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

module.exports = {
  nowWIB,
  nowISO,
  formatDateID,
  formatDateSlug,
  isFresh,
  isBreakingFresh,
  currentHourWIB,
  isActiveHour,
  minutesUntilActiveHour,
  logTimestamp,
  timeAgo,
  todayWIB,
  parseRssDate,
  BULAN_ID,
  HARI_ID,
  TZ,
};
