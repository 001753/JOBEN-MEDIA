'use strict';

/**
 * Custom server untuk deployment di cPanel via Passenger.
 *
 * Menggunakan Next.js standalone output — tidak perlu npm install
 * di cPanel. Semua deps sudah di-bundle ke .next/standalone/
 *
 * Passenger mengeset variabel PORT secara otomatis.
 */

const path = require('path');
const fs   = require('fs');

const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');

if (!fs.existsSync(standaloneServer)) {
  console.error('[frontend] ERROR: .next/standalone/server.js tidak ditemukan.');
  console.error('[frontend] Jalankan: npm run build:all di Replit → commit → push → deploy lagi');
  process.exit(1);
}

// Standalone server membaca PORT dari env — Passenger set otomatis
process.env.PORT = process.env.PORT || 3000;
process.env.HOSTNAME = '0.0.0.0';

require(standaloneServer);
