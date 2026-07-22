'use strict';

/**
 * StrapiClient — Wrapper lengkap Strapi v5 REST API
 *
 * Fitur:
 * - CRUD artikel, kategori, tag, author, media
 * - Strapi v5 flat response shape (data.documentId)
 * - Resolve atau create relasi (tags, kategori)
 * - ISR revalidation trigger
 * - Circuit breaker pattern untuk Strapi downtime
 * - Retry dengan exponential backoff
 * - Full logging setiap request
 */

const fetch = require('node-fetch');
const logger = require('../utils/logger');
const { withStrapiRetry, createCircuitBreaker } = require('../utils/retryHelper');

const STRAPI_URL = process.env.STRAPI_API_URL || 'http://localhost:3001';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN || '';
const NEXTJS_REVALIDATION_URL = process.env.NEXTJS_REVALIDATION_URL || '';
const NEXTJS_REVALIDATION_SECRET = process.env.NEXTJS_REVALIDATION_SECRET || '';
const REQUEST_TIMEOUT_MS = 30000;

class StrapiClient {
  constructor() {
    this._breaker = createCircuitBreaker({ threshold: 3, resetTimeMs: 10 * 60 * 1000 });
    this._categoryCache = new Map(); // slug → { id, documentId }
    this._tagCache = new Map();      // name → { id, documentId }
    this._authorCache = new Map();   // slug → { id, documentId }
  }

  // ─────────────────────────────────────────────
  // HTTP CORE
  // ─────────────────────────────────────────────

  /**
   * Request HTTP ke Strapi dengan auth token
   * @param {string} endpoint - Path setelah /api/ (e.g. "articles")
   * @param {Object} options - fetch options
   * @returns {Promise<any>} Parsed JSON response
   */
  async _request(endpoint, options = {}) {
    if (this._breaker.isOpen()) {
      throw new Error('STRAPI_CIRCUIT_OPEN: Strapi tidak tersedia sementara');
    }

    const url = `${STRAPI_URL}/api/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_TOKEN}`,
      ...options.headers,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      logger.strapi(`→ ${options.method || 'GET'} /api/${endpoint}`);
      const startTime = Date.now();

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        const err = new Error(`Strapi HTTP ${response.status}: ${errorBody.substring(0, 200)}`);
        err.status = response.status;
        err.body = errorBody;
        throw err;
      }

      const data = await response.json();
      this._breaker.recordSuccess();
      logger.strapi(`← ${response.status} /api/${endpoint} (${latency}ms)`);
      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Strapi request timeout');
        timeoutErr.code = 'ETIMEDOUT';
        this._breaker.recordFailure();
        throw timeoutErr;
      }

      if (error.status >= 500 || error.code === 'ECONNREFUSED') {
        this._breaker.recordFailure();
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async _get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this._request(url, { method: 'GET' });
  }

  async _post(endpoint, body) {
    return this._request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async _put(endpoint, body) {
    return this._request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async _delete(endpoint) {
    return this._request(endpoint, { method: 'DELETE' });
  }

  // ─────────────────────────────────────────────
  // ARTIKEL
  // ─────────────────────────────────────────────

  /**
   * Buat artikel baru di Strapi
   * @param {Object} articleData - Data artikel lengkap
   * @returns {Promise<Object>} Article data dari Strapi (flat v5 shape)
   */
  async createArticle(articleData) {
    return withStrapiRetry(async () => {
      const payload = {
        data: {
          title: articleData.title,
          slug: articleData.slug,
          excerpt: articleData.excerpt,
          content: articleData.content,
          cover: articleData.coverId ? { id: articleData.coverId } : undefined,
          author: articleData.authorId ? { id: articleData.authorId } : undefined,
          category: articleData.categoryId ? { id: articleData.categoryId } : undefined,
          subcategory: articleData.subcategoryId ? { id: articleData.subcategoryId } : undefined,
          tags: articleData.tagIds?.map(id => ({ id })) || [],
          seo: articleData.seo,
          source_url: articleData.source_url,
          source_attribution: articleData.source_attribution,
          is_breaking_news: articleData.is_breaking_news || false,
          editorial_status: articleData.editorial_status || 'published',
          publishedAt: articleData.publishedAt || new Date().toISOString(),
        },
      };

      // Hapus field undefined
      Object.keys(payload.data).forEach(k => {
        if (payload.data[k] === undefined) delete payload.data[k];
      });

      const response = await this._post('articles', payload);
      const article = response.data;

      logger.publisher(`Artikel dibuat: ${article.title}`, {
        id: article.id,
        documentId: article.documentId,
        slug: article.slug,
      });

      return article;
    }, { context: 'createArticle' });
  }

  /**
   * Update artikel yang sudah ada
   * @param {string} documentId - Strapi v5 documentId
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updateArticle(documentId, updateData) {
    return withStrapiRetry(async () => {
      const response = await this._put(`articles/${documentId}`, { data: updateData });
      return response.data;
    }, { context: 'updateArticle' });
  }

  /**
   * Ambil artikel berdasarkan documentId
   * @param {string} documentId
   * @param {Object} populate - Strapi populate options
   * @returns {Promise<Object>}
   */
  async getArticle(documentId, populate = {}) {
    return withStrapiRetry(async () => {
      const params = {};
      if (Object.keys(populate).length) {
        params.populate = JSON.stringify(populate);
      }
      const response = await this._get(`articles/${documentId}`, params);
      return response.data;
    }, { context: 'getArticle' });
  }

  /**
   * Ambil artikel terbaru untuk internal linking / duplikasi check
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getRecentArticles({ limit = 20, fields = ['title', 'slug', 'excerpt', 'category'] } = {}) {
    return withStrapiRetry(async () => {
      const params = {
        'sort[0]': 'publishedAt:desc',
        'pagination[limit]': limit,
        'fields': fields.join(','),
        'filters[editorial_status][$eq]': 'published',
      };

      const response = await this._get('articles', params);
      return response.data || [];
    }, { context: 'getRecentArticles' });
  }

  /**
   * Cek duplikasi berdasarkan judul similarity (ambil articles 72 jam terakhir)
   * @param {number} hours
   * @returns {Promise<Array>}
   */
  async getArticlesLast72Hours(hours = 72) {
    return withStrapiRetry(async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const params = {
        'filters[publishedAt][$gte]': since,
        'fields': 'title,slug,excerpt',
        'pagination[limit]': 200,
        'sort[0]': 'publishedAt:desc',
      };

      const response = await this._get('articles', params);
      return response.data || [];
    }, { context: 'getArticlesLast72Hours' });
  }

  // ─────────────────────────────────────────────
  // KATEGORI
  // ─────────────────────────────────────────────

  /**
   * Resolve kategori berdasarkan nama/slug
   * Gunakan cache untuk menghindari request berulang
   * @param {string} categoryName
   * @param {string} subcategoryName
   * @returns {Promise<{categoryId: number, subcategoryId: number|null}>}
   */
  async resolveCategory(categoryName, subcategoryName = null) {
    // Load semua kategori ke cache jika belum
    if (this._categoryCache.size === 0) {
      await this._loadCategoryCache();
    }

    const catKey = categoryName.toLowerCase().trim();
    let categoryId = this._categoryCache.get(catKey)?.id;

    if (!categoryId) {
      logger.warn(`[strapi] Kategori tidak ditemukan: ${categoryName}`);
      // Coba refresh cache dan cari lagi
      await this._loadCategoryCache();
      categoryId = this._categoryCache.get(catKey)?.id;
    }

    let subcategoryId = null;
    if (subcategoryName && categoryId) {
      const subKey = `${categoryId}_${subcategoryName.toLowerCase().trim()}`;
      subcategoryId = this._categoryCache.get(subKey)?.id || null;
    }

    return { categoryId, subcategoryId };
  }

  async _loadCategoryCache() {
    try {
      const response = await this._get('categories', {
        'pagination[limit]': 100,
        'populate[subcategories]': '*',
      });

      const categories = response.data || [];
      this._categoryCache.clear();

      for (const cat of categories) {
        this._categoryCache.set(cat.name.toLowerCase(), { id: cat.id, documentId: cat.documentId });
        this._categoryCache.set(cat.slug, { id: cat.id, documentId: cat.documentId });

        // Subcategories
        const subs = cat.subcategories?.data || cat.subcategories || [];
        for (const sub of subs) {
          const subKey = `${cat.id}_${sub.name.toLowerCase()}`;
          this._categoryCache.set(subKey, { id: sub.id, documentId: sub.documentId });
        }
      }

      logger.strapi(`Category cache loaded: ${categories.length} kategori`);
    } catch (err) {
      logger.error('[strapi] Gagal load category cache', { error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // TAGS
  // ─────────────────────────────────────────────

  /**
   * Resolve atau buat tags berdasarkan nama
   * @param {string[]} tagNames
   * @returns {Promise<number[]>} Array of tag IDs
   */
  async resolveOrCreateTags(tagNames) {
    if (!tagNames || tagNames.length === 0) return [];

    const tagIds = [];

    for (const tagName of tagNames) {
      const normalized = tagName.trim();
      if (!normalized) continue;

      const cacheKey = normalized.toLowerCase();

      // Cek cache
      if (this._tagCache.has(cacheKey)) {
        tagIds.push(this._tagCache.get(cacheKey).id);
        continue;
      }

      // Cari di Strapi
      try {
        const searchRes = await this._get('tags', {
          'filters[name][$eqi]': normalized,
          'pagination[limit]': 1,
        });

        const existing = searchRes.data?.[0];
        if (existing) {
          this._tagCache.set(cacheKey, { id: existing.id, documentId: existing.documentId });
          tagIds.push(existing.id);
          continue;
        }

        // Buat tag baru
        const createRes = await this._post('tags', {
          data: {
            name: normalized,
            slug: normalized.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          },
        });

        const newTag = createRes.data;
        this._tagCache.set(cacheKey, { id: newTag.id, documentId: newTag.documentId });
        tagIds.push(newTag.id);
        logger.strapi(`Tag baru dibuat: "${normalized}" (id: ${newTag.id})`);

      } catch (err) {
        logger.warn(`[strapi] Gagal resolve/create tag "${normalized}"`, { error: err.message });
      }
    }

    return tagIds;
  }

  // ─────────────────────────────────────────────
  // AUTHORS
  // ─────────────────────────────────────────────

  /**
   * Cari author berdasarkan slug/nama
   * @param {string} slugOrName
   * @returns {Promise<Object|null>}
   */
  async findAuthor(slugOrName) {
    const cacheKey = slugOrName.toLowerCase();
    if (this._authorCache.has(cacheKey)) {
      return this._authorCache.get(cacheKey);
    }

    try {
      const response = await this._get('authors', {
        'filters[$or][0][slug][$eq]': slugOrName,
        'filters[$or][1][name][$containsi]': slugOrName,
        'pagination[limit]': 1,
      });

      const author = response.data?.[0] || null;
      if (author) {
        this._authorCache.set(cacheKey, author);
      }
      return author;
    } catch (err) {
      logger.warn(`[strapi] Gagal find author "${slugOrName}"`, { error: err.message });
      return null;
    }
  }

  /**
   * Load semua authors ke cache
   * @returns {Promise<Array>}
   */
  async getAllAuthors() {
    try {
      const response = await this._get('authors', { 'pagination[limit]': 50 });
      const authors = response.data || [];

      for (const author of authors) {
        this._authorCache.set(author.slug, author);
        this._authorCache.set(author.name.toLowerCase(), author);
      }

      return authors;
    } catch (err) {
      logger.error('[strapi] Gagal load authors', { error: err.message });
      return [];
    }
  }

  /**
   * Buat author baru di Strapi
   * @param {Object} authorData
   * @returns {Promise<Object>}
   */
  async createAuthor(authorData) {
    return withStrapiRetry(async () => {
      const response = await this._post('authors', { data: authorData });
      const author = response.data;
      this._authorCache.set(author.slug, author);
      logger.strapi(`Author dibuat: ${author.name} (id: ${author.id})`);
      return author;
    }, { context: 'createAuthor' });
  }

  // ─────────────────────────────────────────────
  // MEDIA (Cover Image)
  // ─────────────────────────────────────────────

  /**
   * Buat media entry di Strapi untuk gambar yang sudah di-upload ke R2
   * Strapi menyimpan referensi ke URL eksternal
   * @param {Object} params
   * @returns {Promise<Object>} Media entry
   */
  async createExternalMedia({ url, name, alternativeText, caption }) {
    return withStrapiRetry(async () => {
      // Gunakan Strapi's upload endpoint dengan URL eksternal
      const FormData = require('form-data');
      const fetchModule = require('node-fetch');

      const formData = new FormData();
      formData.append('fileInfo', JSON.stringify({
        name,
        alternativeText: alternativeText || name,
        caption: caption || '',
        url,
      }));

      // Upload via URL reference (Strapi v5 supports external URL)
      const response = await this._post('upload', {
        fileInfo: {
          name,
          alternativeText: alternativeText || name,
          caption: caption || '',
        },
        url,
      });

      return response;
    }, { context: 'createExternalMedia' });
  }

  /**
   * Register URL R2 ke Strapi media library (alias untuk publisher)
   * @param {Object} params - { url, name, alternativeText, caption }
   * @returns {Promise<Object>} Media entry dengan field id
   */
  async uploadMediaFromUrl({ url, name, alternativeText, caption }) {
    try {
      // Strapi v5: buat media entry dengan URL eksternal via upload endpoint
      const fetchModule = require('node-fetch');
      const FormData = require('form-data');

      // Fetch image dari URL
      const imgResp = await fetchModule(url, { signal: AbortSignal.timeout(20000) });
      if (!imgResp.ok) throw new Error(`Gagal fetch image dari R2: ${imgResp.status}`);

      const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
      const contentType = imgResp.headers.get('content-type') || 'image/webp';
      const filename = name.endsWith('.webp') ? name : `${name}.webp`;

      const formData = new FormData();
      formData.append('files', imgBuffer, { filename, contentType });
      formData.append('fileInfo', JSON.stringify({
        name,
        alternativeText: alternativeText || name,
        caption: caption || '',
      }));

      const strapiUrl = `${STRAPI_URL}/api/upload`;
      const response = await fetchModule(strapiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRAPI_TOKEN}`,
          ...formData.getHeaders(),
        },
        body: formData,
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Upload gagal: ${response.status} — ${errText.substring(0, 200)}`);
      }

      const data = await response.json();
      const media = Array.isArray(data) ? data[0] : data;
      logger.strapi(`Media uploaded ke Strapi: id=${media.id}, url=${url}`);
      return media;

    } catch (err) {
      logger.warn('[strapi] Gagal upload media dari URL (lanjut tanpa cover)', { error: err.message });
      return null;
    }
  }

  /**
   * Upload file ke Strapi media library langsung
   * @param {Buffer} fileBuffer
   * @param {string} filename
   * @param {string} mimeType
   * @param {Object} fileInfo
   * @returns {Promise<Object>} Uploaded media
   */
  async uploadMedia(fileBuffer, filename, mimeType, fileInfo = {}) {
    const FormData = require('form-data');
    const fetchModule = require('node-fetch');

    const formData = new FormData();
    formData.append('files', fileBuffer, {
      filename,
      contentType: mimeType,
    });
    formData.append('fileInfo', JSON.stringify(fileInfo));

    const url = `${STRAPI_URL}/api/upload`;

    try {
      const response = await fetchModule(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRAPI_TOKEN}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Upload gagal: ${response.status} — ${err}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (err) {
      logger.error('[strapi] Gagal upload media', { error: err.message });
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // ISR REVALIDATION
  // ─────────────────────────────────────────────

  /**
   * Trigger ISR revalidation di Next.js setelah artikel publish
   * @param {string} slug - Slug artikel yang baru dipublish
   * @returns {Promise<boolean>}
   */
  async triggerRevalidation(slug = '') {
    if (!NEXTJS_REVALIDATION_URL || !NEXTJS_REVALIDATION_SECRET) {
      logger.warn('[strapi] Revalidation URL atau Secret tidak dikonfigurasi, skip');
      return false;
    }

    try {
      const url = `${NEXTJS_REVALIDATION_URL}?secret=${NEXTJS_REVALIDATION_SECRET}&path=/artikel/${slug}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        logger.publisher(`ISR revalidation berhasil: /artikel/${slug}`);
        return true;
      }

      logger.warn(`[strapi] ISR revalidation gagal: ${response.status}`);
      return false;
    } catch (err) {
      // ISR bukan critical — log saja, jangan throw
      logger.warn('[strapi] ISR revalidation error (non-critical)', { error: err.message });
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────

  /**
   * Hitung total artikel published hari ini
   * @returns {Promise<number>}
   */
  async getTodayArticleCount() {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const response = await this._get('articles', {
        'filters[publishedAt][$gte]': todayStart.toISOString(),
        'filters[editorial_status][$eq]': 'published',
        'pagination[limit]': 1,
        'pagination[withCount]': 'true',
      });

      return response.meta?.pagination?.total || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Dapatkan status circuit breaker
   */
  getBreakerStatus() {
    return this._breaker.getStatus();
  }

  /**
   * Reset cache kategori dan tag (pakai saat data Strapi berubah)
   */
  clearCache() {
    this._categoryCache.clear();
    this._tagCache.clear();
    this._authorCache.clear();
    logger.strapi('Cache dibersihkan');
  }
}

// Singleton
let _instance = null;

function getInstance() {
  if (!_instance) {
    _instance = new StrapiClient();
  }
  return _instance;
}

module.exports = { StrapiClient, getInstance };
