'use strict';

/**
 * Auth Routes
 *
 * POST /api/auth/login    — Username + password → access + refresh token
 * POST /api/auth/logout   — Blacklist access token
 * POST /api/auth/refresh  — Refresh token → access token baru
 * GET  /api/auth/me       — Info user yang sedang login
 */

const express   = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');

const { requireAuth, blacklistToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET        = process.env.DASHBOARD_JWT_SECRET   || '';
const ADMIN_USERNAME    = process.env.DASHBOARD_ADMIN_USERNAME || 'admin';
const ADMIN_PASS_HASH   = process.env.DASHBOARD_ADMIN_PASSWORD_HASH || '';
const ACCESS_EXPIRY     = '2h';
const REFRESH_EXPIRY    = '30d';
const ACCESS_EXPIRY_SEC = 7200;

// In-memory store: refreshToken → { username, exp }
// Untuk produksi multiproses: ganti dengan file/redis
const _refreshTokens = new Map();

// Cleanup refresh tokens expired setiap jam
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of _refreshTokens) {
    if (now > data.exp * 1000) _refreshTokens.delete(token);
  }
}, 60 * 60 * 1000);

// ─── Helper ───────────────────────────────────────────────

function generateTokenPair(username) {
  const accessToken = jwt.sign(
    { username, loginAt: new Date().toISOString() },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY, algorithm: 'HS256' }
  );
  const refreshToken = jwt.sign(
    { username, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRY, algorithm: 'HS256' }
  );
  const decoded = jwt.decode(refreshToken);
  _refreshTokens.set(refreshToken, { username, exp: decoded.exp });
  return { accessToken, refreshToken };
}

// ─── POST /api/auth/login ─────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'Username dan password wajib diisi',
    });
  }

  // Cek konfigurasi
  if (!JWT_SECRET) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR',
      message: 'DASHBOARD_JWT_SECRET belum dikonfigurasi',
    });
  }
  if (!ADMIN_PASS_HASH) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR',
      message: 'DASHBOARD_ADMIN_PASSWORD_HASH belum dikonfigurasi. ' +
               'Generate dengan: node -e "require(\'bcryptjs\').hash(\'password\',12).then(console.log)"',
    });
  }

  // Verifikasi username
  if (username !== ADMIN_USERNAME) {
    return res.status(401).json({
      ok: false, error: 'INVALID_CREDENTIALS',
      message: 'Username atau password salah',
    });
  }

  // Verifikasi password
  let valid = false;
  try {
    valid = await bcrypt.compare(password, ADMIN_PASS_HASH);
  } catch {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR',
      message: 'Gagal verifikasi password',
    });
  }

  if (!valid) {
    return res.status(401).json({
      ok: false, error: 'INVALID_CREDENTIALS',
      message: 'Username atau password salah',
    });
  }

  const { accessToken, refreshToken } = generateTokenPair(username);

  return res.status(200).json({
    ok: true,
    data: {
      accessToken,
      refreshToken,
      expiresIn : ACCESS_EXPIRY_SEC,
      username,
    },
  });
});

// ─── POST /api/auth/logout ────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  const token   = req._token;
  const decoded = jwt.decode(token);
  if (decoded?.exp) {
    blacklistToken(token, decoded.exp * 1000);
  }

  // Hapus semua refresh token milik user ini
  for (const [rt, data] of _refreshTokens) {
    if (data.username === req.user.username) _refreshTokens.delete(rt);
  }

  return res.json({ ok: true });
});

// ─── POST /api/auth/refresh ───────────────────────────────
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'refreshToken wajib diisi',
    });
  }

  // Cek ada di store
  if (!_refreshTokens.has(refreshToken)) {
    return res.status(401).json({
      ok: false, error: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token tidak valid atau sudah expired',
    });
  }

  // Verifikasi signature
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_SECRET);
  } catch {
    _refreshTokens.delete(refreshToken);
    return res.status(401).json({
      ok: false, error: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token expired atau tidak valid',
    });
  }

  // Rotate: hapus refresh lama, buat access baru
  _refreshTokens.delete(refreshToken);
  const accessToken = jwt.sign(
    { username: decoded.username, loginAt: new Date().toISOString() },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY, algorithm: 'HS256' }
  );
  // Simpan refresh token lama kembali (tidak rotate refresh untuk UX)
  _refreshTokens.set(refreshToken, { username: decoded.username, exp: decoded.exp });

  return res.json({
    ok: true,
    data: { accessToken, expiresIn: ACCESS_EXPIRY_SEC },
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    ok: true,
    data: {
      username : req.user.username,
      loginAt  : req.user.loginAt,
    },
  });
});

module.exports = router;
