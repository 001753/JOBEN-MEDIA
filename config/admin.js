'use strict';

/**
 * config/admin.js — Admin panel & security configuration
 * (Strapi v5: admin config harus di file ini, bukan config/app.js)
 */

module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ADMIN_JWT_SECRET'), // pakai secret yang sama jika belum ada key terpisah
  },
  flags: {
    nps: false,
    promoteEE: false,
  },
});
