'use strict';

/**
 * Internal Linker Agent — Sisipkan internal links ke artikel baru
 *
 * Proses:
 * 1. Ambil 20 artikel terbaru dari Strapi
 * 2. Gemini pilih 2-3 artikel paling relevan
 * 3. Sisipkan link ke dalam content blocks secara natural
 */

const logger = require('../utils/logger');
const prompts = require('../config/prompts');

class InternalLinkerAgent {
  constructor({ geminiPool, strapiClient, settings }) {
    this.gemini = geminiPool;
    this.strapi = strapiClient;
    this.settings = settings;
  }

  /**
   * Tambahkan internal links ke dalam artikel
   * @param {Object} article - Draft artikel (dengan content blocks)
   * @returns {Promise<Object>} Artikel dengan internal links tersisipkan
   */
  async run(article) {
    logger.agent(`[internal-linker] Mencari internal links untuk: "${article.title}"`);

    const maxLinks = this.settings.content.maxInternalLinks || 3;

    // Ambil artikel terbaru dari Strapi
    let recentArticles = [];
    try {
      recentArticles = await this.strapi.getRecentArticles({
        limit: 20,
        fields: ['title', 'slug', 'excerpt', 'category'],
      });
    } catch (err) {
      logger.warn('[internal-linker] Gagal ambil artikel dari Strapi, skip', { error: err.message });
      return article;
    }

    if (recentArticles.length === 0) {
      logger.agent('[internal-linker] Tidak ada artikel existing, skip');
      return article;
    }

    // Format untuk prompt
    const existingList = recentArticles.map(a => ({
      title: a.title,
      url: `/artikel/${a.slug}`,
      category: a.category?.name || a.category || '',
    }));

    // Minta Gemini pilih artikel relevan
    let linkSuggestions;
    try {
      const raw = await this.gemini.generateText({
        userPrompt: prompts.internalLinker.findRelevant(article, existingList),
        useSearch: false,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      });

      const parsed = this.gemini.parseJsonResponse(raw);
      linkSuggestions = parsed.links || [];
    } catch (err) {
      logger.warn('[internal-linker] Gagal generate link suggestions', { error: err.message });
      return article;
    }

    if (!linkSuggestions.length) {
      logger.agent('[internal-linker] Tidak ada link relevan ditemukan');
      return article;
    }

    // Batasi jumlah link
    linkSuggestions = linkSuggestions.slice(0, maxLinks);

    // Sisipkan link ke content blocks
    const enrichedContent = this._insertLinks(article.content, linkSuggestions, existingList);
    article.content = enrichedContent;

    logger.agent(`[internal-linker] ${linkSuggestions.length} internal link disisipkan`);

    return article;
  }

  /**
   * Sisipkan link ke dalam Strapi Blocks setelah paragraf tertentu
   */
  _insertLinks(contentBlocks, suggestions, existingList) {
    if (!contentBlocks || contentBlocks.length === 0) return contentBlocks;

    const blocks = [...contentBlocks];

    // Sortir suggestions berdasarkan insertAfterParagraph (descending) agar indeks tidak bergeser
    const sorted = [...suggestions].sort(
      (a, b) => (b.insertAfterParagraph || 2) - (a.insertAfterParagraph || 2)
    );

    let paragraphCount = 0;
    const paragraphIndices = [];

    // Temukan indeks semua paragraph blocks
    blocks.forEach((block, idx) => {
      if (block.type === 'paragraph') {
        paragraphCount++;
        paragraphIndices.push({ idx, paraNum: paragraphCount });
      }
    });

    for (const link of sorted) {
      const targetParaNum = link.insertAfterParagraph || 2;
      const targetPara = paragraphIndices.find(p => p.paraNum === targetParaNum)
        || paragraphIndices[paragraphIndices.length - 2] // Paragraf sebelum akhir
        || paragraphIndices[paragraphIndices.length - 1];

      if (!targetPara) continue;

      // Temukan artikel yang dimaksud
      const targetArticle = existingList[link.index - 1];
      if (!targetArticle) continue;

      // Sisipkan link sebagai paragraph dengan teks anchor
      const linkBlock = {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Baca juga: ' },
          {
            type: 'link',
            url: targetArticle.url || link.url,
            children: [{ type: 'text', text: targetArticle.title || link.title }],
          },
        ],
      };

      // Insert setelah paragraf target
      blocks.splice(targetPara.idx + 1, 0, linkBlock);
    }

    return blocks;
  }
}

module.exports = InternalLinkerAgent;
