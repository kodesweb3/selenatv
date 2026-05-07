/**
 * AegisTV Scheduler — Automated scan, validate, rank, and cache refresh
 */

const cron = require('node-cron');
const log = require('../utils/logger');
const { scanAllSources } = require('../scanner/iptvScanner');
const { validateBatch } = require('../validator/streamValidator');
const { rankChannels, getCategories, getFeaturedChannels } = require('../ranking/channelRanker');
const { fetchEPG } = require('../epg/epgProcessor');
const cache = require('../cache/cacheManager');

let isRunning = false;

/**
 * Full pipeline: scan → validate → rank → cache
 */
async function runFullPipeline() {
  if (isRunning) {
    log.warn('Scheduler', '⏳ Pipeline already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  log.info('Scheduler', '🚀 ═══════════════════════════════════════');
  log.info('Scheduler', '🚀 AEGIS TV — Full Pipeline Starting');
  log.info('Scheduler', '🚀 ═══════════════════════════════════════');

  try {
    // Step 1: Scan sources
    log.info('Scheduler', '📡 STEP 1/4 — Scanning IPTV sources...');
    const { channels: rawChannels, errors } = await scanAllSources();

    if (rawChannels.length === 0) {
      log.warn('Scheduler', '⚠️ No channels found from any source');
      // Fall back to existing cache
      isRunning = false;
      return;
    }

    // Step 2: Validate streams
    log.info('Scheduler', '🔎 STEP 2/4 — Validating streams...');
    const validChannels = await validateBatch(rawChannels);

    // Step 3: Rank and deduplicate
    log.info('Scheduler', '📊 STEP 3/4 — Ranking channels...');
    const rankedChannels = rankChannels(validChannels);
    const categories = getCategories(rankedChannels);
    const featured = getFeaturedChannels(rankedChannels, 12);

    // Step 4: Cache everything
    log.info('Scheduler', '💾 STEP 4/4 — Caching results...');
    cache.saveChannels(rankedChannels);
    cache.saveCategories(categories);
    cache.saveFeatured(featured);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    cache.updateStats({
      totalScans: (cache.getStore().stats.totalScans || 0) + 1,
      aliveChannels: rankedChannels.length,
      deadRemoved: rawChannels.length - validChannels.length,
      lastScanDuration: elapsed,
      lastScanAt: new Date().toISOString(),
    });

    cache.logScan({
      scanned: rawChannels.length,
      alive: validChannels.length,
      ranked: rankedChannels.length,
      categories: categories.length,
      errors: errors.length,
      duration: elapsed,
    });

    log.info('Scheduler', '🚀 ═══════════════════════════════════════');
    log.info('Scheduler', `✅ Pipeline complete in ${elapsed}s`);
    log.info('Scheduler', `   📺 ${rankedChannels.length} channels`);
    log.info('Scheduler', `   📁 ${categories.length} categories`);
    log.info('Scheduler', `   ⭐ ${featured.length} featured`);
    log.info('Scheduler', '🚀 ═══════════════════════════════════════');
  } catch (err) {
    log.error('Scheduler', `❌ Pipeline failed: ${err.message}`);
    log.error('Scheduler', err.stack);
  } finally {
    isRunning = false;
  }
}

/**
 * EPG refresh pipeline
 */
async function refreshEPG() {
  log.info('Scheduler', '📡 Refreshing EPG...');
  try {
    const epg = await fetchEPG();
    cache.saveEPG(epg);
    log.info('Scheduler', `✅ EPG refreshed: ${Object.keys(epg).length} channels`);
  } catch (err) {
    log.error('Scheduler', `❌ EPG refresh failed: ${err.message}`);
  }
}

/**
 * Start automated scheduling
 */
function startScheduler() {
  const refreshInterval = parseInt(process.env.CACHE_REFRESH_INTERVAL || '30', 10);
  const epgInterval = parseInt(process.env.EPG_REFRESH_INTERVAL || '6', 10);

  // Channel refresh — every N minutes
  cron.schedule(`*/${refreshInterval} * * * *`, () => {
    log.info('Scheduler', '⏰ Scheduled channel refresh triggered');
    runFullPipeline();
  });

  // EPG refresh — every N hours
  cron.schedule(`0 */${epgInterval} * * *`, () => {
    log.info('Scheduler', '⏰ Scheduled EPG refresh triggered');
    refreshEPG();
  });

  log.info('Scheduler', `📅 Scheduler started:`);
  log.info('Scheduler', `   Channels: every ${refreshInterval} min`);
  log.info('Scheduler', `   EPG: every ${epgInterval} hours`);
}

module.exports = {
  runFullPipeline,
  refreshEPG,
  startScheduler,
};
