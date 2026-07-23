'use strict';

/**
 * Articles Routes
 *
 * GET /api/articles       — List artikel dari SQLite dengan filter + paginasi
 * GET /api/articles/:id   — Detail 1 artikel
 */

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');

const router = express.Router();

const DB_FILE = path.join(__dirname, '../../../data/published.db');

// Field gemini_key_used dimask sebelum dikirim ke client
const SENSITIVE_FIELDS = ['gemini_key_used'];

function maskRow(row) {
  if (!row) return row;
  const masked = { ...row };
  for (const field of SENSITIVE_FIELDS) {
    if (masked[field]) masked[field] = '****';
  }
  return masked;
}

function openDb() {
  if (!fs.existsSync(DB_FILE)) return null;
  return new Database(DB_FILE, { readonly: true });
}

// ─── GET /api/articles ────────────────────────────────────
router.get('/', (req, res) => {
  const db = openDb();
  if (!db) {
    return res.json({
      ok  : true,
      data: [],
      meta: { total: 0, page: 1, limit: 20, pages: 0 },
    });
  }

  try {
    const page     = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset   = (page - 1) * limit;
    const status   = req.query.status   || 'all';
    const category = req.query.category || '';
    const date     = req.query.date     || '';  // YYYY-MM-DD
    const q        = req.query.q        || '';

    // ─ Build WHERE clause ─
    const conditions = [];
    const params     = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (date) {
      conditions.push("DATE(published_at) = ?");
      params.push(date);
    }
    if (q) {
      conditions.push('title LIKE ?');
      params.push(`%${q}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM articles ${where}`).get(...params).cnt;
    const rows  = db.prepare(
      `SELECT id, title, slug, category, subcategory, author_name,
              source_name, word_count, quality_score, published_at,
              created_at, status, error_msg, gemini_key_used, generation_ms
       FROM articles ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    db.close();

    return res.json({
      ok  : true,
      data: rows.map(maskRow),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    db.close();
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

// ─── GET /api/articles/:id ────────────────────────────────
router.get('/:id', (req, res) => {
  const db = openDb();
  if (!db) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  try {
    const id  = parseInt(req.params.id, 10);
    const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    db.close();

    if (!row) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }

    return res.json({ ok: true, data: maskRow(row) });
  } catch (err) {
    db.close();
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

module.exports = router;
