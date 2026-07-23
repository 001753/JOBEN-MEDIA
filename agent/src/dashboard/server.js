'use strict';

/**
 * Dashboard Server — Express app untuk JOBEN NEWS AI Control Center
 *
 * Port: 4000 (DASHBOARD_PORT)
 * Auth: JWT (login form, bukan Basic Auth)
 * Static: src/dashboard/public/ (Part 2 — frontend HTML/CSS/JS)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const express = require('express');
const helmet  = require('helmet');
const path    = require('path');
const fs      = require('fs');

const logger = require('../utils/logger');

// ─── Routes ───────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const overviewRoutes = require('./routes/overview');
const articlesRoutes = require('./routes/articles');
const queueRoutes    = require('./routes/queue');
const scheduleRoutes = require('./routes/schedule');
const authorsRoutes  = require('./routes/authors');
const keysRoutes     = require('./routes/keys');
const promptsRoutes  = require('./routes/prompts');
const logsRoutes     = require('./routes/logs');
const manualRoutes   = require('./routes/manual');
const settingsRoutes = require('./routes/settings');

const { requireAuth }    = require('./middleware/auth');
const { loginLimiter, apiLimiter } = require('./middleware/rateLimit');

// ─── App ──────────────────────────────────────────────────
const app = express();

// Security headers (CSP tidak terlalu ketat agar CDN font/icon bisa load)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Parse JSON body
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (singkat)
app.use((req, res, next) => {
  logger.debug(`[dashboard] ${req.method} ${req.path}`);
  next();
});

// ─── Static files (Part 2 — frontend) ────────────────────
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ─── Public routes (tanpa auth) ──────────────────────────
app.use('/api/auth', loginLimiter, authRoutes);

// Health check publik
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ─── Protected API routes ────────────────────────────────
app.use('/api', apiLimiter, requireAuth);

app.use('/api/overview',  overviewRoutes);
app.use('/api/articles',  articlesRoutes);
app.use('/api/queue',     queueRoutes);
app.use('/api/schedule',  scheduleRoutes);
app.use('/api/authors',   authorsRoutes);
app.use('/api/keys',      keysRoutes);
app.use('/api/prompts',   promptsRoutes);
app.use('/api/logs',      logsRoutes);
app.use('/api/manual',    manualRoutes);
app.use('/api/settings',  settingsRoutes);

// ─── SPA Fallback (serve index.html untuk semua route non-API) ──
app.get('*', (req, res) => {
  const indexHtml = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(200).json({
      message: 'JOBEN NEWS AI Dashboard API',
      version: '1.0.0',
      note: 'Frontend (Part 2) belum diinstall. API siap digunakan.',
      endpoints: {
        auth:     'POST /api/auth/login',
        overview: 'GET  /api/overview',
        articles: 'GET  /api/articles',
        queue:    'GET  /api/queue',
        logs:     'GET  /api/logs/stream (SSE)',
        health:   'GET  /health',
      },
    });
  }
});

// ─── Error handler ────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(`[dashboard] Unhandled error: ${err.message}`, { stack: err.stack });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────
const PORT = parseInt(process.env.DASHBOARD_PORT || '4000', 10);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`[dashboard] Server berjalan di port ${PORT}`);
  logger.info(`[dashboard] API ready — http://0.0.0.0:${PORT}/health`);
});

module.exports = app; // untuk testing
