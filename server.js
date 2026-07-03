'use strict';

/**
 * server.js — Startup file untuk cPanel Node.js Selector (Passenger)
 *
 * Set file ini sebagai "Application startup file" di cPanel > Setup Node.js App.
 * Passenger akan inject process.env.PORT secara otomatis — JANGAN hardcode port.
 *
 * Jalankan di cPanel Terminal:
 *   npm install
 *   NODE_ENV=production npm run build
 *   (lalu restart app via cPanel panel)
 */

process.env.PORT = process.env.PORT || 1337;

const strapi = require('@strapi/strapi');

strapi.createStrapi().start();
