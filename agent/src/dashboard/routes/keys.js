'use strict';

/**
 * API Keys Routes
 *
 * GET    /api/keys             — Status semua key (nilai di-mask)
 * POST   /api/keys/add         — Tambah key baru
 * DELETE /api/keys/:keyId      — Hapus key
 * POST   /api/keys/reset-daily — Reset counter harian semua key
 * POST   /api/keys/test        — Test satu key ke Gemini API
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

const KEYS_FILE = path.join(__dirname, '../../../data/keys.json');

// ─── Helper ───────────────────────────────────────────────
function readKeys() {
  try {
    if (!fs.existsSync(KEYS_FILE)) return { keys: [], lastRotationIndex: 0, lastUpdated: null };
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  } catch {
    return { keys: [], lastRotationIndex: 0, lastUpdated: null };
  }
}

function writeKeys(data) {
  data.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Mask nilai key: tampilkan 8 karakter pertama + ****
 */
function maskKey(keyValue) {
  if (!keyValue || keyValue.length < 8) return '****';
  return keyValue.slice(0, 8) + '****';
}

function buildSummary(keys) {
  return {
    total    : keys.length,
    active   : keys.filter(k => k.status === 'active').length,
    cooldown : keys.filter(k => k.status === 'cooldown').length,
    exhausted: keys.filter(k => k.status === 'exhausted').length,
    disabled : keys.filter(k => k.status === 'disabled').length,
  };
}

// ─── GET /api/keys ────────────────────────────────────────
router.get('/', (req, res) => {
  const data = readKeys();

  const maskedKeys = (data.keys || []).map(k => ({
    ...k,
    key: maskKey(k.key),
  }));

  return res.json({
    ok  : true,
    data: {
      keys              : maskedKeys,
      lastRotationIndex : data.lastRotationIndex || 0,
      lastResetDate     : data.lastResetDate || null,
      summary           : buildSummary(data.keys || []),
    },
  });
});

// ─── POST /api/keys/add ───────────────────────────────────
router.post('/add', (req, res) => {
  const { key } = req.body || {};

  if (!key || typeof key !== 'string') {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: 'key wajib diisi',
    });
  }
  if (!key.startsWith('AIza')) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'Gemini API key harus dimulai dengan "AIza"',
    });
  }

  const data = readKeys();

  // Cek duplikat
  if ((data.keys || []).some(k => k.key === key)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: 'Key ini sudah ada di pool',
    });
  }

  const nextNum = (data.keys || []).length + 1;
  const id      = `key_${String(nextNum).padStart(2, '0')}`;

  const newKey = {
    id,
    key,
    status       : 'active',
    dailyUsed    : 0,
    dailyLimit   : parseInt(process.env.GEMINI_DAILY_LIMIT_PER_KEY || '1500', 10),
    errorStreak  : 0,
    cooldownUntil: null,
    disabledUntil: null,
    lastUsed     : null,
    lastError    : null,
    totalSuccess : 0,
    totalError   : 0,
  };

  data.keys = data.keys || [];
  data.keys.push(newKey);

  try {
    writeKeys(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.status(201).json({ ok: true, data: { id } });
});

// ─── DELETE /api/keys/:keyId ──────────────────────────────
router.delete('/:keyId', (req, res) => {
  const { keyId } = req.params;
  const data      = readKeys();
  const before    = (data.keys || []).length;

  data.keys = (data.keys || []).filter(k => k.id !== keyId);

  if (data.keys.length === before) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  try {
    writeKeys(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.json({ ok: true });
});

// ─── POST /api/keys/reset-daily ───────────────────────────
router.post('/reset-daily', (req, res) => {
  const data      = readKeys();
  let   resetCount = 0;

  (data.keys || []).forEach(k => {
    k.dailyUsed   = 0;
    k.errorStreak = 0;
    if (k.status === 'exhausted') k.status = 'active';
    resetCount++;
  });

  data.lastResetDate = new Date().toISOString().slice(0, 10);

  try {
    writeKeys(data);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }

  return res.json({ ok: true, data: { resetCount } });
});

// ─── POST /api/keys/test ──────────────────────────────────
router.post('/test', async (req, res) => {
  const { keyId } = req.body || {};

  if (!keyId) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: 'keyId wajib diisi',
    });
  }

  const data = readKeys();
  const keyObj = (data.keys || []).find(k => k.id === keyId);

  if (!keyObj) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const start = Date.now();

  try {
    const genAI   = new GoogleGenerativeAI(keyObj.key);
    const gemini  = genAI.getGenerativeModel({ model });
    const result  = await gemini.generateContent('Balas hanya dengan: OK');
    const latency = Date.now() - start;

    // Pastikan ada response
    result.response.text();

    return res.json({
      ok  : true,
      data: { keyId, latencyMs: latency, model },
    });
  } catch (err) {
    return res.status(400).json({
      ok   : false,
      error: err.message,
      data : { keyId },
    });
  }
});

module.exports = router;
