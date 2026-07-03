'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::article.article', {
  config: {
    // GET /articles — public (filter editorial_status=published di controller)
    find: {},

    // GET /articles/:id — public (cek published di controller)
    findOne: {},

    // POST /articles — hanya user terautentikasi (dicek di controller)
    // Policy is-authenticated tidak perlu karena controller sudah cek ctx.state.user
    create: {},

    // PUT /articles/:id — hanya user terautentikasi + cek kepemilikan via policy
    update: {
      policies: ['api::article.is-own-article'],
    },

    // DELETE /articles/:id — hanya user terautentikasi + cek kepemilikan via policy
    delete: {
      policies: ['api::article.is-own-article'],
    },
  },
});
