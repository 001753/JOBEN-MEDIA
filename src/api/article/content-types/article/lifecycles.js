'use strict';

/**
 * Lifecycle hooks untuk Article
 *
 * Hook A — State Machine editorial_status ↔ publishedAt (Strapi native draft/publish)
 * Hook B — Enforce satu breaking news aktif sekaligus
 * Hook C — Webhook on-demand revalidation ke Next.js setelah publish/update/delete
 */

module.exports = {
  // ─────────────────────────────────────────────────────────────────────────
  // BEFORE UPDATE — validasi state machine + enforce breaking news
  // ─────────────────────────────────────────────────────────────────────────
  async beforeUpdate(event) {
    const { data, where } = event.params;

    // ── Hook A: State Machine ───────────────────────────────────────────────
    if (data.editorial_status !== undefined) {
      const newStatus = data.editorial_status;

      if (newStatus === 'published') {
        // editorial_status=published → publishedAt harus terisi (set ke now() jika kosong)
        if (!data.publishedAt) {
          event.params.data.publishedAt = new Date();
        }
      } else if (newStatus === 'draft' || newStatus === 'review') {
        // editorial_status=draft/review → publishedAt harus null (unpublish)
        event.params.data.publishedAt = null;
      }
    }

    // Validasi kebalikan: jika publishedAt di-set manual, sinkronkan editorial_status
    if (data.publishedAt !== undefined && data.editorial_status === undefined) {
      if (data.publishedAt) {
        event.params.data.editorial_status = 'published';
      } else {
        // publishedAt di-set null → kembalikan ke draft
        event.params.data.editorial_status = 'draft';
      }
    }

    // ── Hook B: Enforce satu breaking news aktif sekaligus ─────────────────
    if (data.is_breaking_news === true) {
      const articleId = where.id;

      try {
        // Cari semua artikel lain yang is_breaking_news = true
        const currentBreaking = await strapi.db.query('api::article.article').findMany({
          where: {
            is_breaking_news: true,
            id: { $ne: articleId },
          },
          select: ['id', 'title'],
        });

        if (currentBreaking.length > 0) {
          // Reset semua artikel breaking news yang ada
          await strapi.db.query('api::article.article').updateMany({
            where: {
              is_breaking_news: true,
              id: { $ne: articleId },
            },
            data: { is_breaking_news: false },
          });

          strapi.log.info(
            `[Breaking News] Reset ${currentBreaking.length} artikel: ` +
            currentBreaking.map(a => `"${a.title}" (id:${a.id})`).join(', ')
          );
        }
      } catch (err) {
        strapi.log.error(`[Breaking News] Gagal reset artikel lain: ${err.message}`);
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BEFORE CREATE — set publishedAt berdasarkan editorial_status awal
  // ─────────────────────────────────────────────────────────────────────────
  beforeCreate(event) {
    const { data } = event.params;

    // Artikel baru biasanya draft — pastikan publishedAt null
    if (!data.editorial_status || data.editorial_status !== 'published') {
      event.params.data.publishedAt = null;
    } else if (data.editorial_status === 'published' && !data.publishedAt) {
      event.params.data.publishedAt = new Date();
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
    // Revalidate jika artikel published, atau baru saja di-unpublish (result.publishedAt null tapi status berubah)
    await triggerRevalidation(strapi, result);
  },

  async afterDelete(event) {
    const { result } = event;
    await triggerRevalidation(strapi, result);
  },
};

/**
 * Kirim HTTP POST ke Next.js /api/revalidate untuk invalidasi cache ISR.
 * Jika gagal: log error, jangan throw (jangan batalkan operasi Strapi).
 * Retry 1x setelah 2 detik jika request pertama gagal.
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
    // Retry 1x
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await doRequest();
      strapi.log.info(`[Revalidation] Retry berhasil: slug="${article.slug}"`);
    } catch (retryErr) {
      strapi.log.error(`[Revalidation] Retry gagal: ${retryErr.message}`);
    }
  }
}
