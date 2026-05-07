/**
 * ═══════════════════════════════════════════════════════
 *   S E L E N A   T V  —  B A C K E N D   S E R V E R
 * ═══════════════════════════════════════════════════════
 *   Private Premium IPTV Engine
 *   Personal Use Only
 * ═══════════════════════════════════════════════════════
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const log = require('./src/utils/logger');
const apiRoutes = require('./src/api/routes');
const cache = require('./src/cache/cacheManager');
const { runFullPipeline, refreshEPG, startScheduler } = require('./src/scheduler/scheduler');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ── Middleware ──
app.use(cors({
  origin: '*', // Allow webOS app to connect
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Selena-Admin', 'Authorization'],
}));
app.use(express.json());

// ── Request logging ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.includes('favicon')) {
      log.debug('HTTP', `${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ── Static files (logos, assets) ──
app.use('/assets', express.static(path.join(__dirname, 'storage', 'assets'), {
  maxAge: '7d',
  immutable: true,
}));

// ── API Routes ──
app.use('/api', apiRoutes);

// ── Logo proxy endpoint ──
app.get('/api/logo/:name', (req, res) => {
  // Return a simple SVG placeholder with channel initial
  const name = req.params.name || '?';
  const initial = name.charAt(0).toUpperCase();
  const colors = ['#C6A972', '#D4AF37', '#5B8C5A', '#3B6B9A', '#9A3B5B'];
  const color = colors[initial.charCodeAt(0) % colors.length];

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="12" fill="${color}" opacity="0.2"/>
    <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
    <text x="50" y="58" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="700" fill="${color}">${initial}</text>
  </svg>`);
});

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Root ──
app.get('/', (req, res) => {
  const store = cache.getStore();
  res.json({
    name: 'SelenaTV Backend',
    version: '1.0.0',
    status: 'online',
    channels: (store.channels || []).length,
    endpoints: {
      channels: '/api/channels',
      categories: '/api/categories',
      featured: '/api/featured',
      epg: '/api/epg',
      search: '/api/search?q=',
      status: '/api/status',
    },
  });
});

// ── Start Server ──
async function boot() {
  console.log('');
  console.log('\x1b[33m ═══════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[33m   ███████╗███████╗██╗     ███████╗███╗   ██╗ █████╗ ████████╗██╗   ██╗\x1b[0m');
  console.log('\x1b[33m   ██╔════╝██╔════╝██║     ██╔════╝████╗  ██║██╔══██╗╚══██╔══╝██║   ██║\x1b[0m');
  console.log('\x1b[33m   ███████╗█████╗  ██║     █████╗  ██╔██╗ ██║███████║   ██║   ██║   ██║\x1b[0m');
  console.log('\x1b[33m   ╚════██║██╔══╝  ██║     ██╔══╝  ██║╚██╗██║██╔══██║   ██║   ╚██╗ ██╔╝\x1b[0m');
  console.log('\x1b[33m   ███████║███████╗███████╗███████╗██║ ╚████║██║  ██║   ██║    ╚████╔╝ \x1b[0m');
  console.log('\x1b[33m   ╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝   ╚═╝     ╚═══╝  \x1b[0m');
  console.log('\x1b[33m ═══════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[2m  Private Premium IPTV Engine v1.0.0\x1b[0m');
  console.log('');

  // Load existing cache for instant startup
  log.info('Boot', '📂 Loading cached data...');
  cache.loadCache();

  const store = cache.getStore();
  if (store.channels && store.channels.length > 0) {
    log.info('Boot', `✅ Cache loaded: ${store.channels.length} channels ready`);
  } else {
    log.info('Boot', '⚠️ No cache found, will run initial scan...');
  }

  // Start HTTP server
  app.listen(PORT, HOST, () => {
    log.info('Boot', `🌐 Server running at http://${HOST}:${PORT}`);
    log.info('Boot', `📡 API available at http://${HOST}:${PORT}/api`);
  });

  // Run initial pipeline if no cache
  if (!store.channels || store.channels.length === 0) {
    log.info('Boot', '🔄 Running initial scan pipeline...');
    await runFullPipeline();
    await refreshEPG();
  }

  // Start automated scheduler
  startScheduler();
}

boot().catch(err => {
  log.error('Boot', `Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
