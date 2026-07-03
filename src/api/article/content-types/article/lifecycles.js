'use strict';

/**
 * Lifecycle hooks untuk Article
 *
 * Hook A — State Machine editorial_status ↔ publishedAt (Strapi native draft/publish)
 * Hook B — Enforce satu breaking news aktif sekaligus (atomic updateMany)
 * Hook C — Webhook on-demand revalidation ke Next.js setelah publish/update/delete
 */

module.exports = {
  // ─────────────────────────────────────────────────────────────────────────
  // BEFORE CREATE — set publishedAt berdasarkan editorial_status awal
  // ─────────────────────────────────────────────────────────────────────────
  beforeCreate(event) {
    const { data } = event.params;

    if (data.editorial_status === 'published') {
      if (!data.publishedAt) {
        event.params.data.publishedAt = new Date();
      }
    } else {
      // draft / review — pastikan publishedAt null
      event.params.data.publishedAt = null;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BEFORE UPDATE — state machine + breaking news enforcement
  // ─────────────────────────────────────────────────────────────────────────
  async beforeUpdate(event) {
    const { data, where } = event.params;

    // ── Hook A: State Machine ───────────────────────────────────────────────
    if (data.editorial_status !== undefined) {
      const newStatus = data.editorial_status;

      if (newStatus === 'published') {
        if (!data.publishedAt) {
          event.params.data.publishedAt = new Date();
        }
      } else if (newStatus === 'draft' || newStatus === 'review') {
        event.params.data.publishedAt = null;
      }
    }

    // Validasi kebalikan: jika publishedAt di-set manual, sinkronkan editorial_status
    if (data.publishedAt !== undefined && data.editorial_status === undefined) {
      if (data.publishedAt) {
        event.params.data.editorial_status = 'published';
      } else {
        event.params.data.editorial_status = 'draft';
      }
    }

    // ── Hook B: Enforce satu breaking news aktif sekaligus ─────────────────
    // Strategi atomik: selalu reset semua artikel LAIN dulu sebelum set artikel ini.
    // UpdateMany + check dilakukan tanpa gap "check → update" sehingga mitigasi race condition.
    if (data.is_breaking_news === true) {
      const currentId = where.id;

      if (currentId) {
        try {
          const resetCount = await strapi.db.query('api::article.article').updateMany({
            where: {
              is_breaking_news: true,
              id: { $ne: currentId },
            },
            data: { is_breaking_news: false },
          });

          if (resetCount?.count > 0) {
            strapi.log.info(
              `[Breaking News] Reset ${resetCount.count} artikel breaking news sebelumnya.`
            );
          }
        } catch (err) {
          strapi.log.error(`[Breaking News] Gagal reset artikel lain: ${err.message}`);
        }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AFTER CREATE/UPDATE/DELETE — webhook on-demand revalidation ke Next.js
  // ─────────────────────────────────────────────────────────────────────────
  async afterCreate(event) {
    const { result } = event;
    if (result.editorial_status === 'published') {
      await triggerRevalidation(strapi, result);
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    await triggerRevalidation(strapi, result);
  },

  async afterDelete(event) {
    const { result } = event;
    await triggerRevalidation(strapi, result);
  },
};

/**
 * Kirim HTTP POST ke Next.js /api/revalidate untuk invalidasi cache ISR.
 * Retry 1x setelah 2 detik jika request pertama gagal.
 * Jika gagal: log error saja, jangan throw (operasi Strapi tetap berlanjut).
 */
async function triggerRevalidation(strapi, article) {
  const url    = process.env.NEXTJS_REVALIDATION_URL;
  const secret = process.env.REVALIDATION_SECRET;

  if (!url || !secret) return; // Belum dikonfigurasi (normal di development)

  const payload = JSON.stringify({
    secret,
    slug: article.slug,
    categorySlug: article.category?.slug ?? null,
  });

  const doRequest = async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }
    return response;
  };

  try {
    await doRequest();
    strapi.log.info(`[Revalidation] Berhasil: slug="${article.slug}"`);
  } catch (err) {
    strapi.log.warn(`[Revalidation] Gagal (percobaan 1): ${err.message}. Retry dalam 2 detik...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await doRequest();
      strapi.log.info(`[Revalidation] Retry berhasil: slug="${article.slug}"`);
    } catch (retryErr) {
      strapi.log.error(`[Revalidation] Retry gagal: ${retryErr.message}`);
    }
  }
}
