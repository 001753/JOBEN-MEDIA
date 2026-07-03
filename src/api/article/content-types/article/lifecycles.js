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
        // Otomatis set publishedAt jika belum ada
        if (!data.publishedAt) {
          event.params.data.publishedAt = new Date();
        }
      } else if (newStatus === 'draft' || newStatus === 'review') {
        // Otomatis kosongkan publishedAt saat unpublish/kembali ke draft
        event.params.data.publishedAt = null;
      }
    }

    // Validasi kebalikan: jika publishedAt di-set manual tanpa editorial_status,
    // sinkronkan editorial_status secara otomatis
    if (data.publishedAt !== undefined && data.editorial_status === undefined) {
      event.params.data.editorial_status = data.publishedAt ? 'published' : 'draft';
    }

    // ── Hook B: Enforce satu breaking news aktif sekaligus ─────────────────
    // Strategi atomik: reset semua artikel LAIN sebelum set artikel ini.
    // Mitigasi race condition: tidak ada gap antara check dan update.
    if (data.is_breaking_news === true) {
      const currentId = where.id;

      if (currentId) {
        try {
          const resetResult = await strapi.db.query('api::article.article').updateMany({
            where: {
              is_breaking_news: true,
              id: { $ne: currentId },
            },
            data: { is_breaking_news: false },
          });

          if (resetResult?.count > 0) {
            strapi.log.info(
              `[Breaking News] Reset ${resetResult.count} artikel breaking news sebelumnya.`
            );
          }
        } catch (err) {
          strapi.log.error(`[Breaking News] Gagal reset artikel lain: ${err.message}`);
        }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AFTER CREATE — webhook revalidation jika artikel langsung published
  // ─────────────────────────────────────────────────────────────────────────
  async afterCreate(event) {
    const { result } = event;
    if (result.editorial_status === 'published') {
      await triggerRevalidation(result.id, result.slug);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AFTER UPDATE — webhook revalidation untuk semua perubahan artikel
  // (published dan unpublish — keduanya perlu update cache frontend)
  // ─────────────────────────────────────────────────────────────────────────
  async afterUpdate(event) {
    const { result } = event;
    await triggerRevalidation(result.id, result.slug);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AFTER DELETE — hapus cache artikel yang dihapus dari frontend
  // ─────────────────────────────────────────────────────────────────────────
  async afterDelete(event) {
    const { result } = event;
    await triggerRevalidation(result.id, result.slug);
  },
};

/**
 * Kirim HTTP POST ke Next.js /api/revalidate untuk invalidasi cache ISR.
 * Mengambil categorySlug dari database karena result lifecycle tidak populate relasi.
 * Retry 1x setelah 2 detik jika request pertama gagal.
 * Jika gagal: log error saja, jangan throw (operasi Strapi tetap berhasil).
 */
async function triggerRevalidation(articleId, slug) {
  const url    = process.env.NEXTJS_REVALIDATION_URL;
  const secret = process.env.REVALIDATION_SECRET;

  if (!url || !secret) return; // Belum dikonfigurasi — normal di dev lokal

  // Fetch categorySlug dari DB karena lifecycle result tidak populate relasi
  let categorySlug = null;
  if (articleId) {
    try {
      const full = await strapi.db.query('api::article.article').findOne({
        where: { id: articleId },
        populate: { category: { select: ['slug'] } },
      });
      categorySlug = full?.category?.slug ?? null;
    } catch (_) {
      // Tidak fatal — lanjutkan tanpa categorySlug
    }
  }

  const payload = JSON.stringify({ model: 'article', slug, categorySlug });

  const doRequest = async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: payload,
      signal: AbortSignal.timeout(8000), // timeout 8 detik
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)');
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    return res;
  };

  try {
    await doRequest();
    strapi.log.info(`[Revalidation] OK: slug="${slug}", category="${categorySlug}"`);
  } catch (err) {
    strapi.log.warn(`[Revalidation] Gagal (percobaan 1): ${err.message}. Retry 2s...`);
    await new Promise(r => setTimeout(r, 2000));
    try {
      await doRequest();
      strapi.log.info(`[Revalidation] Retry berhasil: slug="${slug}"`);
    } catch (retryErr) {
      strapi.log.error(`[Revalidation] Retry gagal untuk slug="${slug}": ${retryErr.message}`);
    }
  }
}
