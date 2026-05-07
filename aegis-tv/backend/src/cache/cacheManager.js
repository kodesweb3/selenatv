/**
 * AegisTV Cache Manager — Local JSON cache for ultra-fast startup
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { getCategories, getFeaturedChannels, recategorizeChannelList } = require('../ranking/channelRanker');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const CHANNELS_DIR = path.join(STORAGE_DIR, 'channels');
const CACHE_DIR = path.join(STORAGE_DIR, 'cache');
const EPG_DIR = path.join(STORAGE_DIR, 'epg');
const LOGS_DIR = path.join(STORAGE_DIR, 'logs');

// Ensure directories exist
[STORAGE_DIR, CHANNELS_DIR, CACHE_DIR, EPG_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * In-memory store for hot data
 */
const store = {
  channels: [],
  categories: [],
  featured: [],
  epg: {},
  lastUpdate: null,
  stats: { totalScans: 0, aliveChannels: 0, deadRemoved: 0 },
};

/**
 * Save channels to disk cache
 */
function saveChannels(channels) {
  store.channels = channels;
  store.lastUpdate = new Date().toISOString();
  writeJson(path.join(CACHE_DIR, 'channels.json'), channels);
  log.info('Cache', `💾 Saved ${channels.length} channels to cache`);
}

/**
 * Save categories to disk cache
 */
function saveCategories(categories) {
  store.categories = categories;
  writeJson(path.join(CACHE_DIR, 'categories.json'), categories);
}

/**
 * Save featured channels to disk cache
 */
function saveFeatured(featured) {
  store.featured = featured;
  writeJson(path.join(CACHE_DIR, 'featured.json'), featured);
}

/**
 * Save EPG data to disk cache
 */
function saveEPG(epg) {
  store.epg = epg;
  writeJson(path.join(EPG_DIR, 'epg.json'), epg);
  log.info('Cache', `💾 Saved EPG data (${Object.keys(epg).length} channels)`);
}

/**
 * Load all cached data from disk (for startup)
 */
function loadCache() {
  log.info('Cache', '📂 Loading cache from disk...');

  const channels = readJson(path.join(CACHE_DIR, 'channels.json'));
  if (channels) {
    store.channels = channels;
    log.info('Cache', `Loaded ${channels.length} cached channels`);
  }

  const categories = readJson(path.join(CACHE_DIR, 'categories.json'));
  if (categories) store.categories = categories;

  const featured = readJson(path.join(CACHE_DIR, 'featured.json'));
  if (featured) store.featured = featured;

  const epg = readJson(path.join(EPG_DIR, 'epg.json'));
  if (epg) {
    store.epg = epg;
    log.info('Cache', `Loaded EPG for ${Object.keys(epg).length} channels`);
  }

  return store;
}

/**
 * Get in-memory store
 */
function getStore() {
  return store;
}

/**
 * Re-run categorization on in-memory channels (same rules as full scan), then
 * rebuild categories + featured and persist. No IPTV scan / validation.
 */
function recategorizeFromCache() {
  if (!store.channels || store.channels.length === 0) {
    log.warn('Cache', 'recategorizeFromCache: no channels in store');
    return { ok: false, error: 'No channels in cache' };
  }

  const updated = recategorizeChannelList(store.channels);
  const categories = getCategories(updated);
  const featured = getFeaturedChannels(updated, 12);

  saveChannels(updated);
  saveCategories(categories);
  saveFeatured(featured);

  log.info('Cache', `🔁 Recategorized ${updated.length} channels → ${categories.length} categories`);

  return {
    ok: true,
    channelCount: updated.length,
    categoryCount: categories.length,
    featuredCount: featured.length,
    lastUpdate: store.lastUpdate,
  };
}

/**
 * Update stats
 */
function updateStats(stats) {
  Object.assign(store.stats, stats);
  writeJson(path.join(LOGS_DIR, 'stats.json'), store.stats);
}

/**
 * Log scan result
 */
function logScan(result) {
  const logFile = path.join(LOGS_DIR, 'scans.json');
  let scans = readJson(logFile) || [];
  scans.unshift({
    timestamp: new Date().toISOString(),
    ...result,
  });
  // Keep last 50 scans
  scans = scans.slice(0, 50);
  writeJson(logFile, scans);
}

// ── File I/O helpers ──

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    log.error('Cache', `Failed to write ${filePath}: ${err.message}`);
  }
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    log.error('Cache', `Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

module.exports = {
  saveChannels,
  saveCategories,
  saveFeatured,
  saveEPG,
  loadCache,
  getStore,
  updateStats,
  logScan,
  recategorizeFromCache,
};
