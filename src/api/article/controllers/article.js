'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({

  /**
   * Override create: otomatis set author berdasarkan user yang sedang login.
   * Hanya aktif jika user terautentikasi (Penulis/Editor).
   */
  async create(ctx) {
    const user = ctx.state.user;

    // Wajib login untuk create artikel
    if (!user) {
      return ctx.unauthorized('Anda harus login untuk membuat artikel.');
    }

    const roleName = user.role?.name;

    // Untuk Penulis: author otomatis = profil Author milik user ini
    if (roleName === 'Penulis') {
      const author = await strapi.db.query('api::author.author').findOne({
        where: { user: { id: user.id } },
      });

      if (!author) {
        return ctx.badRequest(
          'Akun Anda belum memiliki profil Author. Hubungi Super Admin untuk membuat profil Author.'
        );
      }

      // Override author di request body + paksa editorial_status=draft
      ctx.request.body.data = {
        ...ctx.request.body.data,
        author: author.documentId ?? author.id,
        editorial_status: 'draft',
      };
    }

    return super.create(ctx);
  },

  /**
   * Override find: untuk request public (tidak login),
   * tambahkan filter editorial_status=published.
   */
  async find(ctx) {
    if (!ctx.state.user) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...ctx.query?.filters,
          editorial_status: 'published',
        },
      };
    }
    return super.find(ctx);
  },

  /**
   * Override findOne: untuk request public, pastikan artikel sudah published.
   * Strapi v5: response.data adalah flat object (bukan { attributes: {} })
   */
  async findOne(ctx) {
    const response = await super.findOne(ctx);

    // Jika artikel tidak ditemukan, biarkan Strapi mengembalikan 404
    if (!response?.data) return response;

    // Cek untuk public request: hanya published yang boleh dilihat
    if (!ctx.state.user && response.data.editorial_status !== 'published') {
      return ctx.notFound('Artikel tidak ditemukan.');
    }

    return response;
  },
}));
