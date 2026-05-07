/**
 * AegisTV Channel Ranking System — Ranks and deduplicates channels
 */

const log = require('../utils/logger');
const { generateChannelId, categorizeChannel, KNOWN_CHANNELS } = require('../utils/helpers');

/**
 * Process raw validated channels into ranked, deduplicated channel list
 */
function rankChannels(validatedChannels) {
  log.info('Ranking', `📊 Ranking ${validatedChannels.length} validated channels...`);

  // Group by channel identity (deduplicate)
  const channelGroups = new Map();

  for (const ch of validatedChannels) {
    const id = resolveChannelId(ch);
    if (!channelGroups.has(id)) {
      channelGroups.set(id, []);
    }
    channelGroups.get(id).push(ch);
  }

  log.info('Ranking', `Found ${channelGroups.size} unique channels from ${validatedChannels.length} streams`);

  // For each group, pick the best stream
  const ranked = [];
  for (const [id, streams] of channelGroups) {
    // Sort by score descending
    streams.sort((a, b) => (b.score || 0) - (a.score || 0));

    const best = streams[0];
    const knownMeta = findKnownChannel(best.name);

    const channel = {
      id,
      name: knownMeta?.name || cleanChannelName(best.name),
      category: categorizeChannel(best.name),
      logo: knownMeta?.logo ? `/api/logo/${knownMeta.logo}` : (best.tvgLogo || ''),
      stream: best.streamUrl,
      quality: best.quality || 'SD',
      epgId: knownMeta?.epgId || best.tvgId || '',
      country: 'RO',
      score: best.score || 0,
      alternateStreams: streams.slice(1).map(s => ({
        url: s.streamUrl,
        score: s.score || 0,
        quality: s.quality || 'SD',
      })),
      validation: best.validation,
      updatedAt: new Date().toISOString(),
    };

    ranked.push(channel);
  }

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  log.info('Ranking', `✅ Ranked ${ranked.length} channels`);
  return ranked;
}

/**
 * Resolve a channel ID from various metadata
 */
function resolveChannelId(channel) {
  const name = (channel.tvgName || channel.name || '').toLowerCase().trim();

  // Try matching against known channels
  for (const [id, meta] of Object.entries(KNOWN_CHANNELS)) {
    const knownName = meta.name.toLowerCase();
    if (name === knownName || name.includes(knownName) || knownName.includes(name)) {
      return id;
    }
  }

  return generateChannelId(channel.name || 'unknown');
}

/**
 * Find known channel metadata by name
 */
function findKnownChannel(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();

  for (const meta of Object.values(KNOWN_CHANNELS)) {
    const kn = meta.name.toLowerCase();
    if (n === kn || n.includes(kn) || kn.includes(n)) {
      return meta;
    }
  }
  return null;
}

/**
 * Clean up channel name
 */
function cleanChannelName(name) {
  if (!name) return 'Unknown';
  return name
    .replace(/\s*(HD|FHD|SD|4K|UHD|\(.*?\)|\[.*?\])\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown';
}

/** Display order for categories (editorial, not purely by count) */
const CATEGORY_ORDER = [
  'Știri',
  'Info',
  'Sport',
  'Filme',
  'Documentare',
  'Istorie',
  'Știință și natură',
  'Muzică',
  'Copii',
  'Lifestyle',
  'Regional',
  'General',
];

function categorySortKey(name) {
  const i = CATEGORY_ORDER.indexOf(name);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/**
 * Get categories with channel counts
 */
function getCategories(channels) {
  const cats = {};
  for (const ch of channels) {
    let cat = ch.category || 'General';
    // Migrare cache vechi „Documentar” → „Documentare”
    if (cat === 'Documentar') cat = 'Documentare';
    if (!cats[cat]) cats[cat] = { name: cat, count: 0, icon: getCategoryIcon(cat) };
    cats[cat].count++;
  }
  return Object.values(cats).sort((a, b) => {
    const byOrder = categorySortKey(a.name) - categorySortKey(b.name);
    if (byOrder !== 0) return byOrder;
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'ro');
  });
}

/**
 * Get category icon
 */
function getCategoryIcon(category) {
  const icons = {
    'Știri': '📰',
    'Info': 'ℹ️',
    'General': '📺',
    'Sport': '⚽',
    'Muzică': '🎵',
    'Copii': '🧸',
    'Filme': '🎬',
    'Documentar': '🌍',
    'Documentare': '🎞️',
    'Istorie': '🏛️',
    'Știință și natură': '🔬',
    'Regional': '🏘️',
    'Lifestyle': '✨',
  };
  return icons[category] || '📺';
}

/**
 * Get featured channels (top scored from each category)
 */
function getFeaturedChannels(channels, count = 10) {
  const byCategory = {};
  for (const ch of channels) {
    if (!byCategory[ch.category]) byCategory[ch.category] = [];
    byCategory[ch.category].push(ch);
  }

  const featured = [];
  const categories = Object.keys(byCategory);

  // Round-robin from each category, picking top scored
  let idx = 0;
  while (featured.length < count && idx < 100) {
    for (const cat of categories) {
      const catChannels = byCategory[cat];
      const pick = catChannels[Math.floor(idx / categories.length)];
      if (pick && !featured.find(f => f.id === pick.id)) {
        featured.push(pick);
        if (featured.length >= count) break;
      }
    }
    idx++;
  }

  return featured;
}

/**
 * Re-applies categorizeChannel() from helpers using each channel's display name,
 * without re-scanning streams. Updates category + updatedAt only.
 */
function recategorizeChannelList(channels) {
  return channels.map(ch => ({
    ...ch,
    category: categorizeChannel(ch.name || ''),
    updatedAt: new Date().toISOString(),
  }));
}

module.exports = {
  rankChannels,
  getCategories,
  getFeaturedChannels,
  recategorizeChannelList,
};
