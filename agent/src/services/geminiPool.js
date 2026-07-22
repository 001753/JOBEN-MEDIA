'use strict';

/**
 * GeminiPool — Manajemen 15+ API key Gemini dengan rotasi cerdas
 *
 * Fitur:
 * - Round-robin rotation dengan skip logic
 * - Rate limit handling (429 → cooldown 60 detik, pindah key)
 * - Error streak tracking (≥5 error → disable 30 menit)
 * - Daily usage counter dengan auto-reset jam 00.00 WIB
 * - Health check berkala (ping semua key setiap jam)
 * - Persistent state ke data/keys.json
 * - Alert Telegram ketika semua key habis/down
 * - SQLite logging per penggunaan key
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { sleep } = require('../utils/retryHelper');

const KEYS_FILE = path.join(__dirname, '../../data/keys.json');
const DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT_PER_KEY || '1500', 10);
const COOLDOWN_429_MS = parseInt(process.env.GEMINI_COOLDOWN_MS || '60000', 10);
const ERROR_STREAK_THRESHOLD = parseInt(process.env.GEMINI_ERROR_STREAK || '5', 10);
const DISABLE_DURATION_MS = parseInt(process.env.GEMINI_DISABLE_MINUTES || '30', 10) * 60 * 1000;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-002';

class GeminiPool {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this._telegramNotifier = null;
    this._db = null;
    this._loadKeys();
  }

  // ─────────────────────────────────────────────
  // KEY MANAGEMENT
  // ─────────────────────────────────────────────

  /**
   * Load keys dari environment variables (GEMINI_KEY_01 .. GEMINI_KEY_15)
   * Merge dengan state tersimpan di keys.json
   */
  _loadKeys() {
    const envKeys = [];
    for (let i = 1; i <= 20; i++) {
      const key = process.env[`GEMINI_KEY_${String(i).padStart(2, '0')}`];
      if (key && key.startsWith('AIza')) {
        envKeys.push(key);
      }
    }

    if (envKeys.length === 0) {
      logger.warn('[gemini-pool] Tidak ada GEMINI_KEY_* ditemukan di environment');
    }

    // Load state tersimpan
    let savedState = { keys: [], lastRotationIndex: 0 };
    try {
      if (fs.existsSync(KEYS_FILE)) {
        savedState = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      }
    } catch (err) {
      logger.warn('[gemini-pool] Gagal load keys.json, mulai dari fresh state', { error: err.message });
    }

    // Merge env keys dengan saved state
    this.keys = envKeys.map((rawKey, i) => {
      const id = `key_${String(i + 1).padStart(2, '0')}`;
      const saved = savedState.keys?.find(k => k.id === id);

      return {
        id,
        key: rawKey,
        status: saved?.status === 'disabled' ? 'disabled' : 'active',
        dailyUsed: saved?.dailyUsed || 0,
        dailyLimit: DAILY_LIMIT,
        errorStreak: saved?.errorStreak || 0,
        cooldownUntil: saved?.cooldownUntil ? new Date(saved.cooldownUntil) : null,
        disabledUntil: saved?.disabledUntil ? new Date(saved.disabledUntil) : null,
        lastUsed: saved?.lastUsed ? new Date(saved.lastUsed) : null,
        lastError: saved?.lastError || null,
        totalSuccess: saved?.totalSuccess || 0,
        totalError: saved?.totalError || 0,
      };
    });

    this.currentIndex = savedState.lastRotationIndex || 0;

    logger.info(`[gemini-pool] Loaded ${this.keys.length} keys`, {
      active: this.keys.filter(k => k.status === 'active').length,
    });

    this._saveState();
  }

  /**
   * Simpan state keys ke file
   */
  _saveState() {
    try {
      const dir = path.dirname(KEYS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const state = {
        keys: this.keys.map(k => ({
          id: k.id,
          status: k.status,
          dailyUsed: k.dailyUsed,
          dailyLimit: k.dailyLimit,
          errorStreak: k.errorStreak,
          cooldownUntil: k.cooldownUntil?.toISOString() || null,
          disabledUntil: k.disabledUntil?.toISOString() || null,
          lastUsed: k.lastUsed?.toISOString() || null,
          lastError: k.lastError,
          totalSuccess: k.totalSuccess,
          totalError: k.totalError,
        })),
        lastRotationIndex: this.currentIndex,
        savedAt: new Date().toISOString(),
      };

      fs.writeFileSync(KEYS_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      logger.error('[gemini-pool] Gagal simpan keys.json', { error: err.message });
    }
  }

  /**
   * Pilih key berikutnya yang tersedia (round-robin + skip logic)
   * @returns {Object} Key object yang siap dipakai
   * @throws {Error} ALL_KEYS_UNAVAILABLE jika semua key tidak bisa dipakai
   */
  getNextKey() {
    const now = Date.now();
    let attempts = 0;

    while (attempts < this.keys.length) {
      const key = this.keys[this.currentIndex % this.keys.length];
      this.currentIndex++;
      attempts++;

      // Skip: sedang dalam cooldown
      if (key.cooldownUntil && now < key.cooldownUntil.getTime()) {
        logger.debug(`[gemini-pool] Skip ${key.id} — cooldown sampai ${key.cooldownUntil.toISOString()}`);
        continue;
      }

      // Reset cooldown yang sudah lewat
      if (key.cooldownUntil && now >= key.cooldownUntil.getTime()) {
        key.cooldownUntil = null;
        if (key.status === 'cooldown') key.status = 'active';
      }

      // Skip: sedang disabled (error streak tinggi)
      if (key.disabledUntil && now < key.disabledUntil.getTime()) {
        continue;
      }

      // Reset disabled yang sudah lewat
      if (key.disabledUntil && now >= key.disabledUntil.getTime()) {
        key.disabledUntil = null;
        key.errorStreak = 0;
        key.status = 'active';
        logger.info(`[gemini-pool] ${key.id} kembali aktif setelah disable period`);
      }

      // Skip: sudah exhausted
      if (key.status === 'exhausted') continue;
      if (key.status === 'disabled' && !key.disabledUntil) continue;

      // Skip: quota harian habis
      if (key.dailyUsed >= key.dailyLimit) {
        key.status = 'exhausted';
        logger.warn(`[gemini-pool] ${key.id} quota habis (${key.dailyUsed}/${key.dailyLimit})`);
        continue;
      }

      return key;
    }

    // Semua key tidak tersedia
    const err = new Error('ALL_KEYS_UNAVAILABLE');
    err.code = 'ALL_KEYS_UNAVAILABLE';
    throw err;
  }

  /**
   * Tandai key berhasil digunakan
   * @param {Object} key
   * @param {number} latencyMs
   */
  _recordSuccess(key, latencyMs = 0) {
    key.dailyUsed++;
    key.errorStreak = 0;
    key.lastUsed = new Date();
    key.totalSuccess++;
    if (key.status === 'cooldown') key.status = 'active';

    logger.gemini(`[${key.id}] Success — used: ${key.dailyUsed}/${key.dailyLimit} — ${latencyMs}ms`);

    // Log ke SQLite jika tersedia
    if (this._db) {
      try {
        this._db.prepare(
          'INSERT INTO api_key_usage (key_id, success, latency_ms) VALUES (?, 1, ?)'
        ).run(key.id, latencyMs);
      } catch { /* skip */ }
    }

    this._saveState();
  }

  /**
   * Tangani error dari API call
   * @param {Object} key
   * @param {Error} error
   */
  _recordError(key, error) {
    key.errorStreak++;
    key.lastUsed = new Date();
    key.lastError = error.message;
    key.totalError++;

    const errorCode = error.status?.toString() || error.code || 'unknown';

    // 429: Rate limit → cooldown 60 detik
    if (error.status === 429 || error.message?.includes('429')) {
      key.cooldownUntil = new Date(Date.now() + COOLDOWN_429_MS);
      key.status = 'cooldown';
      logger.warn(`[gemini-pool] ${key.id} rate limited (429) — cooldown ${COOLDOWN_429_MS / 1000}s`);
    }

    // Error streak terlalu tinggi → disable sementara
    if (key.errorStreak >= ERROR_STREAK_THRESHOLD) {
      key.disabledUntil = new Date(Date.now() + DISABLE_DURATION_MS);
      key.status = 'disabled';
      const disableMin = Math.round(DISABLE_DURATION_MS / 60000);
      logger.warn(`[gemini-pool] ${key.id} disabled ${disableMin} menit (error streak: ${key.errorStreak})`);

      // Notify Telegram
      if (this._telegramNotifier) {
        this._telegramNotifier.sendWarning(
          `🔑 API Key ${key.id} disabled ${disableMin} menit\nError streak: ${key.errorStreak}x\nError: ${error.message}`
        ).catch(() => {});
      }
    }

    // Log ke SQLite
    if (this._db) {
      try {
        this._db.prepare(
          'INSERT INTO api_key_usage (key_id, success, error_code) VALUES (?, 0, ?)'
        ).run(key.id, errorCode);
      } catch { /* skip */ }
    }

    this._saveState();
  }

  // ─────────────────────────────────────────────
  // GENERATE CONTENT (Text)
  // ─────────────────────────────────────────────

  /**
   * Generate konten teks via Gemini (dengan otomatis rotasi key)
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @param {boolean} params.useSearch - Aktifkan Google Search Grounding
   * @param {Object} params.generationConfig - Override generation config
   * @param {number} params.maxRetries - Max key switch attempts (default: 3)
   * @returns {Promise<string>} Teks hasil generate
   */
  async generateText({ systemPrompt, userPrompt, useSearch = false, generationConfig = {}, maxRetries = 3 }) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let key;
      try {
        key = this.getNextKey();
      } catch (err) {
        // Semua key tidak tersedia
        const waitMs = this._getShortestCooldown();
        logger.error('[gemini-pool] Semua key tidak tersedia!', { waitMs });

        if (this._telegramNotifier) {
          await this._telegramNotifier.sendCritical(
            `🚨 SEMUA API KEY GEMINI TIDAK TERSEDIA!\nAgent dipause. Tunggu ${Math.round(waitMs / 60000)} menit.`
          ).catch(() => {});
        }

        if (waitMs > 0 && waitMs < 5 * 60 * 1000) {
          await sleep(waitMs + 1000);
          attempt--; // Retry setelah cooldown
          continue;
        }

        throw err;
      }

      const startTime = Date.now();

      try {
        const genAI = new GoogleGenerativeAI(key.key);

        const modelConfig = {
          model: MODEL_NAME,
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
            ...generationConfig,
          },
        };

        // System instruction jika ada
        if (systemPrompt) {
          modelConfig.systemInstruction = {
            parts: [{ text: systemPrompt }],
          };
        }

        // Google Search Grounding
        if (useSearch) {
          modelConfig.tools = [{ googleSearch: {} }];
        }

        const model = genAI.getGenerativeModel(modelConfig);

        const result = await model.generateContent(userPrompt);
        const response = result.response;
        const text = response.text();

        const latencyMs = Date.now() - startTime;
        this._recordSuccess(key, latencyMs);

        logger.gemini(`Generate berhasil dengan ${key.id}`, { latencyMs, chars: text.length });
        return text;

      } catch (error) {
        const latencyMs = Date.now() - startTime;
        this._recordError(key, error);

        lastError = error;

        // 400: Bad request — jangan retry dengan key lain, error dari prompt
        if (error.status === 400) {
          logger.error('[gemini-pool] Bad request (400) — error dari prompt', { error: error.message });
          throw error;
        }

        // 401/403: Auth error — key invalid
        if (error.status === 401 || error.status === 403) {
          logger.error(`[gemini-pool] ${key.id} auth error — key mungkin invalid`, { error: error.message });
          continue; // Coba key lain
        }

        // 429: Rate limit — langsung coba key lain
        if (error.status === 429 || error.message?.includes('429')) {
          logger.warn(`[gemini-pool] ${key.id} rate limit, switch key`);
          continue;
        }

        // 503: Service unavailable — tunggu sebentar
        if (error.status === 503) {
          logger.warn(`[gemini-pool] Gemini 503, tunggu 5 detik...`);
          await sleep(5000);
          continue;
        }

        // Network error — retry
        if (['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) {
          logger.warn(`[gemini-pool] Network error: ${error.code}, retry...`);
          await sleep(2000 * attempt);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Gemini generate gagal setelah semua percobaan');
  }

  /**
   * Parse JSON dari response Gemini (handle markdown code blocks)
   * @param {string} text
   * @returns {any} Parsed JSON
   */
  parseJsonResponse(text) {
    if (!text) throw new Error('Response kosong dari Gemini');

    // Hapus markdown code blocks jika ada
    let cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    // Coba parse langsung
    try {
      return JSON.parse(cleaned);
    } catch {
      // Cari JSON dalam teks
      const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error(`Gagal parse JSON dari response: ${cleaned.substring(0, 200)}`);
    }
  }

  // ─────────────────────────────────────────────
  // GENERATE IMAGE (Imagen 3)
  // ─────────────────────────────────────────────

  /**
   * Generate gambar via Imagen 3
   * @param {string} prompt - Image prompt dalam Bahasa Inggris
   * @returns {Promise<Buffer>} Image buffer (PNG/JPEG dari API)
   */
  async generateImage(prompt) {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      let key;
      try {
        key = this.getNextKey();
      } catch (err) {
        throw err;
      }

      const startTime = Date.now();

      try {
        const genAI = new GoogleGenerativeAI(key.key);
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL_NAME });

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
          },
        });

        const response = result.response;
        const parts = response.candidates[0]?.content?.parts;
        const imagePart = parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));

        if (!imagePart) {
          throw new Error('Imagen 3 tidak menghasilkan gambar');
        }

        const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
        const latencyMs = Date.now() - startTime;
        this._recordSuccess(key, latencyMs);

        logger.gemini(`Image generated dengan ${key.id}`, {
          latencyMs,
          sizeKB: Math.round(imageBuffer.length / 1024),
        });

        return {
          buffer: imageBuffer,
          mimeType: imagePart.inlineData.mimeType,
        };

      } catch (error) {
        this._recordError(key, error);
        lastError = error;

        if (error.status === 400) throw error; // Bad prompt

        await sleep(3000 * attempt);
      }
    }

    throw lastError || new Error('Imagen 3 gagal generate gambar');
  }

  // ─────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────

  /**
   * Health check semua key (ping dengan request minimal)
   * Dijalankan setiap jam via scheduler
   */
  async healthCheck() {
    logger.info('[gemini-pool] Mulai health check semua key...');
    const results = [];

    for (const key of this.keys) {
      if (key.status === 'disabled' && key.disabledUntil && Date.now() < key.disabledUntil.getTime()) {
        results.push({ id: key.id, status: 'disabled', skipped: true });
        continue;
      }

      try {
        const genAI = new GoogleGenerativeAI(key.key);
        const model = genAI.getGenerativeModel({
          model: MODEL_NAME,
          generationConfig: { maxOutputTokens: 10 },
        });

        const start = Date.now();
        await model.generateContent('Respond with: OK');
        const latency = Date.now() - start;

        // Key masih aktif
        if (key.status !== 'active') {
          key.status = 'active';
          key.errorStreak = 0;
        }

        results.push({ id: key.id, status: 'active', latencyMs: latency });
        logger.gemini(`Health check ${key.id}: OK (${latency}ms)`);

      } catch (error) {
        const status = error.status === 429 ? 'rate_limited' :
                       error.status === 401 ? 'invalid' : 'error';

        results.push({ id: key.id, status, error: error.message });
        logger.warn(`[gemini-pool] Health check ${key.id}: ${status}`, { error: error.message });
      }
    }

    this._saveState();

    const active = results.filter(r => r.status === 'active').length;
    logger.info(`[gemini-pool] Health check selesai: ${active}/${this.keys.length} aktif`);

    return results;
  }

  /**
   * Reset daily counter — dipanggil setiap jam 00.00 WIB
   */
  resetDailyCounters() {
    logger.info('[gemini-pool] Reset daily counters...');
    this.keys.forEach(key => {
      key.dailyUsed = 0;
      key.errorStreak = 0;
      if (key.status === 'exhausted') key.status = 'active';
    });
    this._saveState();
    logger.info('[gemini-pool] Daily counters berhasil direset');
  }

  /**
   * Hitung waktu cooldown terpendek dari semua key
   * @returns {number} ms sampai key pertama tersedia
   */
  _getShortestCooldown() {
    const now = Date.now();
    let shortest = Infinity;

    for (const key of this.keys) {
      if (key.cooldownUntil) {
        const remaining = key.cooldownUntil.getTime() - now;
        if (remaining > 0) shortest = Math.min(shortest, remaining);
      }
      if (key.disabledUntil) {
        const remaining = key.disabledUntil.getTime() - now;
        if (remaining > 0) shortest = Math.min(shortest, remaining);
      }
    }

    return shortest === Infinity ? 0 : shortest;
  }

  /**
   * Dapatkan status semua key untuk dashboard
   * @returns {Array}
   */
  getStatus() {
    return this.keys.map(k => ({
      id: k.id,
      status: k.status,
      dailyUsed: k.dailyUsed,
      dailyLimit: k.dailyLimit,
      usagePercent: Math.round((k.dailyUsed / k.dailyLimit) * 100),
      errorStreak: k.errorStreak,
      cooldownUntil: k.cooldownUntil?.toISOString() || null,
      disabledUntil: k.disabledUntil?.toISOString() || null,
      lastUsed: k.lastUsed?.toISOString() || null,
      lastError: k.lastError,
      totalSuccess: k.totalSuccess,
      totalError: k.totalError,
    }));
  }

  /**
   * Dapatkan statistik ringkas pool
   */
  getSummary() {
    const active = this.keys.filter(k => k.status === 'active').length;
    const exhausted = this.keys.filter(k => k.status === 'exhausted').length;
    const disabled = this.keys.filter(k => k.status === 'disabled').length;
    const cooldown = this.keys.filter(k => k.status === 'cooldown').length;
    const totalUsed = this.keys.reduce((sum, k) => sum + k.dailyUsed, 0);
    const totalLimit = this.keys.reduce((sum, k) => sum + k.dailyLimit, 0);

    return {
      total: this.keys.length,
      active,
      exhausted,
      disabled,
      cooldown,
      totalUsed,
      totalLimit,
      usagePercent: totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0,
    };
  }

  // Inject dependencies setelah konstruksi
  setTelegramNotifier(notifier) { this._telegramNotifier = notifier; }
  setDatabase(db) { this._db = db; }
}

// Singleton instance
let _instance = null;

function getInstance() {
  if (!_instance) {
    _instance = new GeminiPool();
  }
  return _instance;
}

module.exports = { GeminiPool, getInstance };
