'use strict';

/**
 * Dashboard Auth Middleware
 *
 * requireAuth:
 *   1. Ambil token dari header Authorization: Bearer <token> atau cookie access_token
 *   2. Verifikasi dengan jwt.verify()
 *   3. Cek blacklist in-memory (token yang sudah logout)
 *   4. Tempel req.user = decoded payload
 *
 * tokenBlacklist:
 *   - Map<token, expMs>
 *   - Cleanup entry expired setiap 10 menit
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || '';

// ─── Token Blacklist (in-memory) ─────────────────────────
const _blacklist = new Map(); // token → expMs

// Cleanup entries yang sudah expired setiap 10 menit
setInterval(() => {
  const now = Date.now();
  for (const [token, expMs] of _blacklist) {
    if (now > expMs) _blacklist.delete(token);
  }
}, 10 * 60 * 1000);

/**
 * Tambahkan token ke blacklist (logout)
 * @param {string} token
 * @param {number} expMs - Unix timestamp ms saat token expired
 */
function blacklistToken(token, expMs) {
  _blacklist.set(token, expMs);
}

/**
 * Middleware: wajibkan token JWT yang valid
 */
function requireAuth(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: 'DASHBOARD_JWT_SECRET belum dikonfigurasi',
    });
  }

  // 1. Ambil token
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback: query param ?token= (khusus SSE dan download yang tidak bisa set header)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  // Fallback: cookie
  if (!token && req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Token tidak ditemukan',
    });
  }

  // 2. Verifikasi
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHORIZED',
        message: 'Token expired',
        expiredAt: err.expiredAt,
      });
    }
    return res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Token tidak valid',
    });
  }

  // 3. Cek blacklist
  if (_blacklist.has(token)) {
    return res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Token sudah di-logout',
    });
  }

  // 4. Tempel ke request
  req.user  = decoded;
  req._token = token; // dibutuhkan route logout untuk blacklist
  next();
}

module.exports = { requireAuth, blacklistToken };
