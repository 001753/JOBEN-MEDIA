'use strict';

/**
 * Manual Trigger Routes
 *
 * POST /api/manual/generate     — Trigger generate artikel di background
 * GET  /api/manual/job/:jobId   — Cek status job
 *
 * Mekanisme: Tulis job ke data/manual-jobs.json
 * Scheduler membaca file ini di setiap tick dan memproses job pending
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

const JOBS_FILE    = path.join(__dirname, '../../../data/manual-jobs.json');
const SETTINGS_FILE = path.join(__dirname, '../../config/settings.json');

const VALID_MODES         = ['reguler', 'breaking'];
const VALID_PUBLISH_MODES = ['publish', 'draft'];

// ─── Helper ───────────────────────────────────────────────
function readJobs() {
  try {
    if (!fs.existsSync(JOBS_FILE)) return { jobs: [] };
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  } catch {
    return { jobs: [] };
  }
}

function writeJobs(data) {
  fs.mkdirSync(path.dirname(JOBS_FILE), { recursive: true });
  fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// ─── POST /api/manual/generate ────────────────────────────
router.post('/generate', (req, res) => {
  const {
    category,
    subcategory  = null,
    topic        = null,
    mode         = 'reguler',
    authorId     = null,
    publishMode  = 'publish',
  } = req.body || {};

  // Validasi wajib
  if (!category || !category.trim()) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: 'category wajib diisi',
    });
  }
  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: `mode harus "${VALID_MODES.join('" atau "')}"`,
    });
  }
  if (!VALID_PUBLISH_MODES.includes(publishMode)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: `publishMode harus "${VALID_PUBLISH_MODES.join('" atau "')}"`,
    });
  }

  // Cek apakah agent aktif
  const settings = readSettings();
  if (settings.agent && !settings.agent.enabled) {
    return res.status(503).json({
      ok: false, error: 'AGENT_DISABLED',
      message: 'Agent sedang dinonaktifkan. Aktifkan dulu via Kill Switch.',
    });
  }

  // Cek apakah ada job yang sedang running
  const data       = readJobs();
  const runningJob = (data.jobs || []).find(j => j.status === 'running');
  if (runningJob) {
    return res.status(503).json({
      ok: false, error: 'AGENT_BUSY',
      message: `Agent sedang memproses artikel lain (job: ${runningJob.id}). Tunggu selesai.`,
    });
  }

  // Buat job baru
  const jobId = generateJobId();
  const job   = {
    id          : jobId,
    status      : 'pending',      // pending → running → done|failed
    category    : category.trim(),
    subcategory : subcategory     || null,
    topic       : topic?.trim()   || null,
    mode,
    authorId,
    publishMode,
    createdAt   : new Date().toISOString(),
    startedAt   : null,
    finishedAt  : null,
    result      : null,
    error       : null,
  };

  data.jobs = data.jobs || [];
  // Simpan max 50 job terakhir
  if (data.jobs.length >= 50) {
    data.jobs = data.jobs.slice(-49);
  }
  data.jobs.push(job);

  try {
    writeJobs(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.status(202).json({
    ok  : true,
    data: {
      jobId,
      message: 'Generate artikel dimulai di background. Scheduler akan memproses di tick berikutnya.',
    },
  });
});

// ─── GET /api/manual/job/:jobId ───────────────────────────
router.get('/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const data      = readJobs();
  const job       = (data.jobs || []).find(j => j.id === jobId);

  if (!job) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  return res.json({
    ok  : true,
    data: {
      jobId      : job.id,
      status     : job.status,
      category   : job.category,
      mode       : job.mode,
      publishMode: job.publishMode,
      createdAt  : job.createdAt,
      startedAt  : job.startedAt,
      finishedAt : job.finishedAt,
      result     : job.result,
      error      : job.error,
    },
  });
});

// ─── GET /api/manual/jobs ─────────────────────────────────
router.get('/jobs', (req, res) => {
  const data  = readJobs();
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));

  const jobs = (data.jobs || [])
    .slice(-limit)
    .reverse()
    .map(j => ({
      jobId     : j.id,
      status    : j.status,
      category  : j.category,
      mode      : j.mode,
      createdAt : j.createdAt,
      finishedAt: j.finishedAt,
      error     : j.error,
    }));

  return res.json({ ok: true, data: jobs });
});

module.exports = router;
