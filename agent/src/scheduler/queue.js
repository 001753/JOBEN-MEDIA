'use strict';

/**
 * Queue Manager — FIFO queue dengan priority support
 *
 * Priority:
 * - 2: Breaking News (bypass scheduler, publish segera)
 * - 1: Hot News (priority queue, lebih awal dari normal)
 * - 0: Normal (FIFO biasa)
 *
 * State persistent di data/queue.json
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const QUEUE_FILE = path.join(__dirname, '../../data/queue.json');

class ArticleQueue {
  constructor() {
    this._items = [];
    this._load();
  }

  /**
   * Tambahkan item ke queue
   * @param {Object} item - { topicData, priority, source, addedAt }
   * @returns {string} ID item
   */
  push(item) {
    const qItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      priority: item.priority || 0,
      topicData: item.topicData,
      source: item.source || 'scheduler',
      contentType: item.contentType || 'reguler',
      forcedCategory: item.forcedCategory || null,
      addedAt: new Date().toISOString(),
      status: 'pending',
    };

    this._items.push(qItem);
    this._sort();
    this._save();

    logger.agent(`[queue] Item ditambahkan: "${item.topicData?.topic || '(auto)'}" (priority: ${qItem.priority})`);
    return qItem.id;
  }

  /**
   * Ambil item berikutnya dari queue (priority tinggi dulu)
   * @returns {Object|null}
   */
  shift() {
    if (this._items.length === 0) return null;

    const item = this._items.shift();
    item.status = 'processing';
    this._save();

    return item;
  }

  /**
   * Peek item berikutnya tanpa remove
   */
  peek() {
    return this._items[0] || null;
  }

  /**
   * Tandai item selesai diproses
   * @param {string} id
   * @param {string} status - 'published' | 'failed' | 'rejected'
   */
  markDone(id, status = 'published') {
    // Item sudah di-shift, tidak perlu update
    // Simpan ke processed log jika diperlukan
  }

  /**
   * Hapus item dari queue by ID
   */
  remove(id) {
    const before = this._items.length;
    this._items = this._items.filter(i => i.id !== id);
    if (this._items.length < before) {
      this._save();
      return true;
    }
    return false;
  }

  /**
   * Tambahkan topik manual ke queue (dari dashboard)
   */
  addManual({ topic, category, subcategory, contentType = 'reguler', priority = 1 }) {
    return this.push({
      topicData: {
        topic,
        category: category || 'Berita',
        subcategory: subcategory || '',
        indonesia_angle: '',
        urgency: contentType === 'breaking' ? 'breaking' : 'normal',
        source_indices: [],
        keywords: [],
      },
      priority: contentType === 'breaking' ? 2 : priority,
      source: 'manual',
      contentType,
    });
  }

  /**
   * Inject topik breaking (bypass normal scheduler)
   */
  addBreaking(topicData) {
    return this.push({
      topicData,
      priority: 2,
      source: 'breaking-daemon',
      contentType: 'breaking',
    });
  }

  get length() { return this._items.length; }
  get isEmpty() { return this._items.length === 0; }

  /**
   * List semua item untuk dashboard
   */
  list() {
    return this._items.map(i => ({ ...i }));
  }

  /**
   * Clear queue (admin operation)
   */
  clear() {
    this._items = [];
    this._save();
    logger.agent('[queue] Queue dikosongkan');
  }

  _sort() {
    // Priority descending, addedAt ascending (FIFO per priority)
    this._items.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.addedAt) - new Date(b.addedAt);
    });
  }

  _load() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        this._items = (data.items || []).filter(i => i.status === 'pending');
        logger.agent(`[queue] Loaded ${this._items.length} item dari queue.json`);
      }
    } catch (err) {
      logger.warn('[queue] Gagal load queue.json, mulai fresh', { error: err.message });
      this._items = [];
    }
  }

  _save() {
    try {
      const dir = path.dirname(QUEUE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(QUEUE_FILE, JSON.stringify({
        items: this._items,
        savedAt: new Date().toISOString(),
      }, null, 2));
    } catch (err) {
      logger.warn('[queue] Gagal simpan queue.json', { error: err.message });
    }
  }
}

module.exports = ArticleQueue;
