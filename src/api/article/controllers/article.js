'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

/**
 * Populate default untuk endpoint publik.
 * Mengembalikan semua data relasi yang dibutuhkan frontend Next.js
 * tanpa perlu client mengirim ?populate=* (yang berbahaya di production).
 */
const DEFAULT_POPULATE = {
  cover_image: {
    fields: ['url', 'alternativeText', 'width', 'height', 'formats'],
  },
  category: {
    fields: ['name', 'slug'],
  },
  tags: {
    fields: ['name', 'slug'],
  },
  author: {
    fields: ['name', 'bio', 'role_label'],
    populate: {
      photo: { fields: ['url', 'alternativeText'] },
    },
  },
};

module.exports = createCoreController('api::article.article', ({ strapi }) => ({

  /**
   * GET /api/articles
   * Override find: filter editorial_status=published untuk public request,
   * dan terapkan DEFAULT_POPULATE jika tidak ada populate dari client.
   */
  async find(ctx) {
    const isAuthenticated = !!ctx.state.user;

    ctx.query = {
      ...ctx.query,
      populate: ctx.query.populate ?? DEFAULT_POPULATE,
    };

    if (!isAuthenticated) {
      ctx.query.filters = {
        ...ctx.query?.filters,
        editorial_status: 'published',
      };
    }

    return super.find(ctx);
  },

  /**
   * GET /api/articles/:id
   * Override findOne: public hanya bisa lihat artikel published,
   * dan terapkan DEFAULT_POPULATE.
   */
  async findOne(ctx) {
    ctx.query = {
      ...ctx.query,
      populate: ctx.query.populate ?? DEFAULT_POPULATE,
    };

    const response = await super.findOne(ctx);

    if (!response?.data) return response;

    if (!ctx.state.user && response.data.editorial_status !== 'published') {
      return ctx.notFound('Artikel tidak ditemukan.');
    }

    return response;
  },

  /**
   * POST /api/articles
   * Override create:
   * - Wajib login
   * - Untuk role Penulis: author otomatis = profil Author milik user ini,
   *   editorial_status dikunci ke 'draft'
   * - Untuk Editor/Admin: bebas set author dan status
   */
  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Anda harus login untuk membuat artikel.');
    }

    const roleName = user.role?.name;

    if (roleName === 'Penulis') {
      const author = await strapi.db.query('api::author.author').findOne({
        where: { user: { id: user.id } },
        select: ['id', 'documentId'],
      });

      if (!author) {
        return ctx.badRequest(
          'Akun Anda belum memiliki profil Author. Hubungi Super Admin untuk membuat profil Author.'
        );
      }

      ctx.request.body.data = {
        ...ctx.request.body.data,
        author: author.documentId ?? author.id,
        editorial_status: 'draft',
        publishedAt: null,
      };
    }

    return super.create(ctx);
  },
}));
