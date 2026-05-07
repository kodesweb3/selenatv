/**
 * SelenaTV — UI: hub categorii (pictograme SVG) + grilă canale, căutare, favorite
 */

const AegisUI = (function() {
  'use strict';

  const GRID_COLS = 5;
  const ZONE_TOP_NAV = 'top-nav';
  const ZONE_CAT_HUB = 'category-hub';
  const ZONE_CHANNEL_GRID = 'channel-grid-main';
  const ZONE_CHANNEL_SEARCH = 'channel-grid-search';

  let allChannels = [];
  let categories = [];
  let featuredChannels = [];
  let currentView = 'home';
  let searchQuery = '';
  let hubNavWired = false;

  /** @type {'hub'|'grid'} */
  let browseMode = 'hub';
  /** @type {string|null} */
  let gridCategory = null;

  let dom = {};

  const CATEGORY_FALLBACK_ORDER = [
    'Știri', 'Info', 'Sport', '4K', 'Filme', 'Documentare', 'Istorie', 'Știință și natură',
    'Muzică', 'Copii', 'Lifestyle', 'Regional', 'General', 'Ultra HD',
  ];

  function rowSlug(name) {
    return String(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'row';
  }

  function normalizeChannel(ch) {
    if (!ch) return ch;
    let cat = ch.category || 'General';
    if (cat === 'Documentar') cat = 'Documentare';
    if (cat === ch.category) return ch;
    return { ...ch, category: cat };
  }

  function normalizeChannels(list) {
    return (list || []).map(normalizeChannel);
  }

  function debounce(fn, ms) {
    let t = 0;
    return function debounced() {
      clearTimeout(t);
      const ctx = this;
      const args = arguments;
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  }

  function mergeCategoriesFromChannels(cats, chans) {
    const have = new Set((cats || []).map(c => c.name));
    const fromCh = {};
    for (const ch of chans) {
      const n = ch.category || 'General';
      if (!fromCh[n]) fromCh[n] = { name: n, count: 0 };
      fromCh[n].count++;
    }
    const merged = [...(cats || [])];
    for (const row of Object.values(fromCh)) {
      if (!have.has(row.name)) merged.push(row);
    }
    return sortCategoryList(merged);
  }

  function sortCategoryList(cats) {
    const rank = (name) => {
      const i = CATEGORY_FALLBACK_ORDER.indexOf(name);
      return i === -1 ? CATEGORY_FALLBACK_ORDER.length : i;
    };
    return [...cats].sort((a, b) => {
      const d = rank(a.name) - rank(b.name);
      if (d !== 0) return d;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'ro');
    });
  }

  function filterBySearch(channels) {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(ch =>
      (ch.name || '').toLowerCase().includes(q) ||
      (ch.category || '').toLowerCase().includes(q) ||
      (ch.id || '').toLowerCase().includes(q)
    );
  }

  function getWorkingChannels() {
    return filterBySearch(allChannels);
  }

  function resolveLogoUrl(logo) {
    if (!logo) return '';
    const s = String(logo).trim();
    if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
    const base = typeof AegisAPI !== 'undefined' && AegisAPI.getBaseUrl ? AegisAPI.getBaseUrl() : '';
    if (!base) return s;
    return base + (s.startsWith('/') ? s : '/' + s);
  }

  function logoPlaceholderDataUri(name) {
    const letter = (name || '?').trim().charAt(0).toUpperCase() || 'TV';
    const enc = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect fill="#1a1a1a" width="120" height="80"/><text x="60" y="48" text-anchor="middle" fill="#C6A972" font-family="system-ui,sans-serif" font-size="28" font-weight="600">${letter}</text></svg>`
    );
    return 'data:image/svg+xml,' + enc;
  }

  function wireTopAndHubNavOnce() {
    if (hubNavWired) return;
    hubNavWired = true;

    AegisRemote.on(AegisRemote.KEY.DOWN, (code, e) => {
      if (AegisPlayer.isActive()) return false;
      const st = AegisNav.getState();
      if (st.zone === ZONE_TOP_NAV) {
        if (browseMode === 'hub') AegisNav.setZone(ZONE_CAT_HUB, 0);
        else if (browseMode === 'grid') AegisNav.setZone(ZONE_CHANNEL_GRID, 0);
        else AegisNav.setZone(ZONE_CHANNEL_SEARCH, 0);
        e.preventDefault();
        return true;
      }
      return false;
    });

    AegisRemote.on(AegisRemote.KEY.UP, (code, e) => {
      if (AegisPlayer.isActive()) return false;
      const st = AegisNav.getState();
      if (st.zone === ZONE_CAT_HUB && st.index < GRID_COLS) {
        AegisNav.setZone(ZONE_TOP_NAV, Math.min(st.index, 3));
        e.preventDefault();
        return true;
      }
      if (st.zone === ZONE_CHANNEL_GRID && st.index < GRID_COLS) {
        closeCategoryGrid();
        AegisNav.setZone(ZONE_CAT_HUB, 0);
        e.preventDefault();
        return true;
      }
      if (st.zone === ZONE_CHANNEL_SEARCH && st.index < GRID_COLS && (searchQuery || '').trim()) {
        AegisNav.setZone(ZONE_TOP_NAV, 3);
        e.preventDefault();
        return true;
      }
      return false;
    });
  }

  function registerTopNavZone() {
    AegisNav.registerZone(ZONE_TOP_NAV, {
      selector: '.top-bar-nav-item',
      columns: 100,
      loop: false,
      onSelect: (el) => {
        const v = el.dataset.view;
        if (v) switchView(v);
      },
      onBack: () => {},
    });
  }

  function registerCategoryHubZone() {
    AegisNav.registerZone(ZONE_CAT_HUB, {
      selector: '#category-hub-grid .category-tile',
      columns: GRID_COLS,
      loop: false,
      onSelect: (el) => {
        const cat = el.dataset.category;
        if (cat) openCategoryGrid(cat);
      },
      onBack: () => {},
    });
  }

  function registerChannelGridZone(zoneId, selectorRoot) {
    const sel = selectorRoot + ' .channel-card';
    AegisNav.registerZone(zoneId, {
      selector: sel,
      columns: GRID_COLS,
      loop: false,
      onSelect: (el) => selectCardPlay(el),
      onBack: () => {
        if (zoneId === ZONE_CHANNEL_GRID) {
          closeCategoryGrid();
        }
      },
    });
  }

  function openCategoryGrid(catName) {
    gridCategory = catName;
    browseMode = 'grid';
    if (currentView === 'home') paintHomeContent();
    else if (currentView === 'channels') renderChannelsView();
  }

  function closeCategoryGrid() {
    browseMode = 'hub';
    gridCategory = null;
    if (currentView === 'home') paintHomeContent();
    else if (currentView === 'channels') renderChannelsView();
  }

  function init() {
    dom = {
      mainContent: document.getElementById('main-content'),
      homeView: document.getElementById('home-view'),
      channelsView: document.getElementById('channels-view'),
      favoritesGrid: document.getElementById('favorites-grid'),
      favoritesEmpty: document.getElementById('favorites-empty'),
      categoryStrip: document.getElementById('category-strip'),
      subToolbar: document.getElementById('sub-toolbar'),
      searchInput: document.getElementById('channel-search'),
      toast: document.getElementById('toast'),
      clock: document.getElementById('top-bar-time'),
    };

    if (dom.subToolbar) dom.subToolbar.hidden = true;

    updateClock();
    setInterval(updateClock, 30000);

    bindSearch();
    bindTopNav();
    wireFavoriteToggleOnce();
    wireTopAndHubNavOnce();

    console.log('[UI] Initialized');
  }

  function wireFavoriteToggleOnce() {
    AegisRemote.on(AegisRemote.KEY.YELLOW, () => {
      if (AegisPlayer.isActive()) return false;

      const state = AegisNav.getState();
      const zone = state.zone || '';
      const inGrid = zone === ZONE_CHANNEL_GRID || zone === ZONE_CHANNEL_SEARCH || zone === 'favorites-grid';
      if (!inGrid) return false;

      const items = AegisNav.getItems();
      const el = items[state.index];
      if (!el || !el.dataset.channelId) return false;

      const id = el.dataset.channelId;
      const nowFav = AegisCache.toggleFavorite(id);
      syncCardFavoriteUi(el, id);
      showToast(nowFav ? 'Adăugat la favorite' : 'Eliminat din favorite');

      if (currentView === 'favorites') renderFavorites();
      return true;
    });
  }

  function syncCardFavoriteUi(cardEl, channelId) {
    if (!cardEl) return;
    const isFav = AegisCache.isFavorite(channelId);
    cardEl.classList.toggle('is-favorite', isFav);
    const thumb = cardEl.querySelector('.channel-card-thumb');
    if (thumb) {
      let badge = thumb.querySelector('.channel-card-fav-badge');
      if (isFav) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'channel-card-fav-badge';
          badge.setAttribute('aria-hidden', 'true');
          badge.title = 'Favorit';
          thumb.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    }
    const nameEl = cardEl.querySelector('.channel-card-name');
    if (!nameEl) return;
    const ch = allChannels.find(c => c.id === channelId);
    const base = ch ? ch.name : nameEl.textContent.replace(/^[★☆]\s*/, '').trim();
    nameEl.textContent = base;
  }

  function bindSearch() {
    if (!dom.searchInput) return;
    const debounced = debounce(() => {
      searchQuery = dom.searchInput.value || '';
      browseMode = (searchQuery || '').trim() ? 'grid' : 'hub';
      if (!(searchQuery || '').trim()) gridCategory = null;
      if (currentView === 'home') paintHomeContent();
      else if (currentView === 'channels') renderChannelsView();
    }, 220);
    dom.searchInput.addEventListener('input', debounced);
  }

  function bindTopNav() {
    document.querySelectorAll('.top-bar-nav-item').forEach(el => {
      el.addEventListener('click', () => switchView(el.dataset.view));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          switchView(el.dataset.view);
        }
      });
    });
  }

  function setShellForView(view) {
    document.querySelectorAll('.top-bar-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.hidden = panel.dataset.viewPanel !== view;
    });

    if (dom.subToolbar && dom.mainContent) {
      dom.subToolbar.hidden = true;
      const browse = view === 'home' || view === 'channels';
      dom.mainContent.classList.toggle('main-content--browse', browse);
    }
  }

  function switchView(view) {
    currentView = view;
    setShellForView(view);

    if (view === 'home') paintHomeContent();
    else if (view === 'channels') renderChannelsView();
    else if (view === 'favorites') renderFavorites();
    else AegisNav.clearZones();
  }

  function renderHome(channels, cats, featured) {
    if (channels !== undefined) {
      allChannels = normalizeChannels(channels);
      categories = sortCategoryList(mergeCategoriesFromChannels(cats || [], allChannels));
      featuredChannels = featured || [];
      browseMode = 'hub';
      gridCategory = null;
    }
    currentView = 'home';
    setShellForView('home');
    paintHomeContent();
  }

  function paintHomeContent() {
    const container = dom.homeView;
    if (!container) return;

    AegisNav.clearZones();
    container.innerHTML = '';
    registerTopNavZone();

    const base = getWorkingChannels();
    const q = (searchQuery || '').trim();

    if (q) {
      container.appendChild(createSearchHeader('Rezultate căutare'));
      container.appendChild(createChannelGridWrap('channel-grid-search-wrap', base, ZONE_CHANNEL_SEARCH));
      registerChannelGridZone(ZONE_CHANNEL_SEARCH, '#channel-grid-search-wrap');
      AegisNav.setZone(ZONE_CHANNEL_SEARCH, 0);
      runEnterAnimations(container);
      return;
    }

    if (browseMode === 'grid' && gridCategory) {
      const catChannels = base.filter(ch => (ch.category || 'General') === gridCategory);
      const header = document.createElement('div');
      header.className = 'browse-back-header';
      header.innerHTML = `
        <button type="button" class="browse-back-hint" id="btn-back-category" tabindex="-1">Înapoi la categorii</button>
        <h2 class="browse-grid-title">${escapeHtml(gridCategory)} <span class="browse-grid-count">${catChannels.length} canale</span></h2>
      `;
      const btn = header.querySelector('#btn-back-category');
      if (btn) {
        btn.addEventListener('click', () => closeCategoryGrid());
      }
      container.appendChild(header);
      container.appendChild(createChannelGridWrap('channel-grid-browse-wrap', catChannels, ZONE_CHANNEL_GRID));
      registerChannelGridZone(ZONE_CHANNEL_GRID, '#channel-grid-browse-wrap');
      AegisNav.setZone(ZONE_CHANNEL_GRID, 0);
      runEnterAnimations(container);
      return;
    }

    const orderedCats = sortCategoryList(mergeCategoriesFromChannels(categories, allChannels));

    const hubSection = document.createElement('section');
    hubSection.className = 'category-hub-section';
    hubSection.innerHTML = '<h2 class="category-hub-heading">Categorii</h2><div id="category-hub-grid" class="category-hub-grid" role="list"></div>';
    const hubGrid = hubSection.querySelector('#category-hub-grid');
    for (const cat of orderedCats) {
      const catChannels = base.filter(ch => (ch.category || 'General') === cat.name);
      if (catChannels.length === 0) continue;
      hubGrid.appendChild(createCategoryTile(cat.name, catChannels.length));
    }
    container.appendChild(hubSection);

    const heroSource = featuredChannels[0] || allChannels[0];
    if (heroSource) {
      container.appendChild(createHero(heroSource));
    }

    registerCategoryHubZone();
    if (orderedCats.length === 0 || hubGrid.children.length === 0) {
      AegisNav.setZone(ZONE_TOP_NAV, 0);
    } else {
      AegisNav.setZone(ZONE_CAT_HUB, 0);
    }
    runEnterAnimations(container);
  }

  function renderChannelsView() {
    if (!dom.channelsView) return;
    currentView = 'channels';
    setShellForView('channels');
    AegisNav.clearZones();
    dom.channelsView.innerHTML = '';
    registerTopNavZone();

    const base = getWorkingChannels();
    const q = (searchQuery || '').trim();

    if (q) {
      dom.channelsView.appendChild(createSearchHeader('Rezultate căutare'));
      dom.channelsView.appendChild(createChannelGridWrap('channel-grid-search-wrap', base, ZONE_CHANNEL_SEARCH));
      registerChannelGridZone(ZONE_CHANNEL_SEARCH, '#channel-grid-search-wrap');
      AegisNav.setZone(ZONE_CHANNEL_SEARCH, 0);
      runEnterAnimations(dom.channelsView);
      return;
    }

    if (browseMode === 'grid' && gridCategory) {
      const catChannels = base.filter(ch => (ch.category || 'General') === gridCategory);
      const header = document.createElement('div');
      header.className = 'browse-back-header';
      header.innerHTML = `
        <button type="button" class="browse-back-hint" tabindex="-1">Înapoi la categorii</button>
        <h2 class="browse-grid-title">${escapeHtml(gridCategory)} <span class="browse-grid-count">${catChannels.length} canale</span></h2>
      `;
      header.querySelector('button').addEventListener('click', () => closeCategoryGrid());
      dom.channelsView.appendChild(header);
      dom.channelsView.appendChild(createChannelGridWrap('channel-grid-browse-wrap', catChannels, ZONE_CHANNEL_GRID));
      registerChannelGridZone(ZONE_CHANNEL_GRID, '#channel-grid-browse-wrap');
      AegisNav.setZone(ZONE_CHANNEL_GRID, 0);
      runEnterAnimations(dom.channelsView);
      return;
    }

    const hubSection = document.createElement('section');
    hubSection.className = 'category-hub-section';
    hubSection.innerHTML = '<h2 class="category-hub-heading">Categorii</h2><div id="category-hub-grid" class="category-hub-grid" role="list"></div>';
    const hubGrid = hubSection.querySelector('#category-hub-grid');
    const orderedCats = sortCategoryList(mergeCategoriesFromChannels(categories, allChannels));
    for (const cat of orderedCats) {
      const catChannels = base.filter(ch => (ch.category || 'General') === cat.name);
      if (catChannels.length === 0) continue;
      hubGrid.appendChild(createCategoryTile(cat.name, catChannels.length));
    }
    dom.channelsView.appendChild(hubSection);

    registerCategoryHubZone();
    if (orderedCats.length === 0 || hubGrid.children.length === 0) {
      AegisNav.setZone(ZONE_TOP_NAV, 1);
    } else {
      AegisNav.setZone(ZONE_CAT_HUB, 0);
    }
    runEnterAnimations(dom.channelsView);
  }

  function createSearchHeader(title) {
    const h = document.createElement('div');
    h.className = 'browse-back-header';
    h.innerHTML = `<h2 class="browse-grid-title">${escapeHtml(title)}</h2>`;
    return h;
  }

  function createCategoryTile(name, count) {
    const el = document.createElement('div');
    el.className = 'category-tile';
    el.dataset.category = name;
    el.setAttribute('role', 'listitem');
    el.tabIndex = -1;
    const svg = typeof CategoryIcons !== 'undefined' ? CategoryIcons.svgForCategory(name) : '';
    el.innerHTML = `
      <div class="category-tile-icon">${svg}</div>
      <div class="category-tile-name">${escapeHtml(name)}</div>
      <div class="category-tile-meta">${count} canale</div>
    `;
    return el;
  }

  function createChannelGridWrap(wrapId, channels, _hintId) {
    const wrap = document.createElement('div');
    wrap.id = wrapId.replace(/^#/, '');
    wrap.className = 'channel-grid channel-grid-page';
    for (const ch of channels) {
      wrap.appendChild(createChannelCard(ch));
    }
    return wrap;
  }

  function selectCardPlay(el) {
    const channelId = el.dataset.channelId;
    const channel = allChannels.find(c => c.id === channelId);
    if (channel) AegisPlayer.play(channel, allChannels);
  }

  function renderFavorites() {
    if (!dom.favoritesGrid || !dom.favoritesEmpty) return;
    AegisNav.clearZones();
    dom.favoritesGrid.innerHTML = '';
    registerTopNavZone();

    const favIds = AegisCache.getFavorites();
    const favChannels = favIds
      .map(id => allChannels.find(ch => ch.id === id))
      .filter(Boolean);

    if (favChannels.length === 0) {
      dom.favoritesEmpty.hidden = false;
      AegisNav.setZone(ZONE_TOP_NAV, 2);
      return;
    }

    dom.favoritesEmpty.hidden = true;
    for (const ch of favChannels) {
      dom.favoritesGrid.appendChild(createChannelCard(ch));
    }

    AegisNav.registerZone('favorites-grid', {
      selector: '#favorites-grid .channel-card',
      columns: GRID_COLS,
      loop: false,
      onSelect: (el) => selectCardPlay(el),
      onBack: () => {},
    });
    AegisNav.setZone('favorites-grid', 0);
  }

  function runEnterAnimations(container) {
    requestAnimationFrame(() => {
      const hero = container.querySelector('.hero-section');
      if (hero) hero.classList.add('visible');
      const cards = container.querySelectorAll('.channel-card, .category-tile');
      cards.forEach((card, i) => {
        setTimeout(() => card.classList.add('loaded'), i * 20);
      });
    });
  }

  function createHero(channel) {
    const section = document.createElement('div');
    section.className = 'hero-section';

    const epgNow = (channel.epg && channel.epg.now) ? channel.epg.now.title : 'Televiziune live';

    section.innerHTML = `
      <div class="hero-bg"></div>
      <div class="hero-content">
        <div class="hero-badge">
          <span class="hero-badge-dot"></span>
          ÎN DIRECT
        </div>
        <h1 class="hero-channel-name">${escapeHtml(channel.name)}</h1>
        <p class="hero-now-playing">${escapeHtml(epgNow)}</p>
        <div class="hero-meta">
          <span class="hero-meta-item">
            <span>${channel.quality || 'HD'}</span>
          </span>
          <span class="hero-meta-item">
            <span>${escapeHtml(channel.category)}</span>
          </span>
          <span class="hero-meta-item">
            <span>Scor: ${channel.score}/100</span>
          </span>
        </div>
      </div>
    `;

    return section;
  }

  function createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.dataset.channelId = channel.id;
    card.tabIndex = -1;

    const isFav = AegisCache.isFavorite(channel.id);
    if (isFav) card.classList.add('is-favorite');

    const epgText = (channel.epg && channel.epg.now) ? channel.epg.now.title : '';
    const logoSrc = resolveLogoUrl(channel.logo);
    const placeholder = logoPlaceholderDataUri(channel.name);

    card.innerHTML = `
      <div class="channel-card-thumb">
        <img class="channel-card-logo" src="${escapeHtml(logoSrc || placeholder)}" alt="${escapeHtml(channel.name)}" loading="lazy">
        <span class="channel-card-quality">${escapeHtml(channel.quality || 'HD')}</span>
        <span class="channel-card-live"><span class="channel-card-live-dot"></span>LIVE</span>
        ${isFav ? '<span class="channel-card-fav-badge" aria-hidden="true" title="Favorit"></span>' : ''}
      </div>
      <div class="channel-card-info">
        <div class="channel-card-name">${escapeHtml(channel.name)}</div>
        <div class="channel-card-category">${escapeHtml(channel.category)}</div>
        ${epgText ? `<div class="channel-card-epg">${escapeHtml(epgText)}</div>` : ''}
        <div class="channel-card-score">
          <div class="channel-card-score-bar">
            <div class="channel-card-score-fill" style="width:${channel.score || 0}%"></div>
          </div>
          <span class="channel-card-score-value">${channel.score || 0}</span>
        </div>
      </div>
    `;

    const img = card.querySelector('.channel-card-logo');
    if (img) {
      img.addEventListener('error', function onLogoErr() {
        img.removeEventListener('error', onLogoErr);
        img.src = placeholder;
      }, { once: true });
    }

    return card;
  }

  function showToast(message, type) {
    const toast = dom.toast;
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast';
    if (type) toast.classList.add(type);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    setTimeout(() => {
      toast.classList.remove('visible');
    }, 2500);
  }

  function updateClock() {
    if (dom.clock) {
      const now = new Date();
      dom.clock.textContent = now.toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getChannels() {
    return allChannels;
  }

  function handleBackFromPlayer() {
    closeCategoryGrid();
  }

  return {
    init,
    renderHome,
    switchView,
    showToast,
    getChannels,
    escapeHtml,
    closeCategoryGrid,
    handleBackFromPlayer,
  };
})();
