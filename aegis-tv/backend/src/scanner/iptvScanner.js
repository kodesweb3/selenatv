/**
 * SelenaTV IPTV Scanner — Discovers Romanian TV streams from free IPTV sources
 */

const axios = require('axios');
const log = require('../utils/logger');
const { parseM3U, filterRomanianChannels } = require('../parser/m3uParser');
const { retry, sleep } = require('../utils/helpers');

/**
 * Massive list of free IPTV playlist sources
 * Public GitHub repos and community-maintained playlists
 */
const PLAYLIST_SOURCES = [
  // iptv-org — the largest community IPTV list
  'https://iptv-org.github.io/iptv/countries/ro.m3u',
  'https://iptv-org.github.io/iptv/languages/ron.m3u',
  'https://iptv-org.github.io/iptv/subdivisions/ro-b.m3u',

  // Free-TV project
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_romania.m3u8',

  // Additional community sources
  'https://raw.githubusercontent.com/bogdanovvladislav/IPTV/main/IPTV_Romania.m3u',
  'https://raw.githubusercontent.com/pbandjelly/iptv-m3u-maker/master/iptv_romania.m3u',
  'https://raw.githubusercontent.com/firoz2456/IPTV/main/romania.m3u',
  'https://raw.githubusercontent.com/ipstreet312/freeiptv/master/all.m3u',

  // International lists that include Romanian channels
  'https://iptv-org.github.io/iptv/index.m3u',
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
];

/**
 * Extra M3U URLs from env: comma/semicolon/newline-separated.
 * Exemplu în Railway: EXTRA_M3U_URLS=https://example.com/my-list.m3u
 */
function playlistSourcesFromEnv() {
  const raw = process.env.EXTRA_M3U_URLS || '';
  return raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter((u) => u.startsWith('http://') || u.startsWith('https://'));
}

/**
 * Scan all known sources and return aggregated Romanian channels
 */
async function scanAllSources() {
  const extra = playlistSourcesFromEnv();
  if (extra.length > 0) {
    log.info('Scanner', `➕ EXTRA_M3U_URLS: ${extra.length} URL(uri) adiționale din mediu`);
  }
  const sources = [...PLAYLIST_SOURCES, ...extra];
  log.info('Scanner', '🔍 Starting IPTV source scan...');
  const allChannels = [];
  const errors = [];

  for (const source of sources) {
    try {
      const channels = await scanSource(source);
      allChannels.push(...channels);
      log.info('Scanner', `✅ ${channels.length} channels from ${shortenUrl(source)}`);
    } catch (err) {
      errors.push({ source, error: err.message });
      log.warn('Scanner', `⚠️ Failed: ${shortenUrl(source)} — ${err.message}`);
    }
    // Rate limit between sources
    await sleep(300);
  }

  log.info('Scanner', `📊 Scan complete: ${allChannels.length} total channels, ${errors.length} failed sources`);
  return { channels: allChannels, errors };
}

/**
 * Scan a single M3U source URL
 */
async function scanSource(url) {
  const response = await retry(async () => {
    return axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'SelenaTV/1.0',
        'Accept': '*/*',
      },
      maxContentLength: 50 * 1024 * 1024, // 50MB for large lists
    });
  }, 2, 2000);

  const allChannels = parseM3U(response.data, url);

  // For large international lists, filter Romanian only
  if (url.includes('index.m3u') || url.includes('playlist.m3u8') || url.includes('all.m3u')) {
    return filterRomanianChannels(allChannels);
  }

  // For Romanian-specific sources, return all but still filter
  return filterRomanianChannels(allChannels);
}

/**
 * Shorten URL for logging
 */
function shortenUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    return `${u.hostname}/.../${parts[parts.length - 1]}`;
  } catch {
    return url.slice(0, 60);
  }
}

module.exports = {
  scanAllSources,
  scanSource,
  PLAYLIST_SOURCES,
  playlistSourcesFromEnv,
};
