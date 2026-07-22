'use strict';

/**
 * R2Client — Upload file ke Cloudflare R2 via HTTP langsung
 *
 * Menggunakan aws4 untuk AWS Signature V4 signing + node-fetch untuk HTTP.
 * Tidak perlu @aws-sdk/client-s3 (menghindari fast-xml-parser CVE).
 *
 * Fitur:
 * - Upload gambar cover artikel: resize 1280×720 WebP, max 500KB
 * - Upload avatar author: 400×400 WebP
 * - Upload backup file ke R2
 * - Retry pada network failure
 * - Generate public URL dari R2
 */

const aws4 = require('aws4');
const fetch = require('node-fetch');
const sharp = require('sharp');
const logger = require('../utils/logger');
const { sleep } = require('../utils/retryHelper');
const { formatDateSlug } = require('../utils/dateHelper');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'joben-news';
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Target spesifikasi gambar
const COVER_WIDTH = 1280;
const COVER_HEIGHT = 720;
const COVER_QUALITY = 85;
const COVER_MAX_SIZE_KB = 500;
const AVATAR_SIZE = 400;
const AVATAR_QUALITY = 90;
const MAX_RETRIES = 3;

class R2Client {
  constructor() {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      logger.warn('[r2] Kredensial R2 tidak lengkap — upload tidak akan berfungsi');
    }

    // Parse endpoint untuk aws4 signing
    try {
      const url = new URL(R2_ENDPOINT);
      this._host = url.hostname;
      this._protocol = url.protocol;
    } catch {
      this._host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      this._protocol = 'https:';
    }
  }

  // ─────────────────────────────────────────────
  // UPLOAD CORE
  // ─────────────────────────────────────────────

  /**
   * Upload buffer ke R2 via signed HTTP PUT
   * @param {Buffer} buffer
   * @param {string} key - Object key (path di bucket)
   * @param {string} contentType
   * @param {Object} metadata - Custom header metadata
   * @returns {Promise<void>}
   */
  async _uploadBuffer(buffer, key, contentType, metadata = {}) {
    const path = `/${R2_BUCKET_NAME}/${key}`;

    // Header dasar
    const headers = {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [
          k.startsWith('x-amz-meta-') ? k : `x-amz-meta-${k}`,
          v
        ])
      ),
    };

    // Sign request dengan aws4
    const signed = aws4.sign({
      service: 's3',
      region: 'auto',
      method: 'PUT',
      host: this._host,
      path,
      headers,
      body: buffer,
    }, {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    });

    const url = `${this._protocol}//${this._host}${path}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: signed.headers,
          body: buffer,
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`R2 HTTP ${response.status}: ${body.substring(0, 200)}`);
        }

        return; // Success

      } catch (err) {
        if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
          logger.warn(`[r2] Upload retry ${attempt}/${MAX_RETRIES}: ${err.message}`);
          await sleep(3000 * attempt);
          continue;
        }
        throw err;
      }
    }
  }

  // ─────────────────────────────────────────────
  // ARTICLE COVER IMAGE
  // ─────────────────────────────────────────────

  /**
   * Upload cover artikel: resize 1280×720 WebP, max 500KB
   * @param {Buffer} imageBuffer - Raw image buffer dari Imagen 3
   * @param {string} slug - Slug artikel
   * @param {string} mimeType - Original MIME type
   * @returns {Promise<{url: string, key: string, sizeKB: number}>}
   */
  async uploadArticleCover(imageBuffer, slug, mimeType = 'image/png') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `covers/${year}/${month}/${slug}.webp`;

    const processedBuffer = await this._processArticleImage(imageBuffer);
    const sizeKB = Math.round(processedBuffer.length / 1024);

    logger.r2(`Upload cover: ${key} (${sizeKB}KB)`);

    await this._uploadBuffer(processedBuffer, key, 'image/webp', {
      'article-slug': slug,
      'type': 'article-cover',
    });

    const url = this._getPublicUrl(key);
    logger.r2(`Cover uploaded ✓ ${url} (${sizeKB}KB)`);

    return { url, key, sizeKB };
  }

  /**
   * Process gambar artikel: resize + WebP + compress
   * @param {Buffer} inputBuffer
   * @returns {Promise<Buffer>}
   */
  async _processArticleImage(inputBuffer) {
    try {
      const metadata = await sharp(inputBuffer).metadata();
      logger.r2(`Original: ${metadata.width}×${metadata.height} ${metadata.format} (${Math.round(inputBuffer.length / 1024)}KB)`);

      let webpBuffer = await sharp(inputBuffer)
        .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'cover', position: 'center' })
        .webp({ quality: COVER_QUALITY, effort: 4 })
        .toBuffer();

      // Jika masih terlalu besar, reduce quality secara bertahap
      if (webpBuffer.length > COVER_MAX_SIZE_KB * 1024) {
        logger.r2(`Terlalu besar (${Math.round(webpBuffer.length / 1024)}KB), reduce quality...`);

        for (let q = COVER_QUALITY - 10; q >= 50; q -= 10) {
          webpBuffer = await sharp(inputBuffer)
            .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'cover', position: 'center' })
            .webp({ quality: q, effort: 4 })
            .toBuffer();

          if (webpBuffer.length <= COVER_MAX_SIZE_KB * 1024) {
            logger.r2(`Quality ${q}% → ${Math.round(webpBuffer.length / 1024)}KB OK`);
            break;
          }
        }
      }

      return webpBuffer;
    } catch (err) {
      logger.error('[r2] Image processing gagal', { error: err.message });
      throw new Error(`Image processing gagal: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // AUTHOR AVATAR
  // ─────────────────────────────────────────────

  /**
   * Upload avatar author: 400×400 WebP
   * @param {Buffer} imageBuffer
   * @param {string} authorSlug
   * @returns {Promise<{url: string, key: string}>}
   */
  async uploadAuthorAvatar(imageBuffer, authorSlug) {
    const key = `authors/${authorSlug}/avatar.webp`;

    const processedBuffer = await sharp(imageBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'center' })
      .webp({ quality: AVATAR_QUALITY })
      .toBuffer();

    await this._uploadBuffer(processedBuffer, key, 'image/webp', {
      'type': 'author-avatar',
      'author-slug': authorSlug,
    });

    const url = this._getPublicUrl(key);
    logger.r2(`Avatar uploaded ✓ ${url}`);

    return { url, key };
  }

  // ─────────────────────────────────────────────
  // BACKUP
  // ─────────────────────────────────────────────

  /**
   * Upload file backup ke R2
   * @param {Buffer|string} content
   * @param {string} type - 'db' | 'state' | 'config'
   * @param {string} extension
   * @returns {Promise<{url: string, key: string}>}
   */
  async uploadBackup(content, type, extension) {
    const dateStr = formatDateSlug(new Date());
    const key = `backups/${type}/${dateStr}.${extension}`;
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const contentType = extension === 'db' ? 'application/octet-stream' : 'application/json';

    await this._uploadBuffer(buffer, key, contentType);

    const url = this._getPublicUrl(key);
    logger.r2(`Backup uploaded ✓ ${key} (${Math.round(buffer.length / 1024)}KB)`);

    return { url, key };
  }

  // ─────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────

  /**
   * Generate public URL untuk key di R2
   */
  _getPublicUrl(key) {
    if (R2_PUBLIC_URL) {
      return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    }
    return `${this._protocol}//${this._host}/${R2_BUCKET_NAME}/${key}`;
  }

  getPublicUrl(key) {
    return this._getPublicUrl(key);
  }

  /**
   * Test koneksi R2 dengan upload file kecil
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const testKey = `_test/connection-${Date.now()}.txt`;
      const buffer = Buffer.from(`connection test ${Date.now()}`);

      await this._uploadBuffer(buffer, testKey, 'text/plain');

      // Hapus test file
      await this._deleteObject(testKey).catch(() => {});

      logger.r2('Test koneksi R2 berhasil ✓');
      return true;
    } catch (err) {
      logger.error('[r2] Test koneksi gagal', { error: err.message });
      return false;
    }
  }

  /**
   * Hapus object dari R2
   * @param {string} key
   */
  async _deleteObject(key) {
    const path = `/${R2_BUCKET_NAME}/${key}`;
    const signed = aws4.sign({
      service: 's3',
      region: 'auto',
      method: 'DELETE',
      host: this._host,
      path,
    }, {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    });

    await fetch(`${this._protocol}//${this._host}${path}`, {
      method: 'DELETE',
      headers: signed.headers,
    });
  }
}

// Singleton
let _instance = null;

function getInstance() {
  if (!_instance) {
    _instance = new R2Client();
  }
  return _instance;
}

module.exports = { R2Client, getInstance };
