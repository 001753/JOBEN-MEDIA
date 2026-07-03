'use strict';

/**
 * Policy: is-own-article
 *
 * Membatasi Penulis hanya bisa update/delete artikel milik sendiri.
 * Editor dan Super Admin bisa edit artikel siapa saja.
 * Terapkan policy ini HANYA pada route update (PUT) dan delete (DELETE).
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
  const articleId = policyContext.params?.id;

  if (!articleId) return false;

  // Cari profil Author milik user yang login
  const author = await strapi.db.query('api::author.author').findOne({
    where: { user: { id: user.id } },
    select: ['id'],
  });

  if (!author) {
    // User tidak punya profil Author — tolak dengan pesan informatif
    policyContext.badRequest(
      'Akun Anda belum memiliki profil Author. Hubungi Super Admin.'
    );
    return false;
  }

  // Cari artikel yang hendak diedit
  const article = await strapi.db.query('api::article.article').findOne({
    where: { id: articleId },
    populate: { author: { select: ['id'] } },
  });

  if (!article) {
    policyContext.notFound('Artikel tidak ditemukan.');
    return false;
  }

  // Cek apakah article.author === author milik user yang login
  if (article.author?.id !== author.id) {
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
