'use strict';

/**
 * Authors Routes
 *
 * GET /api/authors  — Daftar author + mapping kategori dari config
 */

const express = require('express');
const path    = require('path');

const router = express.Router();

const AUTHORS_FILE = path.join(__dirname, '../../config/authors.json');

// ─── GET /api/authors ─────────────────────────────────────
router.get('/', (req, res) => {
  try {
    // Invalidate require cache agar selalu fresh
    delete require.cache[require.resolve(AUTHORS_FILE)];
    const authorsData = require(AUTHORS_FILE);

    // authors.json bisa array atau { authors: [], categoryMap: {} }
    let authors    = [];
    let categoryMap = {};

    if (Array.isArray(authorsData)) {
      authors = authorsData;
    } else {
      authors     = authorsData.authors    || [];
      categoryMap = authorsData.categoryMap || {};
    }

    // Tambahkan info kategori ke setiap author
    const result = authors.map(author => {
      const categories = Object.entries(categoryMap)
        .filter(([, authorId]) => authorId === author.id)
        .map(([category]) => category);

      return { ...author, categories };
    });

    return res.json({
      ok  : true,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

module.exports = router;
