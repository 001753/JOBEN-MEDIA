'use strict';

/**
 * Settings Routes
 *
 * GET /api/settings  — Baca full settings.json
 * PUT /api/settings  — Update settings (deep merge + validasi)
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const logger  = require('../../utils/logger');

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../../config/settings.json');

// Kunci wajib yang tidak boleh dihapus
const REQUIRED_SECTIONS = ['agent', 'scheduler', 'quality', 'gemini', 'content', 'diversity', 'telegram', 'dashboard'];

// ─── Helper ───────────────────────────────────────────────
function readSettings() {
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

function writeSettings(settings) {
  settings._lastModified = new Date().toISOString();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Deep merge dua object (level 1 key → merge; nested object → merge rekursif)
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) &&
        typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function validateSettings(merged) {
  const errors = [];
  for (const section of REQUIRED_SECTIONS) {
    if (!merged[section] || typeof merged[section] !== 'object') {
      errors.push(`Section wajib "${section}" tidak boleh dihapus`);
    }
  }
  // Validasi nilai kritis
  if (merged.agent?.dailyTarget !== undefined) {
    const v = Number(merged.agent.dailyTarget);
    if (!Number.isInteger(v) || v < 1 || v > 100)
      errors.push('agent.dailyTarget harus integer 1–100');
  }
  if (merged.quality?.minWordCount !== undefined) {
    const v = Number(merged.quality.minWordCount);
    if (v < 100 || v > 5000)
      errors.push('quality.minWordCount harus 100–5000');
  }
  if (merged.dashboard?.maxLoginAttempts !== undefined) {
    const v = Number(merged.dashboard.maxLoginAttempts);
    if (v < 1 || v > 100)
      errors.push('dashboard.maxLoginAttempts harus 1–100');
  }
  return errors;
}

// ─── GET /api/settings ────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const settings = readSettings();
    return res.json({ ok: true, data: settings });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

// ─── PUT /api/settings ────────────────────────────────────
router.put('/', (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'Body harus berupa object settings',
    });
  }

  try {
    const current = readSettings();
    const before  = JSON.stringify(current);
    const merged  = deepMerge(current, updates);

    const errors  = validateSettings(merged);
    if (errors.length > 0) {
      return res.status(400).json({
        ok: false, error: 'VALIDATION_ERROR', message: errors.join('; '),
      });
    }

    writeSettings(merged);

    // Log diff (section level)
    const changedSections = Object.keys(updates);
    logger.info(`[dashboard/settings] Settings diupdate. Section berubah: ${changedSections.join(', ')}`);
    logger.debug(`[dashboard/settings] Before: ${before}`);

    return res.json({ ok: true, data: merged });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

module.exports = router;
