'use strict';

/**
 * Custom server untuk deployment di cPanel via Passenger.
 *
 * Passenger mengeset variabel PORT secara otomatis.
 * Jalankan: node server.js
 */

const { createServer } = require('http');
const { parse }        = require('url');
const next             = require('next');

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT, 10) || 3000;
const app  = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> JOBEN NEWS Frontend siap di http://localhost:${port}`);
  });
});
