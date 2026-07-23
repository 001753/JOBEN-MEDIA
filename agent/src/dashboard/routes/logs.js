'use strict';

/**
 * Logs Routes
 *
 * GET /api/logs/stream        — SSE real-time log stream (autentikasi via ?token=)
 * GET /api/logs/dates         — Daftar tanggal log yang tersedia
 * GET /api/logs/download/:date — Download file log (autentikasi via ?token=)
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

const LOGS_DIR  = path.join(__dirname, '../../../logs');
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

// Level hierarchy: index lebih rendah = lebih verbose
const LEVEL_INDEX = { debug: 0, info: 1, warn: 2, error: 3 };

function meetsLevel(logLevel, filterLevel) {
  const logIdx    = LEVEL_INDEX[logLevel]    ?? 1;
  const filterIdx = LEVEL_INDEX[filterLevel] ?? 1;
  return logIdx >= filterIdx;
}

/** Path file log untuk tanggal tertentu */
function logFilePath(date) {
  return path.join(LOGS_DIR, `agent-${date}.log`);
}

/** Tanggal hari ini dalam WIB (Asia/Jakarta) */
function todayWIB() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

// ─── GET /api/logs/stream (SSE) ───────────────────────────
router.get('/stream', (req, res) => {
  const filterLevel = LOG_LEVELS.includes(req.query.level) ? req.query.level : 'info';
  const today       = todayWIB();
  const filePath    = logFilePath(today);

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Kirim event connected
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString(), level: filterLevel })}\n\n`);

  // Baca baris log, parse JSON Winston, filter level
  function parseLine(line) {
    try {
      const parsed = JSON.parse(line);
      if (!meetsLevel(parsed.level, filterLevel)) return null;
      return {
        ts     : parsed.timestamp,
        level  : parsed.level,
        message: parsed.message,
      };
    } catch {
      // Log lama mungkin tidak JSON — forward as-is dengan level info
      if (!line.trim()) return null;
      return { ts: new Date().toISOString(), level: 'info', message: line };
    }
  }

  // Tail file: baca dari akhir file, lalu watch perubahan
  let position = 0;

  function tailFile() {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size <= position) return;

    const stream = fs.createReadStream(filePath, {
      start   : position,
      encoding: 'utf8',
    });
    position = stat.size;

    let buffer = '';
    stream.on('data', chunk => { buffer += chunk; });
    stream.on('end', () => {
      const lines = buffer.split('\n');
      for (const line of lines) {
        const parsed = parseLine(line);
        if (parsed) {
          res.write(`event: log\ndata: ${JSON.stringify(parsed)}\n\n`);
        }
      }
    });
  }

  // Initial tail: mulai dari akhir file (tidak kirim history)
  if (fs.existsSync(filePath)) {
    position = fs.statSync(filePath).size;
  }

  // Watch file untuk perubahan baru
  let watcher = null;
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    watcher = fs.watch(LOGS_DIR, (event, filename) => {
      if (filename && filename.includes(today)) {
        tailFile();
      }
    });
  } catch {
    // fs.watch gagal — polled approach
  }

  // Heartbeat setiap 30 detik agar koneksi tidak putus
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    } catch { /* client disconnected */ }
  }, 30000);

  // Cleanup saat client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    if (watcher) { try { watcher.close(); } catch { /* ignore */ } }
  });
});

// ─── GET /api/logs/dates ──────────────────────────────────
router.get('/dates', (req, res) => {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return res.json({ ok: true, data: [] });
    }

    const dates = fs.readdirSync(LOGS_DIR)
      .filter(f => /^agent-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .map(f => f.replace('agent-', '').replace('.log', ''))
      .sort()
      .reverse();

    return res.json({ ok: true, data: dates });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

// ─── GET /api/logs/download/:date ─────────────────────────
router.get('/download/:date', (req, res) => {
  const { date } = req.params;

  // Validasi format tanggal
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'Format tanggal harus YYYY-MM-DD',
    });
  }

  const filePath = logFilePath(date);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="agent-${date}.log"`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
