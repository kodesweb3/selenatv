/**
 * AegisTV Channel Ranking System — Ranks and deduplicates channels
 */

const log = require('../utils/logger');
const {
  generateChannelId,
  categorizeChannel,
  KNOWN_CHANNELS,
  normalizeChannelNameForMatch,
} = require('../utils/helpers');

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
      category: categorizeChannel(knownMeta?.name || best.name),
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
 * Match M3U name to KNOWN_CHANNELS using normalized titles (PROTV / Pro TV / HD / 4K).
 */
function findKnownChannelEntry(rawName) {
  if (!rawName) return null;
  const norm = normalizeChannelNameForMatch(rawName);
  if (!norm) return null;

  const candidates = Object.entries(KNOWN_CHANNELS)
    .map(([id, meta]) => ({
      id,
      meta,
      kn: normalizeChannelNameForMatch(meta.name),
    }))
    .filter((x) => x.kn.length >= 3)
    .sort((a, b) => b.kn.length - a.kn.length);

  for (const { id, meta, kn } of candidates) {
    if (norm === kn) return { id, meta };
    if (norm.startsWith(kn) || kn.startsWith(norm)) return { id, meta };
  }
  return null;
}

/**
 * Resolve a channel ID from various metadata
 */
function resolveChannelId(channel) {
  const label = channel.tvgName || channel.name || '';
  const hit = findKnownChannelEntry(label);
  if (hit) return hit.id;
  return generateChannelId(channel.name || 'unknown');
}

/**
 * Find known channel metadata by name
 */
function findKnownChannel(name) {
  const hit = findKnownChannelEntry(name);
  return hit ? hit.meta : null;
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
  '4K',
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
    '4K': 'UHD',
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
