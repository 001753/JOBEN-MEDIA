'use strict';

module.exports = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            // Cloudflare R2 public URL
            'pub-eb6a0f12e3b748628e7fb3494cb105a4.r2.dev',
            // R2 Storage endpoint (untuk admin panel preview)
            '6ffcdac7c1cf3d08b80450851f6646a3.r2.cloudflarestorage.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'pub-eb6a0f12e3b748628e7fb3494cb105a4.r2.dev',
            '6ffcdac7c1cf3d08b80450851f6646a3.r2.cloudflarestorage.com',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    // strapi::cors — Strapi v5: hapus `enabled` (deprecated), selalu aktif jika ada di array
    name: 'strapi::cors',
    config: {
      headers: '*',
      origin: [
        'https://news.jobenapp.cloud',     // Production frontend
        'https://cms.news.jobenapp.cloud', // CMS sendiri (untuk admin panel)
        'http://localhost:3000',            // Next.js development
        'http://localhost:3001',            // Alternatif dev
        'http://localhost:1337',            // Strapi development
        'http://localhost:5000',            // Replit preview port
        /\.replit\.dev$/,                   // Replit preview domains
        /\.pike\.replit\.dev$/,             // Replit pike preview domains
      ],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
