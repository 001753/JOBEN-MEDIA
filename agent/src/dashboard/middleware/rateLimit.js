'use strict';

/**
 * Dashboard Rate Limiter
 *
 * loginLimiter  : max 5 request per 15 menit per IP
 * apiLimiter    : max 120 request per menit per IP
 *                 (skip untuk endpoint SSE /api/logs/stream)
 */

const rateLimit = require('express-rate-limit');

// ─── Login limiter ────────────────────────────────────────
// keyGenerator tidak di-set → pakai default express-rate-limit (IPv6-safe)
const loginLimiter = rateLimit({
  windowMs        : 15 * 60 * 1000,  // 15 menit
  max             : 5,
  standardHeaders : true,
  legacyHeaders   : false,
  skipSuccessfulRequests: false,
  handler         : (req, res) => {
    const retryAfter = Math.ceil(
      (req.rateLimit.resetTime - Date.now()) / 1000
    );
    res.status(429).json({
      ok         : false,
      error      : 'RATE_LIMITED',
      message    : `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`,
      retryAfter,
    });
  },
});

// ─── General API limiter ──────────────────────────────────
// keyGenerator tidak di-set → pakai default express-rate-limit (IPv6-safe)
const apiLimiter = rateLimit({
  windowMs        : 60 * 1000,  // 1 menit
  max             : 120,
  standardHeaders : true,
  legacyHeaders   : false,
  // Jangan batasi SSE (koneksi panjang)
  skip            : (req) => req.path === '/logs/stream',
  handler         : (req, res) => {
    res.status(429).json({
      ok      : false,
      error   : 'RATE_LIMITED',
      message : 'Terlalu banyak request. Tunggu sebentar.',
    });
  },
});

module.exports = { loginLimiter, apiLimiter };
