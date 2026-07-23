'use strict';

/**
 * Prompts Routes
 *
 * GET  /api/prompts          — Baca semua prompt template (current)
 * PUT  /api/prompts          — Update prompt template (simpan versi lama)
 * GET  /api/prompts/versions — List versi tersimpan
 * POST /api/prompts/rollback — Rollback ke versi tertentu
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

const PROMPTS_FILE    = path.join(__dirname, '../../config/prompts.js');
const VERSIONS_DIR    = path.join(__dirname, '../../../data/prompt-versions');
const MAX_VERSIONS    = 10;
const MAX_PROMPT_CHARS = 50000;

// ─── Helper ───────────────────────────────────────────────

/** Baca prompts.js dengan invalidate cache */
function readPrompts() {
  delete require.cache[require.resolve(PROMPTS_FILE)];
  return require(PROMPTS_FILE);
}

/** Tulis prompts.js baru dengan module.exports */
function writePromptsFile(prompts) {
  const content = `'use strict';\n\n/**\n * Prompt Templates — diedit via Dashboard\n * Terakhir diupdate: ${new Date().toISOString()}\n */\n\nmodule.exports = ${JSON.stringify(prompts, null, 2)};\n`;
  fs.writeFileSync(PROMPTS_FILE, content, 'utf8');
  // Invalidate cache setelah tulis
  delete require.cache[require.resolve(PROMPTS_FILE)];
}

/** Simpan snapshot versi ke data/prompt-versions/v{N}.json */
function saveVersion(prompts) {
  fs.mkdirSync(VERSIONS_DIR, { recursive: true });

  const files   = listVersionFiles();
  const nextNum = files.length === 0 ? 1 : (files[0].version + 1);

  const versionFile = path.join(VERSIONS_DIR, `v${nextNum}.json`);
  fs.writeFileSync(versionFile, JSON.stringify({
    version  : nextNum,
    savedAt  : new Date().toISOString(),
    sizeBytes: JSON.stringify(prompts).length,
    prompts,
  }, null, 2), 'utf8');

  // Hapus versi lama jika sudah melebihi MAX_VERSIONS
  const allFiles = listVersionFiles();
  if (allFiles.length > MAX_VERSIONS) {
    const toDelete = allFiles.slice(MAX_VERSIONS);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(VERSIONS_DIR, f.filename));
    }
  }

  return nextNum;
}

/** List file versi (urutkan versi terbaru dulu) */
function listVersionFiles() {
  if (!fs.existsSync(VERSIONS_DIR)) return [];

  return fs.readdirSync(VERSIONS_DIR)
    .filter(f => f.match(/^v\d+\.json$/))
    .map(filename => {
      const version = parseInt(filename.slice(1), 10);
      const stat    = fs.statSync(path.join(VERSIONS_DIR, filename));
      return { filename, version, mtime: stat.mtime };
    })
    .sort((a, b) => b.version - a.version);
}

// ─── GET /api/prompts ─────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const current = readPrompts();
    const stat    = fs.statSync(PROMPTS_FILE);

    return res.json({
      ok  : true,
      data: {
        current,
        updatedAt: stat.mtime.toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

// ─── PUT /api/prompts ─────────────────────────────────────
router.put('/', (req, res) => {
  const { prompts } = req.body || {};

  if (!prompts || typeof prompts !== 'object') {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      message: 'Field "prompts" harus berupa object',
    });
  }

  // Validasi: tidak boleh ada value kosong atau terlalu panjang
  for (const [key, value] of Object.entries(prompts)) {
    if (typeof value !== 'string') continue;
    if (!value.trim()) {
      return res.status(400).json({
        ok: false, error: 'VALIDATION_ERROR',
        message: `Prompt "${key}" tidak boleh kosong`,
      });
    }
    if (value.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({
        ok: false, error: 'VALIDATION_ERROR',
        message: `Prompt "${key}" melebihi batas ${MAX_PROMPT_CHARS} karakter`,
      });
    }
  }

  try {
    // Simpan versi lama dulu
    const current = readPrompts();
    const version = saveVersion(current);

    // Merge dengan existing (partial update)
    const updated = { ...current, ...prompts };
    writePromptsFile(updated);

    return res.json({
      ok  : true,
      data: {
        version  : version + 1,
        savedAt  : new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

// ─── GET /api/prompts/versions ────────────────────────────
router.get('/versions', (req, res) => {
  const files = listVersionFiles().map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(VERSIONS_DIR, f.filename), 'utf8'));
      return { version: data.version, savedAt: data.savedAt, sizeBytes: data.sizeBytes };
    } catch {
      return { version: f.version, savedAt: f.mtime, sizeBytes: null };
    }
  });

  return res.json({ ok: true, data: files });
});

// ─── POST /api/prompts/rollback ───────────────────────────
router.post('/rollback', (req, res) => {
  const { version } = req.body || {};

  if (!version) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR', message: 'version wajib diisi',
    });
  }

  const versionFile = path.join(VERSIONS_DIR, `v${version}.json`);
  if (!fs.existsSync(versionFile)) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  try {
    const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

    // Simpan versi current sebelum rollback
    const current = readPrompts();
    saveVersion(current);

    // Rollback
    writePromptsFile(versionData.prompts);

    return res.json({
      ok  : true,
      data: { restoredVersion: Number(version) },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'INTERNAL_ERROR', message: err.message,
    });
  }
});

module.exports = router;
