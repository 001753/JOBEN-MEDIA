'use strict';

/**
 * Queue Routes
 *
 * GET    /api/queue              — Isi queue saat ini
 * POST   /api/queue              — Tambah item ke queue
 * DELETE /api/queue/:id          — Hapus item dari queue
 * PUT    /api/queue/reorder       — Reorder items
 * POST   /api/queue/:id/trigger   — Set priority tertinggi (proses segera)
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

const QUEUE_FILE = path.join(__dirname, '../../../data/queue.json');

// ─── Helper ───────────────────────────────────────────────
function readQueue() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return { items: [], lastUpdated: null };
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch {
    return { items: [], lastUpdated: null };
  }
}

function writeQueue(data) {
  data.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const VALID_PRIORITIES    = [0, 1, 2];
const VALID_CONTENT_TYPES = ['reguler', 'breaking'];

// ─── GET /api/queue ───────────────────────────────────────
router.get('/', (req, res) => {
  const data = readQueue();
  return res.json({
    ok  : true,
    data: {
      items : data.items || [],
      total : (data.items || []).length,
    },
  });
});

// ─── POST /api/queue ──────────────────────────────────────
router.post('/', (req, res) => {
  const { topic, category, subcategory, priority = 0, contentType = 'reguler' } = req.body || {};

  if (!topic || !topic.trim()) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: 'topic wajib diisi',
    });
  }
  if (!category || !category.trim()) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: 'category wajib diisi',
    });
  }
  if (!VALID_PRIORITIES.includes(Number(priority))) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'priority harus 0 (normal), 1 (hot), atau 2 (breaking)',
    });
  }
  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'contentType harus "reguler" atau "breaking"',
    });
  }

  const data = readQueue();
  const id   = generateId();

  const item = {
    id,
    priority     : Number(priority),
    topicData    : { topic: topic.trim(), category: category.trim(), subcategory: subcategory || null },
    source       : 'manual-dashboard',
    contentType,
    forcedCategory: category.trim(),
    addedAt      : new Date().toISOString(),
    status       : 'pending',
  };

  data.items.push(item);
  // Sort: priority DESC, addedAt ASC
  data.items.sort((a, b) => b.priority - a.priority || new Date(a.addedAt) - new Date(b.addedAt));

  try {
    writeQueue(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.status(201).json({ ok: true, data: { id } });
});

// ─── DELETE /api/queue/:id ────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const data   = readQueue();
  const before = data.items.length;

  data.items = data.items.filter(item => item.id !== id);

  if (data.items.length === before) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  try {
    writeQueue(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.json({ ok: true });
});

// ─── PUT /api/queue/reorder ───────────────────────────────
router.put('/reorder', (req, res) => {
  const { orderedIds } = req.body || {};

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'orderedIds harus berupa array string',
    });
  }

  const data    = readQueue();
  const itemMap = new Map(data.items.map(item => [item.id, item]));

  // Rebuild urutan sesuai orderedIds, sisipkan item tidak ada di orderedIds di belakang
  const reordered = [];
  for (const id of orderedIds) {
    if (itemMap.has(id)) {
      reordered.push(itemMap.get(id));
      itemMap.delete(id);
    }
  }
  // Append sisa item yang tidak disebut
  for (const item of itemMap.values()) {
    reordered.push(item);
  }

  data.items = reordered;

  try {
    writeQueue(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.json({ ok: true, data: { items: data.items } });
});

// ─── POST /api/queue/:id/trigger ─────────────────────────
router.post('/:id/trigger', (req, res) => {
  const { id } = req.params;
  const data   = readQueue();
  const item   = data.items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  // Set ke priority maksimum agar diproses di tick scheduler berikutnya
  item.priority = 2;
  // Sort ulang
  data.items.sort((a, b) => b.priority - a.priority || new Date(a.addedAt) - new Date(b.addedAt));

  try {
    writeQueue(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.json({
    ok  : true,
    message: 'Item dipindahkan ke priority tertinggi. Akan diproses di tick scheduler berikutnya.',
  });
});

module.exports = router;
