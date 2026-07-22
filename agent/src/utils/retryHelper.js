'use strict';

const logger = require('./logger');

/**
 * Retry Helper — Exponential backoff dengan jitter untuk semua operasi async
 * Terintegrasi dengan logger untuk tracking percobaan ulang
 */

/**
 * Sleep helper
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hitung delay exponential backoff dengan jitter
 * @param {number} attempt - Nomor percobaan (1-based)
 * @param {number} baseDelay - Delay awal dalam ms (default: 1000)
 * @param {number} maxDelay - Delay maksimum dalam ms (default: 30000)
 * @param {number} jitterFactor - Faktor randomisasi 0-1 (default: 0.3)
 * @returns {number} Delay dalam ms
 */
function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 30000, jitterFactor = 0.3) {
  const exponential = baseDelay * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxDelay);
  const jitter = capped * jitterFactor * Math.random();
  return Math.floor(capped + jitter);
}

/**
 * Retry fungsi async dengan exponential backoff
 * @param {Function} fn - Fungsi async yang akan diretry
 * @param {Object} options
 * @param {number} options.maxAttempts - Jumlah percobaan maksimum (default: 3)
 * @param {number} options.baseDelay - Delay awal ms (default: 1000)
 * @param {number} options.maxDelay - Delay maksimum ms (default: 30000)
 * @param {Function} options.shouldRetry - Fungsi(error) → boolean, cek apakah perlu retry
 * @param {string} options.context - Label untuk logging (default: 'operation')
 * @param {Function} options.onRetry - Callback saat retry: (attempt, error, delay) => void
 * @returns {Promise<any>} Hasil dari fn()
 */
async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
    context = 'operation',
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const isLast = attempt >= maxAttempts;
      const willRetry = !isLast && shouldRetry(error, attempt);

      if (!willRetry) {
        logger.warn(`[${context}] Gagal setelah ${attempt} percobaan`, {
          error: error.message,
          attempt,
          maxAttempts,
        });
        throw error;
      }

      const delay = calculateBackoff(attempt, baseDelay, maxDelay);

      logger.debug(`[${context}] Percobaan ${attempt}/${maxAttempts} gagal, retry dalam ${delay}ms`, {
        error: error.message,
        attempt,
        delay,
      });

      if (onRetry) {
        try { onRetry(attempt, error, delay); } catch { /* ignore */ }
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry khusus untuk Gemini API dengan penanganan 429 rate limit
 * @param {Function} fn - Fungsi yang memanggil Gemini
 * @param {Object} options
 * @returns {Promise<any>}
 */
async function withGeminiRetry(fn, options = {}) {
  return withRetry(fn, {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    context: 'gemini',
    shouldRetry: (error, attempt) => {
      // Retry untuk 429, 503, network errors
      if (error.status === 429) return true;          // Rate limit
      if (error.status === 503) return attempt <= 3;  // Service unavailable
      if (error.code === 'ECONNRESET') return true;   // Network reset
      if (error.code === 'ETIMEDOUT') return true;    // Timeout
      if (error.message?.includes('network')) return true;
      // Jangan retry untuk 400 (bad request), 401 (unauthorized)
      if (error.status === 400) return false;
      if (error.status === 401) return false;
      if (error.status === 403) return false;
      return true; // Default: retry
    },
    ...options,
  });
}

/**
 * Retry khusus untuk Strapi API
 * @param {Function} fn
 * @param {Object} options
 * @returns {Promise<any>}
 */
async function withStrapiRetry(fn, options = {}) {
  return withRetry(fn, {
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 30000,
    context: 'strapi',
    shouldRetry: (error) => {
      if (error.status >= 500) return true;             // Server error
      if (error.status === 429) return true;            // Rate limit
      if (error.code === 'ECONNREFUSED') return true;   // Strapi down
      if (error.code === 'ECONNRESET') return true;
      if (error.code === 'ETIMEDOUT') return true;
      // Jangan retry untuk 4xx client errors
      if (error.status >= 400 && error.status < 500) return false;
      return true;
    },
    ...options,
  });
}

/**
 * Retry khusus untuk upload R2/S3
 * @param {Function} fn
 * @param {Object} options
 * @returns {Promise<any>}
 */
async function withR2Retry(fn, options = {}) {
  return withRetry(fn, {
    maxAttempts: 3,
    baseDelay: 3000,
    maxDelay: 15000,
    context: 'r2',
    shouldRetry: (error) => {
      if (error.Code === 'RequestTimeout') return true;
      if (error.Code === 'InternalError') return true;
      if (error.code === 'ECONNRESET') return true;
      if (error.code === 'ETIMEDOUT') return true;
      return false;
    },
    ...options,
  });
}

/**
 * Circuit breaker sederhana — pause operasi setelah N failure berturut
 * @param {Object} options
 * @param {number} options.threshold - Jumlah error sebelum circuit open (default: 3)
 * @param {number} options.resetTimeMs - Waktu reset circuit dalam ms (default: 600000 = 10 menit)
 * @returns {Object} Circuit breaker instance
 */
function createCircuitBreaker(options = {}) {
  const { threshold = 3, resetTimeMs = 10 * 60 * 1000 } = options;

  let failureCount = 0;
  let lastFailureTime = null;
  let isOpen = false;

  return {
    /**
     * Cek apakah circuit dalam keadaan terbuka (error state)
     * @returns {boolean}
     */
    isOpen() {
      if (!isOpen) return false;

      // Cek apakah sudah waktunya reset
      if (lastFailureTime && Date.now() - lastFailureTime > resetTimeMs) {
        isOpen = false;
        failureCount = 0;
        logger.info('[circuit-breaker] Circuit reset (half-open → closed)');
        return false;
      }

      return true;
    },

    /**
     * Catat kegagalan
     */
    recordFailure() {
      failureCount++;
      lastFailureTime = Date.now();
      if (failureCount >= threshold && !isOpen) {
        isOpen = true;
        const resetMin = Math.round(resetTimeMs / 60000);
        logger.warn(`[circuit-breaker] Circuit OPEN setelah ${failureCount} failure. Reset dalam ${resetMin} menit.`);
      }
    },

    /**
     * Catat keberhasilan — reset failure count
     */
    recordSuccess() {
      if (failureCount > 0) {
        failureCount = 0;
        if (isOpen) {
          isOpen = false;
          logger.info('[circuit-breaker] Circuit CLOSED — operasi berhasil');
        }
      }
    },

    /**
     * Reset manual circuit
     */
    reset() {
      failureCount = 0;
      isOpen = false;
      lastFailureTime = null;
    },

    getStatus() {
      return { isOpen, failureCount, threshold, lastFailureTime };
    },
  };
}

module.exports = {
  sleep,
  calculateBackoff,
  withRetry,
  withGeminiRetry,
  withStrapiRetry,
  withR2Retry,
  createCircuitBreaker,
};
