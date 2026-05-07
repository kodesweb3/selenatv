/**
 * AegisTV M3U Parser — Parses M3U/M3U8 playlists into channel objects
 */

const log = require('../utils/logger');

/**
 * Parse an M3U playlist string into an array of channel objects
 */
function parseM3U(content, sourceUrl = '') {
  const channels = [];
  if (!content || typeof content !== 'string') return channels;

  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let currentInfo = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      currentInfo = parseExtInf(line);
      continue;
    }

    // Skip comments and directives
    if (line.startsWith('#')) continue;

    // This should be a URL
    if (currentInfo && (line.startsWith('http://') || line.startsWith('https://'))) {
      const channel = {
        name: currentInfo.name || 'Unknown',
        streamUrl: line,
        tvgId: currentInfo.tvgId || '',
        tvgName: currentInfo.tvgName || '',
        tvgLogo: currentInfo.tvgLogo || '',
        groupTitle: currentInfo.groupTitle || '',
        tvgCountry: currentInfo.tvgCountry || '',
        tvgLanguage: currentInfo.tvgLanguage || '',
        source: sourceUrl,
      };

      channels.push(channel);
      currentInfo = null;
    }
  }

  log.debug('Parser', `Parsed ${channels.length} channels from playlist`, { source: sourceUrl });
  return channels;
}

/**
 * Parse an #EXTINF line into metadata
 */
function parseExtInf(line) {
  const info = {
    name: '',
    tvgId: '',
    tvgName: '',
    tvgLogo: '',
    groupTitle: '',
    tvgCountry: '',
    tvgLanguage: '',
  };

  // Extract attributes
  const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
  if (tvgIdMatch) info.tvgId = tvgIdMatch[1];

  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
  if (tvgNameMatch) info.tvgName = tvgNameMatch[1];

  const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
  if (tvgLogoMatch) info.tvgLogo = tvgLogoMatch[1];

  const groupMatch = line.match(/group-title="([^"]*)"/i);
  if (groupMatch) info.groupTitle = groupMatch[1];

  const countryMatch = line.match(/tvg-country="([^"]*)"/i);
  if (countryMatch) info.tvgCountry = countryMatch[1];

  const langMatch = line.match(/tvg-language="([^"]*)"/i);
  if (langMatch) info.tvgLanguage = langMatch[1];

  // Extract channel name (after the last comma)
  const nameMatch = line.match(/,\s*(.+)$/);
  if (nameMatch) info.name = nameMatch[1].trim();

  return info;
}

/**
 * Filter channels that are likely Romanian
 */
function filterRomanianChannels(channels) {
  const roKeywords = [
    'romania', 'roman', 'tvr', 'antena', 'protv', 'pro tv', 'kanal d',
    'digi', 'realitatea', 'b1 tv', 'national tv', 'prima tv', 'favorit',
    'trinitas', 'happy', 'acasa', 'kiss tv', 'zu tv', 'look', 'etno',
    'minimax', 'megamax', 'film now', 'pro cinema', 'pro arena', 'sport.ro',
    'telekom', 'orange sport', 'gsp', 'look sport', 'digi sport',
    'travel mix', 'u tv', 'gold fm', 'magic', 'napo', 'music channel',
    'profm', 'rock fm', 'radio21', 'pro 2', 'antena stars',
  ];

  return channels.filter(ch => {
    const name = (ch.name || '').toLowerCase();
    const tvgName = (ch.tvgName || '').toLowerCase();
    const group = (ch.groupTitle || '').toLowerCase();
    const country = (ch.tvgCountry || '').toLowerCase();
    const lang = (ch.tvgLanguage || '').toLowerCase();

    // Direct country/language match
    if (country === 'ro' || country === 'romania') return true;
    if (lang === 'romanian' || lang === 'ro') return true;

    // Group match
    if (group.includes('romania') || group.includes('român')) return true;

    // Keyword match
    for (const kw of roKeywords) {
      if (name.includes(kw) || tvgName.includes(kw)) return true;
    }

    return false;
  });
}

module.exports = {
  parseM3U,
  parseExtInf,
  filterRomanianChannels,
};
