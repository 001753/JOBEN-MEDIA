'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::article.article', {
  config: {
    // GET /articles — public
    find: {},

    // GET /articles/:id — public
    findOne: {},

    // POST /articles — hanya user terautentikasi
    create: {
      middlewares: [],
    },

    // PUT /articles/:id — hanya user terautentikasi + cek kepemilikan
    update: {
      policies: ['api::article.is-own-article'],
    },

    // DELETE /articles/:id — hanya user terautentikasi + cek kepemilikan
    delete: {
      policies: ['api::article.is-own-article'],
    },
  },
});
