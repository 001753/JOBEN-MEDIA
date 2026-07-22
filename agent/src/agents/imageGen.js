'use strict';

/**
 * ImageGen Agent — Generate cover image via Imagen 3 + upload ke R2
 *
 * Proses:
 * 1. Generate deskripsi visual dari judul + excerpt (Gemini Flash)
 * 2. Build image prompt untuk Imagen 3
 * 3. Generate image (Imagen 3)
 * 4. Convert ke WebP + compress (max 500KB)
 * 5. Upload ke Cloudflare R2: covers/{YYYY}/{MM}/{slug}.webp
 * 6. Return R2 public URL
 */

const path = require('path');
const logger = require('../utils/logger');
const prompts = require('../config/prompts');

class ImageGenAgent {
  constructor({ geminiPool, r2Client, settings }) {
    this.gemini = geminiPool;
    this.r2 = r2Client;
    this.settings = settings;
  }

  /**
   * Generate + upload cover image untuk artikel
   * @param {Object} article - { title, excerpt, category, slug }
   * @returns {Promise<Object>} { url, r2Key, width, height, sizeKB }
   */
  async run(article) {
    const { title, excerpt, category, slug } = article;

    logger.agent(`[image-gen] Generate cover untuk: "${title}"`);

    // 1. Generate deskripsi visual via Gemini
    const visualDescription = await this._generateVisualDescription(title, excerpt, category);
    logger.agent('[image-gen] Deskripsi visual:', { desc: visualDescription.substring(0, 100) });

    // 2. Build image prompt
    const imagePrompt = prompts.imageGen.imagePrompt(visualDescription);

    // 3. Generate image via Imagen 3
    let imageData;
    try {
      imageData = await this.gemini.generateImage(imagePrompt);
    } catch (err) {
      logger.error('[image-gen] Imagen 3 gagal generate', { error: err.message });
      // Return null — publisher akan skip cover jika gagal
      return null;
    }

    // 4. Process image (convert/compress ke WebP)
    const processedBuffer = await this._processImage(imageData.buffer, imageData.mimeType);

    const sizeKB = Math.round(processedBuffer.length / 1024);
    logger.agent(`[image-gen] Image processed: ${sizeKB}KB`);

    // 5. Upload ke R2
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const r2Key = `covers/${year}/${month}/${slug}.webp`;

    const url = await this.r2.upload({
      key: r2Key,
      buffer: processedBuffer,
      contentType: 'image/webp',
      metadata: {
        title: title.substring(0, 100),
        category,
        generatedAt: now.toISOString(),
      },
    });

    logger.agent(`[image-gen] Upload selesai: ${url}`);

    return {
      url,
      r2Key,
      width: this.settings.content.imageWidth || 1280,
      height: this.settings.content.imageHeight || 720,
      sizeKB,
    };
  }

  /**
   * Generate deskripsi visual dari judul artikel
   */
  async _generateVisualDescription(title, excerpt, category) {
    const prompt = prompts.imageGen.descriptionPrompt(title, excerpt || '', category);

    const description = await this.gemini.generateText({
      userPrompt: prompt,
      useSearch: false,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 512,
      },
    });

    return description.trim();
  }

  /**
   * Process image: convert ke WebP + compress
   * Fallback ke buffer asli jika sharp tidak tersedia
   */
  async _processImage(buffer, mimeType) {
    const maxSizeKB = this.settings.content.imageMaxSizeKB || 500;
    const targetWidth = this.settings.content.imageWidth || 1280;
    const targetHeight = this.settings.content.imageHeight || 720;
    const quality = this.settings.content.imageQuality || 85;

    try {
      // Coba gunakan sharp untuk convert/resize
      const sharp = require('sharp');

      const processed = await sharp(buffer)
        .resize(targetWidth, targetHeight, {
          fit: 'cover',
          position: 'centre',
        })
        .webp({ quality })
        .toBuffer();

      // Cek size — jika masih terlalu besar, compress lebih
      if (processed.length > maxSizeKB * 1024) {
        const compressed = await sharp(buffer)
          .resize(targetWidth, targetHeight, { fit: 'cover' })
          .webp({ quality: Math.max(60, quality - 20) })
          .toBuffer();
        return compressed;
      }

      return processed;

    } catch (err) {
      // sharp tidak tersedia — kembalikan buffer asli
      logger.warn('[image-gen] sharp tidak tersedia, gunakan buffer asli', { error: err.message });
      return buffer;
    }
  }

  /**
   * Generate avatar untuk author profile
   * @param {Object} author - { name, gender, age, expertise }
   * @returns {Promise<Object|null>}
   */
  async generateAuthorAvatar(author) {
    logger.agent(`[image-gen] Generate avatar untuk: ${author.name}`);

    const genderDesc = author.gender === 'female' ? 'female' : 'male';
    const prompt = `Professional headshot of Indonesian ${genderDesc} journalist, age ${author.age || 28}, ${author.expertise?.[0] || 'technology'} expert, natural office background, professional business attire, warm confident smile, portrait photography, photorealistic, 1:1 aspect ratio, high resolution, clean neutral background`;

    try {
      const imageData = await this.gemini.generateImage(prompt);
      const processedBuffer = await this._processAvatarImage(imageData.buffer);

      const r2Key = `authors/${author.slug}/avatar.webp`;
      const url = await this.r2.upload({
        key: r2Key,
        buffer: processedBuffer,
        contentType: 'image/webp',
        metadata: { authorName: author.name },
      });

      return { url, r2Key };
    } catch (err) {
      logger.error(`[image-gen] Gagal generate avatar ${author.name}`, { error: err.message });
      return null;
    }
  }

  async _processAvatarImage(buffer) {
    try {
      const sharp = require('sharp');
      return await sharp(buffer)
        .resize(400, 400, { fit: 'cover', position: 'face' })
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      return buffer;
    }
  }
}

module.exports = ImageGenAgent;
