'use strict';

/**
 * src/index.js — Strapi register & bootstrap
 *
 * register(): transformasi URL file upload dari R2 private endpoint ke public URL
 * bootstrap(): konfigurasi public API permissions (idempotent — skip jika sudah ada)
 */

module.exports = {
  // ─────────────────────────────────────────────────────────────────────────
  // REGISTER — jalankan sebelum Strapi fully loaded
  // ─────────────────────────────────────────────────────────────────────────
  register({ strapi }) {
    // ── Transformasi URL R2 ──────────────────────────────────────────────────
    // @strapi/provider-upload-aws-s3 + forcePathStyle=true menghasilkan URL:
    //   https://{endpoint}/{bucket}/{key}  →  private, tidak bisa diakses publik
    // Kita perlu ubah ke:
    //   https://pub-xxx.r2.dev/{key}       →  public CDN URL
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
    const R2_ENDPOINT   = process.env.R2_ENDPOINT;
    const R2_BUCKET     = process.env.R2_BUCKET_NAME;

    if (R2_PUBLIC_URL && R2_ENDPOINT && R2_BUCKET) {
      const endpointHost = (() => {
        try { return new URL(R2_ENDPOINT).hostname; } catch { return null; }
      })();

      if (endpointHost) {
        strapi.db.lifecycles.subscribe({
          models: ['plugin::upload.file'],
          async afterCreate(event) {
            await fixR2Url(strapi, event.result, endpointHost, R2_BUCKET, R2_PUBLIC_URL);
          },
          async afterUpdate(event) {
            await fixR2Url(strapi, event.result, endpointHost, R2_BUCKET, R2_PUBLIC_URL);
          },
        });
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOOTSTRAP — jalankan setelah Strapi fully loaded
  // ─────────────────────────────────────────────────────────────────────────
  async bootstrap({ strapi }) {
    await configurePublicPermissions(strapi);
    const { seedCategoriesAndTags } = require('./seeds/categories-tags');
    await seedCategoriesAndTags(strapi);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fungsi: set public API permissions (idempotent)
//
// Mengizinkan request tanpa autentikasi untuk membaca artikel published,
// kategori, tag, halaman statis, dan profil author.
// Frontend Next.js menggunakan API Token, tapi ini berguna untuk:
//   1. Testing API secara langsung
//   2. Menjaga konsistensi permission antara dev & production
// ─────────────────────────────────────────────────────────────────────────────
async function configurePublicPermissions(strapi) {
  try {
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });

    if (!publicRole) {
      strapi.log.warn('[Bootstrap] Public role tidak ditemukan, skip permission setup.');
      return;
    }

    // Daftar action yang diizinkan untuk public (unauthenticated)
    const actionsToGrant = [
      // Article — read only (published saja, difilter di controller)
      'api::article.article.find',
      'api::article.article.findOne',
      // Category — read only
      'api::category.category.find',
      'api::category.category.findOne',
      // Tag — read only
      'api::tag.tag.find',
      'api::tag.tag.findOne',
      // Author — read only (untuk halaman /redaksi)
      'api::author.author.find',
      'api::author.author.findOne',
      // Page — read only (untuk halaman statis: About, Privacy Policy, Contact)
      'api::page.page.find',
      'api::page.page.findOne',
      // Upload — read only (untuk akses URL media jika perlu)
      'plugin::upload.content-api.find',
      'plugin::upload.content-api.findOne',
    ];

    // Cek permission yang sudah ada
    const existingPermissions = await strapi
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: { id: publicRole.id } } });

    const existingActions = new Set(existingPermissions.map(p => p.action));

    // Hanya buat permission yang belum ada (idempotent)
    const toCreate = actionsToGrant.filter(action => !existingActions.has(action));

    if (toCreate.length === 0) {
      strapi.log.info('[Bootstrap] Public permissions sudah dikonfigurasi, skip.');
      return;
    }

    for (const action of toCreate) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: { action, role: publicRole.id, enabled: true },
      });
    }

    strapi.log.info(`[Bootstrap] Public permissions dikonfigurasi: ${toCreate.join(', ')}`);
  } catch (err) {
    // Jangan crash Strapi jika bootstrap permission gagal
    strapi.log.error(`[Bootstrap] Gagal konfigurasi public permissions: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fungsi: transformasi URL file R2 dari private ke public
// ─────────────────────────────────────────────────────────────────────────────
async function fixR2Url(strapi, file, endpointHost, bucket, publicUrl) {
  if (!file?.url || !file.url.includes(endpointHost)) return;

  const extractKey = (url) => {
    const parts = url.split(`/${bucket}/`);
    return parts.length >= 2 ? parts[1] : null;
  };

  const key = extractKey(file.url);
  if (!key) return;

  const newUrl = `${publicUrl}/${key}`;

  // Transform format thumbnail (thumbnail, small, medium, large)
  const newFormats = {};
  if (file.formats && typeof file.formats === 'object') {
    for (const [size, fmt] of Object.entries(file.formats)) {
      if (fmt?.url?.includes(endpointHost)) {
        const fmtKey = extractKey(fmt.url);
        newFormats[size] = { ...fmt, url: fmtKey ? `${publicUrl}/${fmtKey}` : fmt.url };
      } else {
        newFormats[size] = fmt;
      }
    }
  }

  try {
    await strapi.db.query('plugin::upload.file').update({
      where: { id: file.id },
      data: {
        url: newUrl,
        ...(Object.keys(newFormats).length > 0 ? { formats: newFormats } : {}),
      },
    });
  } catch (err) {
    strapi.log.error(`[R2 URL Fix] Gagal update URL file id=${file.id}: ${err.message}`);
  }
}
