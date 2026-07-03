'use strict';

module.exports = ({ env }) => ({
  // ─── Upload Provider: Cloudflare R2 (S3-compatible) ───────────────────────
  // File diunggah ke R2 via AWS SDK S3Client (region: 'auto' khusus untuk R2).
  // URL publik ditransformasi via lifecycle hook di src/index.js karena
  // S3 provider menghasilkan URL endpoint private — bukan pub-*.r2.dev.
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        // s3Options: wrapper wajib di Strapi v5 (deprecation warning jika di root)
        s3Options: {
          credentials: {
            accessKeyId: env('R2_ACCESS_KEY_ID'),
            secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
          },
          region: 'auto',
          endpoint: env('R2_ENDPOINT'),
          forcePathStyle: true,
          params: {
            Bucket: env('R2_BUCKET_NAME'),
          },
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },

  // ─── Users & Permissions ──────────────────────────────────────────────────
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '7d',
      },
    },
  },
});
