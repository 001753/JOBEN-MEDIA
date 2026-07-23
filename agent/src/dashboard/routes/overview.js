'use strict';

/**
 * Overview Routes
 *
 * GET  /api/overview                — State harian + uptime + recent activity
 * POST /api/overview/kill-switch    — Kill atau aktifkan agent
 * GET  /api/overview/recent-activity — 20 artikel terbaru dari SQLite
 */

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');

const router = express.Router();

const STATE_FILE = path.join(__dirname, '../../../data/state.json');
const DB_FILE    = path.join(__dirname, '../../../data/published.db');

const _startedAt = new Date().toISOString();

// ─── Helper: baca state.json ──────────────────────────────
function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return defaultState();
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return {
    date              : new Date().toISOString().slice(0, 10),
    articlesPublished : 0,
    articlesTarget    : 30,
    breakingPublished : 0,
    breakingTarget    : 2,
    lastPublishedAt   : null,
    nextScheduledAt   : null,
    agentStatus       : 'idle',
    queueLength       : 0,
    errors24h         : 0,
    apiKeyActive      : 0,
    apiKeyTotal       : 0,
    startedAt         : _startedAt,
    generationStats   : { totalAttempts: 0, totalSuccess: 0, avgGenerationMs: 0 },
  };
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ─── Helper: DB query recent articles ─────────────────────
function getRecentActivity(limit = 20) {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    const db   = new Database(DB_FILE, { readonly: true });
    const rows = db.prepare(
      `SELECT id, title, slug, category, subcategory, author_name,
              word_count, quality_score, published_at, created_at,
              status, error_msg
       FROM articles
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(limit);
    db.close();
    return rows;
  } catch {
    return [];
  }
}

// ─── GET /api/overview ────────────────────────────────────
router.get('/', (req, res) => {
  const state          = readState();
  const recentActivity = getRecentActivity(20);

  return res.json({
    ok  : true,
    data: {
      state,
      uptime: {
        processMs: Date.now() - new Date(_startedAt).getTime(),
        startedAt : _startedAt,
      },
      recentActivity,
    },
  });
});

// ─── POST /api/overview/kill-switch ──────────────────────
router.post('/kill-switch', (req, res) => {
  const { action } = req.body || {};

  if (!['kill', 'activate'].includes(action)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'action harus "kill" atau "activate"',
    });
  }

  const state = readState();

  if (action === 'kill') {
    state.agentStatus = 'killed';
  } else {
    state.agentStatus = 'idle';
  }

  try {
    writeState(state);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR',
      message: `Gagal update state: ${err.message}`,
    });
  }

  return res.json({
    ok  : true,
    data: { agentStatus: state.agentStatus },
  });
});

// ─── GET /api/overview/recent-activity ───────────────────
router.get('/recent-activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  return res.json({
    ok  : true,
    data: getRecentActivity(limit),
  });
});

module.exports = router;
