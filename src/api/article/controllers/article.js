'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({

  /**
   * Override create: otomatis set author berdasarkan user yang sedang login.
   * Hanya aktif jika user terautentikasi (Penulis/Editor).
   * Super Admin tetap bisa set author manual.
   */
  async create(ctx) {
    const user = ctx.state.user;

    if (user) {
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

        // Override author di request body
        ctx.request.body.data = {
          ...ctx.request.body.data,
          author: author.id,
          editorial_status: 'draft', // Penulis selalu mulai dari draft
        };
      }
    }

    return super.create(ctx);
  },

  /**
   * Override find: tambahkan filter editorial_status=published untuk
   * request yang tidak terautentikasi (public/frontend).
   */
  async find(ctx) {
    // Jika request dari public (tidak ada user login), hanya tampilkan yang published
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
   * Override findOne: pastikan artikel yang diminta sudah published
   * untuk request public.
   */
  async findOne(ctx) {
    const response = await super.findOne(ctx);

    // Jika request dari public dan artikel belum published, return 404
    if (!ctx.state.user && response?.data?.attributes?.editorial_status !== 'published') {
      return ctx.notFound('Artikel tidak ditemukan.');
    }

    return response;
  },
}));
