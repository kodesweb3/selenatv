/**
 * AegisTV API Routes — JSON API for the webOS frontend
 */

const express = require('express');
const router = express.Router();
const cache = require('../cache/cacheManager');
const { getCurrentProgram, getChannelSchedule } = require('../epg/epgProcessor');
const log = require('../utils/logger');

/**
 * GET /api/channels
 * Returns all channels, optionally filtered by category
 */
router.get('/channels', (req, res) => {
  const store = cache.getStore();
  let channels = store.channels || [];

  // Filter by category
  if (req.query.category) {
    channels = channels.filter(ch =>
      ch.category.toLowerCase() === req.query.category.toLowerCase()
    );
  }

  // Attach current EPG if available
  channels = channels.map(ch => ({
    ...ch,
    epg: ch.epgId ? getCurrentProgram(store.epg, ch.epgId) : { now: null, next: null },
  }));

  res.json({
    count: channels.length,
    updatedAt: store.lastUpdate,
    channels,
  });
});

/**
 * GET /api/channels/:id
 * Returns a single channel with full details
 */
router.get('/channels/:id', (req, res) => {
  const store = cache.getStore();
  const channel = (store.channels || []).find(ch => ch.id === req.params.id);

  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const epg = channel.epgId ? getCurrentProgram(store.epg, channel.epgId) : { now: null, next: null };
  const schedule = channel.epgId ? getChannelSchedule(store.epg, channel.epgId) : [];

  res.json({
    ...channel,
    epg,
    schedule,
  });
});

/**
 * GET /api/categories
 * Returns all categories with channel counts
 */
router.get('/categories', (req, res) => {
  const store = cache.getStore();
  res.json({
    categories: store.categories || [],
  });
});

/**
 * GET /api/featured
 * Returns featured/promoted channels
 */
router.get('/featured', (req, res) => {
  const store = cache.getStore();
  const featured = (store.featured || []).map(ch => ({
    ...ch,
    epg: ch.epgId ? getCurrentProgram(store.epg, ch.epgId) : { now: null, next: null },
  }));

  res.json({
    count: featured.length,
    channels: featured,
  });
});

/**
 * GET /api/epg
 * Returns EPG for all or specific channels
 */
router.get('/epg', (req, res) => {
  const store = cache.getStore();

  if (req.query.channel) {
    const schedule = getChannelSchedule(store.epg, req.query.channel);
    return res.json({ channel: req.query.channel, schedule });
  }

  // Return current programs for all channels
  const now = {};
  for (const ch of (store.channels || [])) {
    if (ch.epgId) {
      now[ch.id] = getCurrentProgram(store.epg, ch.epgId);
    }
  }

  res.json({ programs: now });
});

/**
 * GET /api/search
 * Search channels by name
 */
router.get('/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();
  if (!query) {
    return res.json({ count: 0, channels: [] });
  }

  const store = cache.getStore();
  const results = (store.channels || []).filter(ch =>
    ch.name.toLowerCase().includes(query) ||
    ch.category.toLowerCase().includes(query) ||
    ch.id.includes(query)
  );

  res.json({
    query: req.query.q,
    count: results.length,
    channels: results,
  });
});

/**
 * GET /api/status
 * Returns system status and stats
 */
router.get('/status', (req, res) => {
  const store = cache.getStore();
  res.json({
    status: 'online',
    version: '1.0.0',
    name: 'AegisTV',
    channels: (store.channels || []).length,
    categories: (store.categories || []).length,
    epgChannels: Object.keys(store.epg || {}).length,
    lastUpdate: store.lastUpdate,
    stats: store.stats,
    uptime: process.uptime(),
  });
});

/**
 * POST /api/admin/recategorize
 * Re-applies categorization from channel names on cached data (no full scan).
 * If SELENA_ADMIN_KEY is set, send header: X-Selena-Admin: <key> or Authorization: Bearer <key>
 */
router.post('/admin/recategorize', (req, res) => {
  const requiredKey = process.env.SELENA_ADMIN_KEY;
  if (requiredKey) {
    const header = req.get('x-selena-admin') || '';
    const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (header !== requiredKey && bearer !== requiredKey) {
      log.warn('API', 'recategorize: unauthorized attempt');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  const result = cache.recategorizeFromCache();
  if (!result.ok) {
    return res.status(400).json(result);
  }

  log.info('API', '✅ Recategorize finished via API');
  res.json(result);
});

module.exports = router;
