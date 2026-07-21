'use strict';

/**
 * app.js — Startup file Next.js untuk cPanel Node.js Selector (Passenger)
 *
 * Set file ini sebagai "Application startup file" di cPanel > Setup Node.js App
 * untuk app Next.js (news.jobenapp.cloud).
 *
 * Catatan struktur:
 *   - server.js  → Strapi CMS  (cms.jobenapp.cloud)
 *   - app.js     → Next.js Frontend (news.jobenapp.cloud)
 *
 * Kedua app berbagi Application root yang sama di cPanel.
 * Passenger membedakannya berdasarkan startup file.
 */

require('./frontend/server.js');
