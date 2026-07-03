'use strict';

/**
 * Policy: is-own-article
 *
 * Membatasi Penulis hanya bisa update/delete artikel milik sendiri.
 * Editor dan Super Admin bisa edit artikel siapa saja.
 *
 * Strapi v5: route param ctx.params.id berisi documentId (string UUID).
 * Gunakan strapi.db.query dengan where: { documentId } atau
 * strapi.documents() untuk Document Service API.
 */

module.exports = async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;

  // Tidak login — tolak
  if (!user) return false;

  const roleName = user.role?.name;

  // Super Admin & Editor boleh edit artikel siapa saja
  if (['Super Admin', 'Editor', 'Administrator'].includes(roleName)) {
    return true;
  }

  // Untuk Penulis (dan role lain): cek kepemilikan artikel
  // Strapi v5: ctx.params.id = documentId (UUID string)
  const documentId = policyContext.params?.id;

  if (!documentId) return false;

  // Cari profil Author milik user yang login
  const author = await strapi.db.query('api::author.author').findOne({
    where: { user: { id: user.id } },
    select: ['id', 'documentId'],
  });

  if (!author) {
    policyContext.badRequest(
      'Akun Anda belum memiliki profil Author. Hubungi Super Admin.'
    );
    return false;
  }

  // Cari artikel via documentId (Strapi v5 Document Service)
  let article;
  try {
    article = await strapi.documents('api::article.article').findOne({
      documentId,
      populate: { author: { fields: ['id', 'documentId'] } },
    });
  } catch (err) {
    strapi.log.error(`[is-own-article] Gagal query artikel documentId=${documentId}: ${err.message}`);
    return false;
  }

  if (!article) {
    policyContext.notFound('Artikel tidak ditemukan.');
    return false;
  }

  // Cek apakah author artikel === author milik user yang login
  // Bandingkan via documentId untuk konsistensi Strapi v5
  const articleAuthorDocId = article.author?.documentId;
  const userAuthorDocId   = author.documentId;

  if (!articleAuthorDocId || articleAuthorDocId !== userAuthorDocId) {
    policyContext.forbidden('Anda hanya dapat mengedit artikel yang Anda buat sendiri.');
    return false;
  }

  // Cek tambahan untuk Penulis: tidak boleh set editorial_status = 'published'
  if (roleName === 'Penulis') {
    const body = policyContext.request?.body?.data;
    if (body?.editorial_status === 'published' || body?.publishedAt) {
      policyContext.forbidden('Penulis tidak memiliki hak untuk mempublikasikan artikel langsung.');
      return false;
    }
  }

  return true;
};
