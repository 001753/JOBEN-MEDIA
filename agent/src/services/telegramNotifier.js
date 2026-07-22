'use strict';

/**
 * TelegramNotifier — Notifikasi real-time via Telegram Bot API
 *
 * Fitur:
 * - Semua jenis notifikasi dari PRD §5.1.K
 * - Queue dengan rate limit (Telegram max 30 msg/detik per bot)
 * - Retry pada network failure
 * - Markdown formatting untuk readability
 * - Multiple chat ID support (admin, channel)
 * - Watchdog alert (agent down > 2 jam)
 * - Escape helper untuk MarkdownV2
 */

const fetch = require('node-fetch');
const logger = require('../utils/logger');
const { sleep } = require('../utils/retryHelper');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const CHANNEL_CHAT_ID = process.env.TELEGRAM_CHANNEL_CHAT_ID || ''; // Fase 3
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Rate limit: max 20 pesan/menit per chat (konservatif)
const SEND_DELAY_MS = 1000;
const MAX_MESSAGE_LENGTH = 4096;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

class TelegramNotifier {
  constructor() {
    this._queue = [];
    this._sending = false;
    this._lastSentAt = 0;

    if (!BOT_TOKEN) {
      logger.warn('[telegram] TELEGRAM_BOT_TOKEN tidak dikonfigurasi — notifikasi dinonaktifkan');
    }
    if (!ADMIN_CHAT_ID) {
      logger.warn('[telegram] TELEGRAM_ADMIN_CHAT_ID tidak dikonfigurasi');
    }
  }

  // ─────────────────────────────────────────────
  // NOTIFIKASI ARTIKEL
  // ─────────────────────────────────────────────

  /**
   * Notifikasi artikel reguler berhasil dipublish
   * @param {Object} article - { title, category, url, wordCount, qualityScore, author }
   */
  async notifyPublished(article) {
    const message = [
      `✅ *Artikel Dipublish*`,
      ``,
      `📰 *${this._esc(article.title)}*`,
      `🏷️ ${this._esc(article.category)}${article.subcategory ? ' › ' + this._esc(article.subcategory) : ''}`,
      `✍️ ${this._esc(article.author || 'Unknown')}`,
      `📊 ${article.wordCount || '—'} kata | Skor: ${article.qualityScore || '—'}`,
      ``,
      `🔗 [Baca Artikel](${article.url || '#'})`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, message);
  }

  /**
   * Notifikasi breaking news berhasil dipublish
   * @param {Object} article
   */
  async notifyBreakingPublished(article) {
    const message = [
      `🔴 *BREAKING NEWS DIPUBLISH*`,
      ``,
      `📰 *${this._esc(article.title)}*`,
      `⚡ Sumber: ${this._esc(article.source || 'Unknown')}`,
      `⏱️ Pipeline: ${article.pipelineMs ? Math.round(article.pipelineMs / 1000) + 's' : '—'}`,
      ``,
      `🔗 [Baca Artikel](${article.url || '#'})`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, message, { priority: true });
  }

  /**
   * Notifikasi breaking news terdeteksi (sebelum publish)
   * @param {Object} breaking - { title, source, tier }
   */
  async notifyBreakingDetected(breaking) {
    const message = [
      `⚡ *Breaking News Terdeteksi*`,
      ``,
      `Tier ${breaking.tier}: ${this._esc(breaking.title)}`,
      `Sumber: ${this._esc(breaking.source)}`,
      `Keywords: \`${(breaking.keywords || []).join(', ')}\``,
      ``,
      `_Sedang diproses untuk publish..._`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, message);
  }

  // ─────────────────────────────────────────────
  // NOTIFIKASI ERROR & STATUS
  // ─────────────────────────────────────────────

  /**
   * Notifikasi error agent (warning level)
   * @param {string} message - Deskripsi error
   * @param {Object} meta - Data tambahan
   */
  async notifyError(message, meta = {}) {
    const text = [
      `⚠️ *Agent Error*`,
      ``,
      `${this._esc(message)}`,
      meta.context ? `Konteks: ${this._esc(meta.context)}` : '',
      meta.detail ? `Detail: \`${this._esc(meta.detail.substring(0, 200))}\`` : '',
    ].filter(Boolean).join('\n');

    return this._send(ADMIN_CHAT_ID, text);
  }

  /**
   * Notifikasi critical — agent down / semua key habis
   * @param {string} message
   */
  async notifyCritical(message) {
    const text = [
      `🚨 *CRITICAL ALERT*`,
      ``,
      this._esc(message),
      ``,
      `_Segera periksa agent di dashboard\\._`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, text, { priority: true });
  }

  /**
   * Notifikasi API key habis quota
   * @param {string} keyId
   * @param {number} used
   * @param {number} limit
   */
  async notifyKeyExhausted(keyId, used, limit) {
    const text = `🔑 *API Key Habis Quota*\n\n\`${keyId}\` — ${used}/${limit} request hari ini`;
    return this._send(ADMIN_CHAT_ID, text);
  }

  /**
   * Notifikasi semua API key tidak tersedia
   */
  async notifyAllKeysDown() {
    const text = [
      `🚨 *SEMUA API KEY TIDAK TERSEDIA*`,
      ``,
      `Agent DIHENTIKAN sementara\\. Menunggu cooldown key\\.`,
      ``,
      `Periksa: Dashboard → API Keys`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, text, { priority: true });
  }

  /**
   * Notifikasi quality gate menolak artikel
   * @param {string} title
   * @param {string} reason
   * @param {number} score
   */
  async notifyQualityRejection(title, reason, score) {
    const text = [
      `❌ *Artikel Ditolak Quality Gate*`,
      ``,
      `Judul: _${this._esc(title.substring(0, 80))}_`,
      `Skor: ${score || '—'}`,
      `Alasan: ${this._esc(reason)}`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, text);
  }

  /**
   * Notifikasi target harian tercapai
   * @param {number} count - Jumlah artikel yang dipublish
   * @param {string} date - Tanggal (YYYY-MM-DD)
   */
  async notifyDailyTargetReached(count, date) {
    const text = [
      `🎯 *Target Harian Tercapai\\!*`,
      ``,
      `📅 ${this._esc(date)}`,
      `📊 ${count} artikel dipublish hari ini`,
      ``,
      `_Agent melanjutkan publikasi bila ada artikel penting\\._`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, text);
  }

  /**
   * Notifikasi agent down (tidak ada artikel 2 jam saat jam aktif)
   * @param {number} minutesSinceLastPublish
   */
  async notifyAgentDown(minutesSinceLastPublish) {
    const text = [
      `🚨 *AGENT DOWN*`,
      ``,
      `Tidak ada artikel dipublish dalam *${minutesSinceLastPublish} menit* terakhir`,
      ``,
      `Segera periksa:`,
      `• Status agent di dashboard`,
      `• Log error`,
      `• Status API keys`,
      ``,
      `Dashboard: \`ai\\.jobenapp\\.cloud\``,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, text, { priority: true });
  }

  // ─────────────────────────────────────────────
  // GENERIC HELPERS
  // ─────────────────────────────────────────────

  /**
   * Kirim pesan informasi biasa
   * @param {string} message
   */
  async sendInfo(message) {
    return this._send(ADMIN_CHAT_ID, `ℹ️ ${message}`);
  }

  /**
   * Kirim pesan warning
   * @param {string} message
   */
  async sendWarning(message) {
    return this._send(ADMIN_CHAT_ID, `⚠️ *Peringatan*\n\n${this._esc(message)}`);
  }

  /**
   * Kirim pesan critical
   * @param {string} message
   */
  async sendCritical(message) {
    return this.notifyCritical(message);
  }

  /**
   * Kirim daily report summary
   * @param {Object} stats
   */
  async sendDailySummary(stats) {
    const successRate = stats.total > 0
      ? Math.round((stats.published / stats.total) * 100)
      : 0;

    const text = [
      `📊 *Laporan Harian JOBEN Agent*`,
      `📅 ${this._esc(stats.date)}`,
      ``,
      `📰 Artikel: *${stats.published}/${stats.target}* target`,
      `🔴 Breaking: *${stats.breaking}* artikel`,
      `✅ Success rate: *${successRate}%*`,
      `❌ Gagal: ${stats.failed || 0}`,
      `⏱️ Avg waktu generate: ${stats.avgMs ? Math.round(stats.avgMs / 1000) + 's' : '—'}`,
      `🔑 API key aktif: ${stats.keysActive}/${stats.keysTotal}`,
    ].join('\n');

    return this._send(ADMIN_CHAT_ID, text);
  }

  // ─────────────────────────────────────────────
  // SEND ENGINE
  // ─────────────────────────────────────────────

  /**
   * Kirim pesan ke Telegram
   * @param {string} chatId
   * @param {string} text
   * @param {Object} options
   * @param {boolean} options.priority - Kirim tanpa queue
   * @returns {Promise<boolean>}
   */
  async _send(chatId, text, options = {}) {
    if (!BOT_TOKEN || !chatId) {
      logger.telegram(`Telegram skip (tidak dikonfigurasi): ${text.substring(0, 50)}`);
      return false;
    }

    // Potong pesan yang terlalu panjang
    const truncated = text.length > MAX_MESSAGE_LENGTH
      ? text.substring(0, MAX_MESSAGE_LENGTH - 100) + '\n\n_\\[pesan terpotong\\]_'
      : text;

    if (options.priority) {
      return this._sendDirect(chatId, truncated);
    }

    // Queue untuk rate limit
    return new Promise((resolve, reject) => {
      this._queue.push({ chatId, text: truncated, resolve, reject });
      this._processQueue();
    });
  }

  /**
   * Proses queue pesan dengan rate limit
   */
  async _processQueue() {
    if (this._sending || this._queue.length === 0) return;
    this._sending = true;

    while (this._queue.length > 0) {
      const { chatId, text, resolve, reject } = this._queue.shift();

      // Rate limit: tunggu jika terlalu cepat
      const elapsed = Date.now() - this._lastSentAt;
      if (elapsed < SEND_DELAY_MS) {
        await sleep(SEND_DELAY_MS - elapsed);
      }

      try {
        const result = await this._sendDirect(chatId, text);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }

    this._sending = false;
  }

  /**
   * Kirim pesan langsung ke Telegram API (dengan retry)
   * @param {string} chatId
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async _sendDirect(chatId, text) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(`${API_BASE}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: false,
          }),
          signal: AbortSignal.timeout(10000),
        });

        const data = await response.json();

        if (data.ok) {
          this._lastSentAt = Date.now();
          logger.telegram(`Pesan terkirim ke ${chatId} (${text.length} chars)`);
          return true;
        }

        // Error dari Telegram API
        if (data.error_code === 429) {
          // Rate limited oleh Telegram
          const retryAfter = (data.parameters?.retry_after || 30) * 1000;
          logger.warn(`[telegram] Rate limited, tunggu ${retryAfter}ms`);
          await sleep(retryAfter);
          continue;
        }

        // Parse error — coba kirim tanpa markdown
        if (data.error_code === 400 && data.description?.includes('parse')) {
          const plainText = text.replace(/[*_`\[\]()~>#+\-=|{}.!\\]/g, '');
          return this._sendPlain(chatId, plainText);
        }

        logger.warn(`[telegram] API error: ${data.error_code} — ${data.description}`);
        return false;

      } catch (err) {
        if (attempt < RETRY_ATTEMPTS) {
          logger.warn(`[telegram] Send error (attempt ${attempt}): ${err.message}, retry...`);
          await sleep(RETRY_DELAY_MS * attempt);
        } else {
          logger.error('[telegram] Gagal kirim pesan setelah semua retry', { error: err.message });
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Kirim pesan plain text (fallback jika markdown error)
   */
  async _sendPlain(chatId, text) {
    try {
      const response = await fetch(`${API_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      return data.ok;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // MARKDOWN HELPER
  // ─────────────────────────────────────────────

  /**
   * Escape karakter khusus MarkdownV2
   * @param {string} text
   * @returns {string}
   */
  _esc(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }

  // ─────────────────────────────────────────────
  // BOT INFO
  // ─────────────────────────────────────────────

  /**
   * Verifikasi bot token valid
   * @returns {Promise<{ok: boolean, username: string}>}
   */
  async verify() {
    if (!BOT_TOKEN) return { ok: false, username: null };

    try {
      const response = await fetch(`${API_BASE}/getMe`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();

      if (data.ok) {
        logger.telegram(`Bot terverifikasi: @${data.result.username}`);
        return { ok: true, username: data.result.username };
      }

      return { ok: false, username: null };
    } catch (err) {
      logger.warn('[telegram] Gagal verifikasi bot', { error: err.message });
      return { ok: false, username: null };
    }
  }

  /**
   * Dapatkan chat ID dari pesan terbaru (untuk setup)
   * @returns {Promise<string|null>}
   */
  async getUpdates() {
    if (!BOT_TOKEN) return null;

    try {
      const response = await fetch(`${API_BASE}/getUpdates?limit=5`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        const update = data.result[0];
        const chatId = update.message?.chat?.id || update.channel_post?.chat?.id;
        return chatId?.toString() || null;
      }

      return null;
    } catch {
      return null;
    }
  }
}

// Singleton
let _instance = null;

function getInstance() {
  if (!_instance) {
    _instance = new TelegramNotifier();
  }
  return _instance;
}

module.exports = { TelegramNotifier, getInstance };
