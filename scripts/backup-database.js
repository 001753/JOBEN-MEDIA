'use strict';

/**
 * scripts/backup-database.js
 *
 * Backup otomatis database PostgreSQL production ke Cloudflare R2.
 * Didesain untuk dijalankan via Cron Job di cPanel (bukan di Replit dev —
 * dev pakai SQLite, backup ini khusus untuk PostgreSQL production).
 *
 * Alur:
 *   1. Jalankan `pg_dump` (custom format, ter-kompresi) ke file temp lokal.
 *   2. Upload file dump ke bucket R2 (folder backups/).
 *   3. Hapus file temp lokal.
 *   4. Hapus backup lama di R2 yang lebih tua dari BACKUP_RETENTION_DAYS.
 *
 * Cara pakai (cron cPanel, jalankan tiap hari):
 *   node scripts/backup-database.js
 *
 * Environment variable yang dibutuhkan (sama dengan .env production):
 *   DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USERNAME, DATABASE_PASSWORD
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME
 *   BACKUP_RETENTION_DAYS (opsional, default 14 hari)
 */

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 14;
const BACKUP_PREFIX = 'backups/';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable "${name}" belum diisi.`);
  }
  return value;
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

async function dumpDatabase() {
  const host = requireEnv('DATABASE_HOST');
  const port = process.env.DATABASE_PORT || '5432';
  const database = requireEnv('DATABASE_NAME');
  const username = requireEnv('DATABASE_USERNAME');
  const password = requireEnv('DATABASE_PASSWORD');

  const fileName = `joben-news-db_${timestamp()}.dump`;
  const filePath = path.join(os.tmpdir(), fileName);

  console.log(`[Backup] Menjalankan pg_dump untuk database "${database}"...`);

  await execFileAsync(
    'pg_dump',
    [
      '--host', host,
      '--port', String(port),
      '--username', username,
      '--format', 'custom',
      '--compress', '9',
      '--no-owner',
      '--no-privileges',
      '--file', filePath,
      database,
    ],
    {
      env: { ...process.env, PGPASSWORD: password },
      maxBuffer: 1024 * 1024 * 100, // 100MB
    }
  );

  const stats = fs.statSync(filePath);
  console.log(`[Backup] pg_dump selesai: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  return { filePath, fileName };
}

function buildS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: requireEnv('R2_ENDPOINT'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

async function uploadToR2(s3, filePath, fileName) {
  const bucket = requireEnv('R2_BUCKET_NAME');
  const key = `${BACKUP_PREFIX}${fileName}`;

  console.log(`[Backup] Upload ke R2: ${bucket}/${key}...`);

  const body = fs.readFileSync(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/octet-stream',
    })
  );

  console.log('[Backup] Upload ke R2 berhasil.');
}

async function pruneOldBackups(s3) {
  const bucket = requireEnv('R2_BUCKET_NAME');
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  console.log(`[Backup] Mengecek backup lama (retensi ${RETENTION_DAYS} hari)...`);

  const listResult = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: BACKUP_PREFIX })
  );

  const objects = listResult.Contents || [];
  const toDelete = objects.filter(
    (obj) => obj.LastModified && obj.LastModified.getTime() < cutoff
  );

  if (toDelete.length === 0) {
    console.log('[Backup] Tidak ada backup lama yang perlu dihapus.');
    return;
  }

  for (const obj of toDelete) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
    console.log(`[Backup] Backup lama dihapus: ${obj.Key}`);
  }

  console.log(`[Backup] Selesai hapus ${toDelete.length} backup lama.`);
}

async function main() {
  let filePath;
  try {
    const dump = await dumpDatabase();
    filePath = dump.filePath;

    const s3 = buildS3Client();
    await uploadToR2(s3, dump.filePath, dump.fileName);
    await pruneOldBackups(s3);

    console.log('[Backup] Selesai — database berhasil di-backup ke R2.');
  } catch (err) {
    console.error(`[Backup] GAGAL: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[Backup] File temp lokal dihapus.');
    }
  }
}

main();
