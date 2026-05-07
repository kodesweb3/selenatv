/**
 * SelenaTV Helpers — Common utility functions
 */

const crypto = require('crypto');

/**
 * Generate a deterministic channel ID from name
 */
function generateChannelId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a short hash for deduplication
 */
function hashUrl(url) {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

/**
 * Sleep for ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(baseDelay * Math.pow(2, i));
    }
  }
}

/**
 * Sanitize string for display
 */
function sanitize(str) {
  if (!str) return '';
  return str.replace(/[<>\"'&]/g, '').trim();
}

/**
 * Normalize channel title for matching (PRO TV / PROTV / HD / 4K / paranteze).
 */
function normalizeChannelNameForMatch(raw) {
  if (!raw) return '';
  let s = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/\s*[–—|:]+\s*/g, ' ');
  s = s.replace(/\b(fsd|fhd|qhd|uhd|sd|hd|4k|8k|2160p?|1080p?|720p?|ultra\s*hd|full\s*hd)\b/gi, ' ');
  s = s.replace(/\bpro\s*tv\b/gi, 'protv');
  s = s.replace(/\bprima\s*tv\b/gi, 'primatv');
  s = s.replace(/\bdigi\s*24\b/gi, 'digi24');
  s = s.replace(/\bdigi\s*sport\b/gi, 'digisport');
  s = s.replace(/\btelekom\s*sport\b/gi, 'telekomsport');
  s = s.replace(/\bantena\s*(\d+|stars?)\b/gi, (_, a) => 'antena' + String(a).replace(/\s+/g, ''));
  s = s.replace(/\bkanal\s*d\b/gi, 'kanald');
  s = s.replace(/\beurosport\b/gi, 'eurosport');
  s = s.replace(/\blook\s*(\+|plus|sport)?\b/gi, (m) => m.replace(/\s+/g, ''));
  s = s.replace(/\btvr\s*(international|i)\b/gi, 'tvri');
  s = s.replace(/\btvr\s*(\d+)\b/gi, (_, d) => 'tvr' + d);
  s = s.replace(/\bromania\s*tv\b/gi, 'romaniatv');
  s = s.replace(/\brealitatea\b/gi, 'realitatea');
  s = s.replace(/[^a-z0-9]+/g, '');
  return s;
}

/**
 * Categorize a Romanian channel by name — ROMANIAN CATEGORIES
 * Order matters: first matching rule wins.
 */
function categorizeChannel(name) {
  const n = name.toLowerCase();
  if (/sport|digi sport|gsp|eurosport|look sport|telekom sport|prima sport|tvr sport|orange sport|sport\.ro|liga|champions|fotbal/i.test(n)) return 'Sport';
  if (/cartoon|minimax|disney|nick|boomerang|jimjam|duck|kids|copii|baby|junior|megamax/i.test(n)) return 'Copii';
  if (/music|kiss|mtv|zu tv|magic|etno|hit music|music channel|radio|profm|rock fm|gold fm/i.test(n)) return 'Muzică';
  if (/hbo|film|cinema|cinemax|paramount|amc|ax[nx]|pro cinema|film now|tv1000|movie|thriller/i.test(n)) return 'Filme';
  // Info & business (înainte de Știri — „Info” nu mai este tratat generic ca știre)
  if (/tvr\s*info|\bbusiness\b|bloomberg|cnbc|economic|financiar|\bmoney\b|\bcapital\b|zonea?\s*business|markets|investing/i.test(n)) return 'Info';
  if (/news|știri|stiri|digi\s*24|digi24|realitatea|b1 tv|romania tv|antena 3|euronews|24\/7|\bcnn\b|jurnal/i.test(n)) return 'Știri';
  // Istorie & militar (înainte de documentare generale)
  if (/\bhistory\b|viasat\s*history|istorie|istoric|război|razboi|ww2|wwii|medieval|antică|antica|battlefield|document.*istor/i.test(n)) return 'Istorie';
  // Știință, spațiu, natură sălbatică
  if (/nat\s*geo|national geographic|natgeo|nat geo wild|\bwild\b|animal planet|digi animal|discovery science|\bscience\b|spațiu|spatiu|cosmos|blue planet|planet earth/i.test(n)) return 'Știință și natură';
  // Documentare & călătorii (fără history deja prins mai sus)
  if (/travel|mix travel|discovery(?! science)|viasat explore|viasat nature|\bdocu|documentar|explore|digi life|digi world|investiga|crime\s+investigation|\bid\b|earth|\bnature\b(?!\s+wild)/i.test(n)) return 'Documentare';
  if (/local|regional|telem|est tv|nord|litoral|ardeal|banat|moldova|oltenia|maramures|sibiu|timis|arad|cluj|iasi|brasov|craiova|oradea|tvr cluj|tvr iasi|tvr timis|tvr moldova|tvr craiova|tvr tg/i.test(n)) return 'Regional';
  if (/food|cooking|bucătărie|culinare|paprika|lifestyle|home\s*&|fashion|diva|\btlc\b|e!|entertainment/i.test(n)) return 'Lifestyle';
  if (/\b4k\b|\buhd\b|2160|ultra\s*hd|\(uhd\)/i.test(n)) return '4K';
  return 'General';
}

/**
 * Known Romanian channel metadata — comprehensive database
 */
const KNOWN_CHANNELS = {
  // ═══ Generaliste ═══
  'protv': { name: 'Pro TV', epgId: 'ProTV.ro', logo: 'protv' },
  'pro-2': { name: 'Pro 2', epgId: 'Pro2.ro', logo: 'pro2' },
  'pro-cinema': { name: 'Pro Cinema', epgId: 'ProCinema.ro', logo: 'procinema' },
  'pro-arena': { name: 'Pro Arena', epgId: 'ProArena.ro', logo: 'proarena' },
  'antena-1': { name: 'Antena 1', epgId: 'Antena1.ro', logo: 'antena1' },
  'antena-3-cnn': { name: 'Antena 3 CNN', epgId: 'Antena3.ro', logo: 'antena3' },
  'antena-stars': { name: 'Antena Stars', epgId: 'AntenaStars.ro', logo: 'antenastars' },
  'antena-monden': { name: 'Antena Monden', epgId: 'AntenaMonden.ro', logo: 'antenamonden' },
  'kanal-d': { name: 'Kanal D', epgId: 'KanalD.ro', logo: 'kanald' },
  'kanal-d2': { name: 'Kanal D2', epgId: 'KanalD2.ro', logo: 'kanald2' },
  'prima-tv': { name: 'Prima TV', epgId: 'PrimaTV.ro', logo: 'primatv' },
  'national-tv': { name: 'National TV', epgId: 'NationalTV.ro', logo: 'nationaltv' },
  'happy-channel': { name: 'Happy Channel', epgId: 'Happy.ro', logo: 'happy' },
  'acasa': { name: 'Acasa', epgId: 'Acasa.ro', logo: 'acasa' },
  'favorit-tv': { name: 'Favorit TV', epgId: 'FavoritTV.ro', logo: 'favorit' },

  // ═══ TVR ═══
  'tvr-1': { name: 'TVR 1', epgId: 'TVR1.ro', logo: 'tvr1' },
  'tvr-2': { name: 'TVR 2', epgId: 'TVR2.ro', logo: 'tvr2' },
  'tvr-3': { name: 'TVR 3', epgId: 'TVR3.ro', logo: 'tvr3' },
  'tvr-info': { name: 'TVR Info', epgId: 'TVRInfo.ro', logo: 'tvrinfo' },
  'tvr-sport': { name: 'TVR Sport', epgId: 'TVRSport.ro', logo: 'tvrsport' },
  'tvr-international': { name: 'TVR International', epgId: 'TVRi.ro', logo: 'tvri' },
  'tvr-cluj': { name: 'TVR Cluj', epgId: 'TVRCluj.ro', logo: 'tvrcluj' },
  'tvr-iasi': { name: 'TVR Iași', epgId: 'TVRIasi.ro', logo: 'tvriasi' },
  'tvr-timisoara': { name: 'TVR Timișoara', epgId: 'TVRTimisoara.ro', logo: 'tvrtimisoara' },
  'tvr-craiova': { name: 'TVR Craiova', epgId: 'TVRCraiova.ro', logo: 'tvrcraiova' },
  'tvr-targu-mures': { name: 'TVR Târgu Mureș', epgId: 'TVRTgMures.ro', logo: 'tvrtgmures' },
  'tvr-moldova': { name: 'TVR Moldova', epgId: 'TVRMoldova.ro', logo: 'tvrmoldova' },

  // ═══ Știri ═══
  'digi-24': { name: 'Digi 24', epgId: 'Digi24.ro', logo: 'digi24' },
  'realitatea-plus': { name: 'Realitatea Plus', epgId: 'RealitateaPlus.ro', logo: 'realitatea' },
  'romania-tv': { name: 'Romania TV', epgId: 'RomaniaTV.ro', logo: 'romaniatv' },
  'b1-tv': { name: 'B1 TV', epgId: 'B1TV.ro', logo: 'b1tv' },
  'euronews-ro': { name: 'Euronews România', epgId: 'EuronewsRO.ro', logo: 'euronews' },

  // ═══ Sport ═══
  'digi-sport-1': { name: 'Digi Sport 1', epgId: 'DigiSport1.ro', logo: 'digisport1' },
  'digi-sport-2': { name: 'Digi Sport 2', epgId: 'DigiSport2.ro', logo: 'digisport2' },
  'digi-sport-3': { name: 'Digi Sport 3', epgId: 'DigiSport3.ro', logo: 'digisport3' },
  'digi-sport-4': { name: 'Digi Sport 4', epgId: 'DigiSport4.ro', logo: 'digisport4' },
  'look-sport-1': { name: 'Look Sport 1', epgId: 'LookSport1.ro', logo: 'looksport1' },
  'look-sport-2': { name: 'Look Sport 2', epgId: 'LookSport2.ro', logo: 'looksport2' },
  'look-sport-3': { name: 'Look Sport 3', epgId: 'LookSport3.ro', logo: 'looksport3' },
  'prima-sport-1': { name: 'Prima Sport 1', epgId: 'PrimaSport1.ro', logo: 'primasport1' },
  'prima-sport-2': { name: 'Prima Sport 2', epgId: 'PrimaSport2.ro', logo: 'primasport2' },
  'prima-sport-3': { name: 'Prima Sport 3', epgId: 'PrimaSport3.ro', logo: 'primasport3' },
  'prima-sport-4': { name: 'Prima Sport 4', epgId: 'PrimaSport4.ro', logo: 'primasport4' },
  'eurosport-1': { name: 'Eurosport 1', epgId: 'Eurosport1.ro', logo: 'eurosport1' },
  'eurosport-2': { name: 'Eurosport 2', epgId: 'Eurosport2.ro', logo: 'eurosport2' },
  'sport-ro': { name: 'Sport.ro', epgId: 'SportRo.ro', logo: 'sportro' },

  // ═══ Muzică ═══
  'kiss-tv': { name: 'Kiss TV', epgId: 'KissTV.ro', logo: 'kisstv' },
  'zu-tv': { name: 'Zu TV', epgId: 'ZuTV.ro', logo: 'zutv' },
  'magic-tv': { name: 'Magic TV', epgId: 'MagicTV.ro', logo: 'magictv' },
  'etno-tv': { name: 'Etno TV', epgId: 'EtnoTV.ro', logo: 'etnotv' },
  'hit-music': { name: 'Hit Music TV', epgId: 'HitMusic.ro', logo: 'hitmusic' },
  'music-channel': { name: 'Music Channel', epgId: 'MusicChannel.ro', logo: 'musicchannel' },
  'u-tv': { name: 'U TV', epgId: 'UTV.ro', logo: 'utv' },

  // ═══ Filme ═══
  'film-now': { name: 'Film Now', epgId: 'FilmNow.ro', logo: 'filmnow' },
  'hbo-ro': { name: 'HBO România', epgId: 'HBO.ro', logo: 'hbo' },
  'hbo-2-ro': { name: 'HBO 2', epgId: 'HBO2.ro', logo: 'hbo2' },
  'hbo-3-ro': { name: 'HBO 3', epgId: 'HBO3.ro', logo: 'hbo3' },
  'cinemax-1-ro': { name: 'Cinemax 1', epgId: 'Cinemax1.ro', logo: 'cinemax1' },
  'cinemax-2-ro': { name: 'Cinemax 2', epgId: 'Cinemax2.ro', logo: 'cinemax2' },
  'paramount-ro': { name: 'Paramount Channel', epgId: 'Paramount.ro', logo: 'paramount' },
  'amc-ro': { name: 'AMC', epgId: 'AMC.ro', logo: 'amc' },
  'axn-ro': { name: 'AXN', epgId: 'AXN.ro', logo: 'axn' },
  'axn-white': { name: 'AXN White', epgId: 'AXNWhite.ro', logo: 'axnwhite' },
  'axn-black': { name: 'AXN Black', epgId: 'AXNBlack.ro', logo: 'axnblack' },
  'tv1000': { name: 'TV 1000', epgId: 'TV1000.ro', logo: 'tv1000' },

  // ═══ Documentar ═══
  'digi-life': { name: 'Digi Life', epgId: 'DigiLife.ro', logo: 'digilife' },
  'digi-world': { name: 'Digi World', epgId: 'DigiWorld.ro', logo: 'digiworld' },
  'digi-animal-world': { name: 'Digi Animal World', epgId: 'DigiAnimal.ro', logo: 'digianimal' },
  'discovery-ro': { name: 'Discovery Channel', epgId: 'Discovery.ro', logo: 'discovery' },
  'nat-geo-ro': { name: 'National Geographic', epgId: 'NatGeo.ro', logo: 'natgeo' },
  'nat-geo-wild': { name: 'Nat Geo Wild', epgId: 'NatGeoWild.ro', logo: 'natgeowild' },
  'history-ro': { name: 'History', epgId: 'History.ro', logo: 'history' },
  'travel-mix': { name: 'Travel Mix', epgId: 'TravelMix.ro', logo: 'travelmix' },
  'viasat-explore': { name: 'Viasat Explore', epgId: 'ViasatExplore.ro', logo: 'viasatexplore' },
  'viasat-history': { name: 'Viasat History', epgId: 'ViasatHistory.ro', logo: 'viasathistory' },
  'viasat-nature': { name: 'Viasat Nature', epgId: 'ViasatNature.ro', logo: 'viasatnature' },

  // ═══ Copii ═══
  'minimax': { name: 'Minimax', epgId: 'Minimax.ro', logo: 'minimax' },
  'megamax': { name: 'Megamax', epgId: 'Megamax.ro', logo: 'megamax' },
  'cartoon-network': { name: 'Cartoon Network', epgId: 'CartoonNetwork.ro', logo: 'cartoonnetwork' },
  'disney-channel': { name: 'Disney Channel', epgId: 'DisneyChannel.ro', logo: 'disney' },
  'disney-junior': { name: 'Disney Junior', epgId: 'DisneyJunior.ro', logo: 'disneyjunior' },
  'nickelodeon-ro': { name: 'Nickelodeon', epgId: 'Nick.ro', logo: 'nick' },
  'nick-jr-ro': { name: 'Nick Jr.', epgId: 'NickJr.ro', logo: 'nickjr' },
  'boomerang-ro': { name: 'Boomerang', epgId: 'Boomerang.ro', logo: 'boomerang' },
  'jimjam': { name: 'JimJam', epgId: 'JimJam.ro', logo: 'jimjam' },

  // ═══ Religios ═══
  'trinitas': { name: 'Trinitas TV', epgId: 'Trinitas.ro', logo: 'trinitas' },
  'speranta-tv': { name: 'Speranța TV', epgId: 'SperantaTV.ro', logo: 'sperantatv' },
  'alfa-omega': { name: 'Alfa Omega TV', epgId: 'AlfaOmega.ro', logo: 'alfaomega' },

  // ═══ Lifestyle ═══
  'diva': { name: 'Diva', epgId: 'Diva.ro', logo: 'diva' },
  'tlc-ro': { name: 'TLC', epgId: 'TLC.ro', logo: 'tlc' },
  'e-entertainment': { name: 'E! Entertainment', epgId: 'E.ro', logo: 'eentertainment' },
  'paprika-tv': { name: 'Paprika TV', epgId: 'Paprika.ro', logo: 'paprika' },
  'food-network': { name: 'Food Network', epgId: 'FoodNetwork.ro', logo: 'foodnetwork' },
};

module.exports = {
  generateChannelId,
  hashUrl,
  sleep,
  retry,
  sanitize,
  categorizeChannel,
  normalizeChannelNameForMatch,
  KNOWN_CHANNELS,
};
