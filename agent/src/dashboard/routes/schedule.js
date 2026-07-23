'use strict';

/**
 * Schedule Routes
 *
 * GET /api/schedule  — Baca konfigurasi agent + scheduler dari settings.json
 * PUT /api/schedule  — Update konfigurasi (partial merge + validasi)
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../../config/settings.json');

// ─── Helper ───────────────────────────────────────────────
function readSettings() {
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

function writeSettings(settings) {
  settings._lastModified = new Date().toISOString();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

function validateSchedulePayload(agent, scheduler) {
  const errors = [];

  if (agent) {
    if (agent.dailyTarget !== undefined) {
      const v = Number(agent.dailyTarget);
      if (!Number.isInteger(v) || v < 1 || v > 100)
        errors.push('agent.dailyTarget harus integer 1–100');
    }
    if (agent.activeHours) {
      const { start, end } = agent.activeHours;
      if (start !== undefined && (start < 0 || start > 23))
        errors.push('agent.activeHours.start harus 0–23');
      if (end !== undefined && (end < 0 || end > 23))
        errors.push('agent.activeHours.end harus 0–23');
      if (start !== undefined && end !== undefined && start >= end)
        errors.push('agent.activeHours.start harus lebih kecil dari end');
    }
    if (agent.weekdayTarget !== undefined) {
      const v = Number(agent.weekdayTarget);
      if (!Number.isInteger(v) || v < 1 || v > 100)
        errors.push('agent.weekdayTarget harus integer 1–100');
    }
    if (agent.weekendTarget !== undefined) {
      const v = Number(agent.weekendTarget);
      if (!Number.isInteger(v) || v < 1 || v > 100)
        errors.push('agent.weekendTarget harus integer 1–100');
    }
  }

  if (scheduler) {
    if (scheduler.intervalMinBase !== undefined) {
      const v = Number(scheduler.intervalMinBase);
      if (v < 5)
        errors.push('scheduler.intervalMinBase minimal 5 menit');
    }
    if (scheduler.maxQueueSize !== undefined) {
      const v = Number(scheduler.maxQueueSize);
      if (v < 1 || v > 500)
        errors.push('scheduler.maxQueueSize harus 1–500');
    }
  }

  return errors;
}

// ─── GET /api/schedule ────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const settings = readSettings();
    return res.json({
      ok  : true,
      data: {
        agent    : settings.agent,
        scheduler: settings.scheduler,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

// ─── PUT /api/schedule ────────────────────────────────────
router.put('/', (req, res) => {
  const { agent, scheduler } = req.body || {};

  if (!agent && !scheduler) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'Body harus mengandung field "agent" dan/atau "scheduler"',
    });
  }

  const errors = validateSchedulePayload(agent, scheduler);
  if (errors.length > 0) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: errors.join('; '),
    });
  }

  try {
    const settings = readSettings();

    if (agent) {
      settings.agent = { ...settings.agent, ...agent };
      if (agent.activeHours) {
        settings.agent.activeHours = {
          ...settings.agent.activeHours,
          ...agent.activeHours,
        };
      }
    }
    if (scheduler) {
      settings.scheduler = { ...settings.scheduler, ...scheduler };
    }

    writeSettings(settings);

    return res.json({
      ok  : true,
      data: {
        agent    : settings.agent,
        scheduler: settings.scheduler,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

module.exports = router;
