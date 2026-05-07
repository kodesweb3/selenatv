/**
 * AegisTV EPG Processor — Electronic Program Guide parser and manager
 */

const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const log = require('../utils/logger');
const { retry } = require('../utils/helpers');

/**
 * EPG Sources for Romanian channels
 */
const EPG_SOURCES = [
  'https://iptv-org.github.io/epg/guides/ro/programetv.ro.epg.xml',
  'https://raw.githubusercontent.com/iptv-org/epg/master/sites/programetv.ro/programetv.ro.guide.xml',
];

/**
 * Fetch and parse EPG data
 */
async function fetchEPG() {
  log.info('EPG', '📡 Fetching EPG data...');

  for (const source of EPG_SOURCES) {
    try {
      const data = await fetchEPGSource(source);
      if (data && Object.keys(data).length > 0) {
        log.info('EPG', `✅ Loaded EPG with ${Object.keys(data).length} channels from ${shortenUrl(source)}`);
        return data;
      }
    } catch (err) {
      log.warn('EPG', `⚠️ EPG source failed: ${shortenUrl(source)} — ${err.message}`);
    }
  }

  log.warn('EPG', 'No EPG sources available, using empty EPG');
  return {};
}

/**
 * Fetch and parse a single EPG XML source
 */
async function fetchEPGSource(url) {
  const response = await retry(async () => {
    return axios.get(url, {
      timeout: 30000,
      headers: { 'User-Agent': 'AegisTV/1.0' },
      maxContentLength: 50 * 1024 * 1024, // 50MB max for EPG
      responseType: 'text',
    });
  }, 2, 3000);

  return parseEPGXml(response.data);
}

/**
 * Parse XMLTV format EPG data
 */
async function parseEPGXml(xmlData) {
  const epg = {};

  try {
    const result = await parseStringPromise(xmlData, {
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
    });

    if (!result.tv || !result.tv.programme) return epg;

    const programmes = Array.isArray(result.tv.programme)
      ? result.tv.programme
      : [result.tv.programme];

    for (const prog of programmes) {
      const channelId = prog.channel || '';
      if (!channelId) continue;

      if (!epg[channelId]) epg[channelId] = [];

      const title = extractText(prog.title);
      const desc = extractText(prog.desc);
      const start = parseXmltvDate(prog.start);
      const stop = parseXmltvDate(prog.stop);
      const category = extractText(prog.category);

      if (title && start) {
        epg[channelId].push({
          title,
          description: desc || '',
          start: start.toISOString(),
          stop: stop ? stop.toISOString() : '',
          category: category || '',
          startTimestamp: start.getTime(),
          stopTimestamp: stop ? stop.getTime() : 0,
        });
      }
    }

    // Sort each channel's programs by start time
    for (const chId of Object.keys(epg)) {
      epg[chId].sort((a, b) => a.startTimestamp - b.startTimestamp);
    }
  } catch (err) {
    log.error('EPG', `XML parse error: ${err.message}`);
  }

  return epg;
}

/**
 * Extract text from XMLTV text nodes
 */
function extractText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object') {
    if (node._) return node._;
    if (Array.isArray(node)) return extractText(node[0]);
  }
  return '';
}

/**
 * Parse XMLTV date format: "20240101120000 +0200"
 */
function parseXmltvDate(str) {
  if (!str) return null;
  try {
    const clean = str.replace(/\s+/g, '');
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    const hour = parseInt(clean.slice(8, 10));
    const min = parseInt(clean.slice(10, 12));
    const sec = parseInt(clean.slice(12, 14)) || 0;

    const date = new Date(Date.UTC(year, month, day, hour, min, sec));

    // Handle timezone offset if present
    const tzMatch = clean.match(/([+-]\d{4})$/);
    if (tzMatch) {
      const tzStr = tzMatch[1];
      const tzHours = parseInt(tzStr.slice(0, 3));
      const tzMins = parseInt(tzStr[0] + tzStr.slice(3));
      date.setUTCMinutes(date.getUTCMinutes() - (tzHours * 60 + tzMins));
    }

    return date;
  } catch {
    return null;
  }
}

/**
 * Get current and next program for a channel
 */
function getCurrentProgram(epgData, epgId) {
  const programs = epgData[epgId];
  if (!programs || programs.length === 0) return { now: null, next: null };

  const now = Date.now();

  let currentProg = null;
  let nextProg = null;

  for (let i = 0; i < programs.length; i++) {
    const prog = programs[i];
    if (prog.startTimestamp <= now && prog.stopTimestamp > now) {
      currentProg = prog;
      if (i + 1 < programs.length) {
        nextProg = programs[i + 1];
      }
      break;
    }
    if (prog.startTimestamp > now && !nextProg) {
      nextProg = prog;
    }
  }

  return { now: currentProg, next: nextProg };
}

/**
 * Get schedule for a channel (next N hours)
 */
function getChannelSchedule(epgData, epgId, hours = 24) {
  const programs = epgData[epgId];
  if (!programs) return [];

  const now = Date.now();
  const cutoff = now + (hours * 60 * 60 * 1000);

  return programs.filter(p => p.stopTimestamp > now && p.startTimestamp < cutoff);
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    return parts[parts.length - 1];
  } catch { return url.slice(0, 50); }
}

module.exports = {
  fetchEPG,
  getCurrentProgram,
  getChannelSchedule,
};
