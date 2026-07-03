'use strict';

/**
 * src/index.js — Strapi bootstrap & register hooks
 *
 * 1. Transformasi URL file upload dari endpoint R2 private
 *    ke R2 public URL (pub-*.r2.dev)
 */

module.exports = {
  register({ strapi }) {
    // ── Transformasi URL R2 ──────────────────────────────────────────────────
    // @strapi/provider-upload-aws-s3 menghasilkan URL dengan format:
    //   https://{endpoint}/{bucket}/{key}   (forcePathStyle: true)
    // Kita perlu mengubahnya ke:
    //   https://pub-xxx.r2.dev/{key}
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

  bootstrap({ strapi }) {},
};

/**
 * Ganti URL private R2 endpoint dengan public URL.
 * Juga transform URL thumbnail (formats) jika ada.
 */
async function fixR2Url(strapi, file, endpointHost, bucket, publicUrl) {
  if (!file?.url || !file.url.includes(endpointHost)) return;

  const extractKey = (url) => {
    const parts = url.split(`/${bucket}/`);
    return parts.length >= 2 ? parts[1] : null;
  };

  const key = extractKey(file.url);
  if (!key) return;

  const newUrl = `${publicUrl}/${key}`;

  // Transform formats (thumbnail, small, medium, large)
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
