'use strict';

/**
 * Publisher Agent — Post artikel ke Strapi + notifikasi
 *
 * Proses:
 * 1. Upload image ke Strapi media library (referensi ke R2 URL)
 * 2. Resolve author ID dari mapping
 * 3. Resolve category + subcategory ID
 * 4. Resolve atau buat tags
 * 5. Hitung jadwal publish (timeManager)
 * 6. POST artikel ke Strapi
 * 7. Trigger ISR revalidation Next.js
 * 8. Catat ke SQLite
 * 9. Update state.json
 * 10. Notifikasi Telegram
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { todayWIB } = require('../utils/dateHelper');
const authorsConfig = require('../config/authors.json');

const STATE_FILE = path.join(__dirname, '../../data/state.json');

class PublisherAgent {
  constructor({ strapiClient, telegramNotifier, db, timeManager, settings }) {
    this.strapi = strapiClient;
    this.telegram = telegramNotifier;
    this.db = db;
    this.timeManager = timeManager;
    this.settings = settings;
  }

  /**
   * Publish artikel ke Strapi
   * @param {Object} article - Artikel dari Writer + QualityGate
   * @param {Object|null} imageResult - Hasil dari ImageGen { url, r2Key }
   * @returns {Promise<Object>} Artikel yang berhasil dipublish
   */
  async run(article, imageResult = null) {
    const startTime = Date.now();
    logger.publisher(`Memulai publish: "${article.title}"`);

    // 1. Upload/register cover image ke Strapi
    let coverId = null;
    if (imageResult?.url) {
      try {
        const media = await this.strapi.uploadMediaFromUrl({
          url: imageResult.url,
          name: `${article.slug}-cover`,
          alternativeText: article.title,
          caption: `Ilustrasi: ${article.title}`,
        });
        coverId = media?.id || null;
        logger.publisher(`Cover media registered: ID ${coverId}`);
      } catch (err) {
        logger.warn('[publisher] Gagal register cover image (lanjut tanpa cover)', { error: err.message });
      }
    }

    // 2. Resolve author ID
    const authorId = await this._resolveAuthorId(article.author, article.category);

    // 3. Resolve category + subcategory
    const { categoryId, subcategoryId } = await this.strapi.resolveCategory(
      article.category,
      article.subcategory
    );

    // 4. Resolve/buat tags
    const tagIds = await this.strapi.resolveOrCreateTags(article.tags || []);

    // 5. Hitung jadwal publish
    const publishedAt = this.timeManager
      ? this.timeManager.getNextPublishSlot()
      : new Date().toISOString();

    // 6. POST ke Strapi
    const strapiPayload = {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      coverId,
      authorId,
      categoryId,
      subcategoryId,
      tagIds,
      seo: {
        metaTitle: article.seo_title || article.title,
        metaDescription: article.seo_description,
        keywords: article.focus_keyword,
      },
      source_url: article.source_url,
      source_attribution: article.source_attribution,
      is_breaking_news: article.content_type === 'breaking',
      editorial_status: 'published',
      publishedAt,
    };

    let created;
    try {
      created = await this.strapi.createArticle(strapiPayload);
    } catch (err) {
      logger.error('[publisher] Gagal POST ke Strapi', { error: err.message });

      // Catat ke SQLite sebagai failed
      this._recordToDb({
        article,
        status: 'failed',
        errorMsg: err.message,
        startTime,
      });

      throw err;
    }

    // 7. Trigger ISR revalidation (non-critical)
    try {
      await this.strapi.triggerRevalidation(article.slug);
    } catch (err) {
      logger.warn('[publisher] ISR revalidation gagal (non-critical)', { error: err.message });
    }

    // 8. Catat ke SQLite
    await this._recordToDb({
      article,
      strapiArticle: created,
      imageResult,
      status: 'published',
      publishedAt,
      startTime,
    });

    // 9. Update state.json
    await this._updateState(article.content_type === 'breaking');

    // 10. Notifikasi Telegram
    const articleUrl = `${process.env.NEXTJS_PUBLIC_URL || 'https://news.jobenapp.cloud'}/artikel/${article.slug}`;
    if (this.telegram && this.settings.telegram.notifyOnPublish) {
      const isBreaking = article.content_type === 'breaking';

      if (isBreaking && this.settings.telegram.notifyOnBreaking) {
        await this.telegram.notifyBreakingPublished({
          title: article.title,
          category: article.category,
          url: articleUrl,
        }).catch(() => {});
      } else if (!isBreaking) {
        await this.telegram.notifyPublished({
          title: article.title,
          category: article.category,
          url: articleUrl,
        }).catch(() => {});
      }
    }

    const elapsed = Date.now() - startTime;
    logger.publisher(`✅ Artikel published dalam ${elapsed}ms: "${article.title}"`, {
      strapiId: created.id,
      documentId: created.documentId,
      url: articleUrl,
    });

    return {
      ...created,
      url: articleUrl,
      generationMs: elapsed,
    };
  }

  /**
   * Resolve Strapi author ID dari config + cache Strapi
   */
  async _resolveAuthorId(authorMeta, category) {
    // Coba dari strapiId yang sudah di-seed
    if (authorMeta?.strapiId) return authorMeta.strapiId;

    // Cari via config mapping
    const mapping = authorsConfig.categoryMapping;
    const authorConfigId = mapping[category] || 'A01';
    const authorConfig = authorsConfig.authors.find(a => a.id === authorConfigId);

    if (authorConfig?.strapiId) return authorConfig.strapiId;

    // Cari di Strapi by slug
    if (authorConfig) {
      const strapiAuthor = await this.strapi.findAuthor(authorConfig.slug);
      if (strapiAuthor) {
        // Update config in-memory
        authorConfig.strapiId = strapiAuthor.id;
        return strapiAuthor.id;
      }
    }

    logger.warn(`[publisher] Author tidak ditemukan untuk kategori "${category}", publish tanpa author`);
    return null;
  }

  /**
   * Catat artikel ke SQLite published.db
   */
  _recordToDb({ article, strapiArticle, imageResult, status, errorMsg, publishedAt, startTime }) {
    if (!this.db) return;

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO articles (
          strapi_id, strapi_doc_id, title, slug, category, subcategory,
          author_name, source_url, source_name, word_count, quality_score,
          published_at, status, error_msg, generation_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        strapiArticle?.id?.toString() || null,
        strapiArticle?.documentId || null,
        article.title,
        article.slug,
        article.category || '',
        article.subcategory || '',
        article.author?.name || '',
        article.source_url || '',
        article.source_attribution || '',
        article.word_count || 0,
        article._qualityScore || 0,
        publishedAt || new Date().toISOString(),
        status,
        errorMsg || null,
        startTime ? Date.now() - startTime : null
      );
    } catch (err) {
      logger.warn('[publisher] Gagal catat ke SQLite', { error: err.message });
    }
  }

  /**
   * Update state.json setelah publish berhasil
   */
  async _updateState(isBreaking = false) {
    try {
      let state = this._loadState();

      const today = todayWIB();
      if (state.date !== today) {
        // Hari baru — reset counter
        state = this._freshState(today);
      }

      state.articlesPublished = (state.articlesPublished || 0) + 1;
      if (isBreaking) {
        state.breakingPublished = (state.breakingPublished || 0) + 1;
      }
      state.lastPublishedAt = new Date().toISOString();

      this._saveState(state);
    } catch (err) {
      logger.warn('[publisher] Gagal update state.json', { error: err.message });
    }
  }

  _loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      }
    } catch {}
    return this._freshState(todayWIB());
  }

  _saveState(state) {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      logger.warn('[publisher] Gagal simpan state.json', { error: err.message });
    }
  }

  _freshState(date) {
    return {
      date,
      articlesPublished: 0,
      articlesTarget: this.settings.agent.dailyTarget || 30,
      breakingPublished: 0,
      lastPublishedAt: null,
      nextScheduledAt: null,
      agentStatus: 'running',
      queueLength: 0,
      errors24h: 0,
      apiKeyActive: 0,
      apiKeyTotal: 0,
    };
  }
}

module.exports = PublisherAgent;
