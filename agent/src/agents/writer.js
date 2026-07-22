'use strict';

/**
 * Writer Agent — Generate artikel jurnalis Indonesia via Gemini
 *
 * Proses:
 * 1. Terima topik + konteks dari TrendScout
 * 2. Pilih author sesuai kategori
 * 3. Generate artikel (Strapi Blocks JSON) via Gemini
 * 4. Hitung word count dari content blocks
 * 5. Return artikel draft siap masuk Quality Gate
 */

const logger = require('../utils/logger');
const prompts = require('../config/prompts');
const authorsConfig = require('../config/authors.json');
const { countWordsInBlocks } = require('../utils/wordCount');
const { generateSlug } = require('../utils/slugify');

class WriterAgent {
  constructor({ geminiPool, settings }) {
    this.gemini = geminiPool;
    this.settings = settings;
    this._performanceContext = ''; // Diisi mingguan dari GA4 (Fase 2)
  }

  /**
   * Generate artikel dari topik terpilih
   * @param {Object} topicData - Output dari TrendScout
   * @param {string} contentType - 'reguler' | 'breaking'
   * @returns {Promise<Object>} Draft artikel
   */
  async run(topicData, contentType = 'reguler') {
    const {
      topic,
      category,
      subcategory,
      indonesia_angle,
      sourceSnippets,
      keywords = [],
    } = topicData;

    logger.agent(`[writer] Menulis artikel: "${topic}"`, { category, contentType });

    // Pilih author sesuai kategori
    const author = this._resolveAuthor(category);

    // Generate artikel
    const draft = await this._generateArticle({
      topic,
      category,
      subcategory: subcategory || '',
      indonesiaAngle: indonesia_angle || '',
      sourceSnippets: sourceSnippets || 'Tulis berdasarkan pengetahuan umum tentang topik ini.',
      contentType,
      author,
    });

    // Hitung word count dari content blocks
    draft.word_count = countWordsInBlocks(draft.content);

    // Pastikan slug ada dan valid
    if (!draft.slug) {
      draft.slug = generateSlug(draft.title);
    }

    // Attach author metadata
    draft.author = author;
    draft.category = category;
    draft.subcategory = subcategory || '';
    draft.content_type = contentType;

    logger.agent(`[writer] Draft selesai: "${draft.title}"`, {
      wordCount: draft.word_count,
      author: author.name,
    });

    return draft;
  }

  /**
   * Generate dengan Gemini, retry jika gagal parse
   */
  async _generateArticle({ topic, category, subcategory, indonesiaAngle, sourceSnippets, contentType, author }) {
    const systemPrompt = prompts.writer.system(author, this._performanceContext);
    const userPrompt = prompts.writer.user(
      topic, category, subcategory, indonesiaAngle, sourceSnippets, contentType
    );

    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await this.gemini.generateText({
          systemPrompt,
          userPrompt,
          useSearch: this.settings.gemini.useSearchGrounding,
          generationConfig: {
            temperature: attempt === 1 ? 0.7 : 0.5, // Lebih deterministik di retry
            maxOutputTokens: 8192,
          },
        });

        const article = this.gemini.parseJsonResponse(raw);

        // Validasi struktur minimal
        if (!article.title || !article.content || !Array.isArray(article.content)) {
          throw new Error(`Struktur artikel tidak valid (attempt ${attempt}): missing title atau content array`);
        }

        return article;

      } catch (err) {
        lastError = err;
        logger.warn(`[writer] Attempt ${attempt} gagal`, { error: err.message });

        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }

    throw lastError || new Error('Writer gagal generate artikel setelah 3 percobaan');
  }

  /**
   * Regenerate artikel dengan feedback dari Quality Gate
   * @param {Object} originalDraft
   * @param {string} feedback - Alasan reject + instruksi perbaikan
   * @returns {Promise<Object>} Artikel yang diperbaiki
   */
  async regenerateWithFeedback(originalDraft, feedback) {
    logger.agent(`[writer] Regenerate dengan feedback: ${feedback}`);

    const userPrompt = prompts.writer.regenerateWithFeedback(originalDraft, feedback);

    const raw = await this.gemini.generateText({
      systemPrompt: prompts.writer.system(originalDraft.author || this._resolveAuthor(originalDraft.category)),
      userPrompt,
      useSearch: false, // Tidak perlu search lagi, hanya perbaiki konten
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    });

    const improved = this.gemini.parseJsonResponse(raw);
    improved.word_count = countWordsInBlocks(improved.content);
    improved.author = originalDraft.author;
    improved.category = originalDraft.category;
    improved.subcategory = originalDraft.subcategory;
    improved.content_type = originalDraft.content_type;

    return improved;
  }

  /**
   * Resolve author berdasarkan kategori (dari authors.json categoryMapping)
   */
  _resolveAuthor(category) {
    const mapping = authorsConfig.categoryMapping;
    const authorId = mapping[category] || mapping['Berita'] || 'A01';
    const author = authorsConfig.authors.find(a => a.id === authorId);

    if (!author) {
      // Fallback ke author pertama
      return authorsConfig.authors[0];
    }

    return author;
  }

  /**
   * Set performance context dari GA4 (Fase 2)
   * @param {string} context
   */
  setPerformanceContext(context) {
    this._performanceContext = context;
  }
}

module.exports = WriterAgent;
