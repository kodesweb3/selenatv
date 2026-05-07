/**
 * AegisTV — Development Preview Server
 * Serves the webOS app locally for browser testing
 * Run: node dev-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const WEBOS_DIR = path.join(__dirname, 'webos-app');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(WEBOS_DIR, filePath.split('?')[0]);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('\x1b[33m ═══════════════════════════════════════\x1b[0m');
  console.log('\x1b[33m   AegisTV — Dev Preview Server\x1b[0m');
  console.log('\x1b[33m ═══════════════════════════════════════\x1b[0m');
  console.log(`\x1b[32m   http://localhost:${PORT}\x1b[0m`);
  console.log('\x1b[2m   Serving webOS app for browser preview\x1b[0m');
  console.log('');
});
