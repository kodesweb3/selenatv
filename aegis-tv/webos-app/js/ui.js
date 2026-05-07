/**
 * SelenaTV — UI Renderer
 * Rânduri pe categorii, căutare, filtre și favorite
 */

const AegisUI = (function() {
  'use strict';

  let allChannels = [];
  let categories = [];
  let featuredChannels = [];
  let currentView = 'home';
  /** @type {string|null} */
  let categoryFilter = null;
  let searchQuery = '';
  let contentRowZones = [];
  let contentRowIndex = 0;
  let homeUpDownWired = false;

  let dom = {};

  const CATEGORY_FALLBACK_ORDER = [
    'Știri', 'Info', 'Sport', 'Filme', 'Documentare', 'Istorie', 'Știință și natură',
    'Muzică', 'Copii', 'Lifestyle', 'Regional', 'General',
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
      if (!fromCh[n]) fromCh[n] = { name: n, count: 0, icon: categoryIcon(n) };
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

  function categoryIcon(name) {
    const icons = {
      'Știri': '📰',
      'Info': 'ℹ️',
      'General': '📺',
      'Sport': '⚽',
      'Muzică': '🎵',
      'Copii': '🧸',
      'Filme': '🎬',
      'Documentare': '🎞️',
      'Documentar': '🎞️',
      'Istorie': '🏛️',
      'Știință și natură': '🔬',
      'Regional': '🏘️',
      'Lifestyle': '✨',
    };
    return icons[name] || '📺';
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

  function filterByCategory(channels) {
    if (!categoryFilter) return channels;
    return channels.filter(ch => (ch.category || 'General') === categoryFilter);
  }

  function getWorkingChannels() {
    return filterByCategory(filterBySearch(allChannels));
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

    updateClock();
    setInterval(updateClock, 30000);

    bindSearch();
    bindTopNav();
    bindCategoryChipsClick();
    wireHomeVerticalNavOnce();
    wireFavoriteToggleOnce();

    console.log('[UI] Initialized');
  }

  function wireHomeVerticalNavOnce() {
    if (homeUpDownWired) return;
    homeUpDownWired = true;

    AegisRemote.on(AegisRemote.KEY.UP, (code, e) => {
      if (AegisPlayer.isActive()) return false;
      if (currentView !== 'home' && currentView !== 'channels') return false;
      if (AegisNav.getState().zone === 'category-chips') return false;
      if (contentRowZones.length === 0) return false;
      contentRowIndex = Math.max(0, contentRowIndex - 1);
      AegisNav.setZone(contentRowZones[contentRowIndex], 0);
      e.preventDefault();
      return true;
    });

    AegisRemote.on(AegisRemote.KEY.DOWN, (code, e) => {
      if (AegisPlayer.isActive()) return false;
      if (currentView !== 'home' && currentView !== 'channels') return false;
      if (AegisNav.getState().zone === 'category-chips') return false;
      if (contentRowZones.length === 0) return false;
      contentRowIndex = Math.min(contentRowZones.length - 1, contentRowIndex + 1);
      AegisNav.setZone(contentRowZones[contentRowIndex], 0);
      e.preventDefault();
      return true;
    });
  }

  function wireFavoriteToggleOnce() {
    AegisRemote.on(AegisRemote.KEY.YELLOW, () => {
      if (AegisPlayer.isActive()) return false;

      const state = AegisNav.getState();
      const zone = state.zone || '';
      const inRow = zone.startsWith('home-row-') || zone.startsWith('channels-row-') || zone === 'favorites-grid' || zone === 'home-row-search';
      if (!inRow) return false;

      const items = AegisNav.getItems();
      const el = items[state.index];
      if (!el || !el.dataset.channelId) return false;

      const id = el.dataset.channelId;
      const nowFav = AegisCache.toggleFavorite(id);
      syncCardFavoriteUi(el, id);
      showToast(nowFav ? '★ Adăugat la favorite' : '☆ Eliminat din favorite');

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
          badge.textContent = '★';
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
    nameEl.textContent = (isFav ? '★ ' : '') + base;
  }

  function bindSearch() {
    if (!dom.searchInput) return;
    const debounced = debounce(() => {
      searchQuery = dom.searchInput.value || '';
      if (currentView === 'home') renderHome();
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

  function bindCategoryChipsClick() {
    if (!dom.categoryStrip) return;
    dom.categoryStrip.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;
      applyCategoryFilter(chip.dataset.category === '' || chip.dataset.category === undefined ? null : chip.dataset.category);
    });
  }

  function applyCategoryFilter(cat) {
    categoryFilter = cat;
    document.querySelectorAll('.category-chip').forEach(chip => {
      const active = categoryFilter === null
        ? chip.dataset.category === ''
        : chip.dataset.category === categoryFilter;
      chip.classList.toggle('is-active', active);
    });
    if (currentView === 'home') renderHome();
    else if (currentView === 'channels') renderChannelsView();
  }

  function renderCategoryStrip() {
    if (!dom.categoryStrip) return;
    dom.categoryStrip.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'category-chip' + (categoryFilter === null ? ' is-active' : '');
    allChip.dataset.category = '';
    allChip.textContent = 'Toate';
    dom.categoryStrip.appendChild(allChip);

    const sorted = sortCategoryList(mergeCategoriesFromChannels(categories, allChannels));
    for (const cat of sorted) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-chip' + (categoryFilter === cat.name ? ' is-active' : '');
      btn.dataset.category = cat.name;
      const icon = cat.icon || categoryIcon(cat.name);
      btn.textContent = `${icon} ${cat.name} (${cat.count})`;
      dom.categoryStrip.appendChild(btn);
    }
  }

  function registerCategoryZone() {
    AegisNav.registerZone('category-chips', {
      selector: '.category-chip',
      columns: 100,
      loop: false,
      onSelect: (el) => {
        applyCategoryFilter(el.dataset.category === '' ? null : el.dataset.category);
      },
      onBack: () => {},
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
      const browse = view === 'home' || view === 'channels';
      dom.subToolbar.hidden = !browse;
      dom.mainContent.classList.toggle('main-content--browse', browse);
    }
  }

  function switchView(view) {
    currentView = view;
    setShellForView(view);

    if (view === 'home') renderHome();
    else if (view === 'channels') renderChannelsView();
    else if (view === 'favorites') renderFavorites();
    else AegisNav.clearZones();
  }

  /**
   * Date din app — normalizează și desenează prima dată
   */
  function renderHome(channels, cats, featured) {
    if (channels !== undefined) {
      allChannels = normalizeChannels(channels);
      categories = sortCategoryList(mergeCategoriesFromChannels(cats || [], allChannels));
      featuredChannels = featured || [];
      renderCategoryStrip();
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
    contentRowZones = [];

    const base = getWorkingChannels();
    const q = (searchQuery || '').trim();

    if (q) {
      const row = createChannelRow('Rezultate căutare', base, 'search');
      container.appendChild(row);
      registerContentRows(['home-row-search'], 'scroll-search');
      runEnterAnimations(container);
      registerCategoryZone();
      return;
    }

    const heroSource = featuredChannels[0] || allChannels[0];
    if (heroSource && categoryFilter === null) {
      container.appendChild(createHero(heroSource));
    }

    if (categoryFilter === null && featuredChannels.length > 0) {
      const row = createChannelRow('Recomandate', featuredChannels.filter(ch => base.some(b => b.id === ch.id)), 'featured');
      if (row.querySelectorAll('.channel-card').length > 0) container.appendChild(row);
    }

    if (categoryFilter === null) {
      const recent = AegisCache.getRecent();
      if (recent.length > 0) {
        const recentCh = recent
          .map(r => allChannels.find(ch => ch.id === r.id))
          .filter(Boolean)
          .filter(ch => base.some(b => b.id === ch.id))
          .slice(0, 12);
        if (recentCh.length > 0) {
          container.appendChild(createChannelRow('Vizionate recent', recentCh, 'recent'));
        }
      }

      const favIds = AegisCache.getFavorites();
      if (favIds.length > 0) {
        const favCh = favIds
          .map(id => allChannels.find(ch => ch.id === id))
          .filter(Boolean)
          .filter(ch => base.some(b => b.id === ch.id));
        if (favCh.length > 0) {
          container.appendChild(createChannelRow('Favorite', favCh, 'favorites-home'));
        }
      }
    }

    const orderedCats = sortCategoryList(mergeCategoriesFromChannels(categories, allChannels));
    for (const cat of orderedCats) {
      if (categoryFilter && cat.name !== categoryFilter) continue;
      const catChannels = base.filter(ch => (ch.category || 'General') === cat.name);
      if (catChannels.length === 0) continue;
      const slug = rowSlug(cat.name);
      const icon = cat.icon || categoryIcon(cat.name);
      container.appendChild(createChannelRow(`${icon} ${cat.name}`, catChannels, `cat-${slug}`));
    }

    registerHomeRowZones(container);
    runEnterAnimations(container);
    registerCategoryZone();
  }

  function renderChannelsView() {
    if (!dom.channelsView) return;
    currentView = 'channels';
    setShellForView('channels');
    AegisNav.clearZones();
    dom.channelsView.innerHTML = '';
    contentRowZones = [];

    const base = getWorkingChannels();
    const q = (searchQuery || '').trim();

    if (q) {
      dom.channelsView.appendChild(createChannelRow('Rezultate căutare', base, 'ch-search'));
      registerChannelsRows(['channels-row-ch-search'], 'scroll-ch-search');
      runEnterAnimations(dom.channelsView);
      registerCategoryZone();
      return;
    }

    const orderedCats = sortCategoryList(mergeCategoriesFromChannels(categories, allChannels));
    for (const cat of orderedCats) {
      if (categoryFilter && cat.name !== categoryFilter) continue;
      const catChannels = base.filter(ch => (ch.category || 'General') === cat.name);
      if (catChannels.length === 0) continue;
      const slug = rowSlug(cat.name);
      const icon = cat.icon || categoryIcon(cat.name);
      dom.channelsView.appendChild(createChannelRow(`${icon} ${cat.name}`, catChannels, `ch-${slug}`));
    }

    registerChannelsBrowseZones();
    runEnterAnimations(dom.channelsView);
    registerCategoryZone();
  }

  function registerContentRows(zoneNames, scrollIdPrefix) {
    contentRowZones = zoneNames;
    contentRowIndex = 0;
    zoneNames.forEach((zoneName, i) => {
      const id = zoneName.replace(/^home-row-|^channels-row-/, '');
      const scrollId = scrollIdPrefix || `scroll-${id}`;
      AegisNav.registerZone(zoneName, {
        selector: `#${scrollId} .channel-card`,
        columns: 100,
        loop: false,
        onSelect: (el) => selectCardPlay(el),
        onBack: () => {},
      });
    });
    if (zoneNames.length > 0) AegisNav.setZone(zoneNames[0], 0);
  }

  function registerHomeRowZones(container) {
    const rows = container.querySelectorAll('.channel-row');
    const zoneNames = [];
    rows.forEach((row) => {
      const id = row.id.replace('row-', '');
      const zoneName = `home-row-${id}`;
      zoneNames.push(zoneName);
      AegisNav.registerZone(zoneName, {
        selector: `#scroll-${id} .channel-card`,
        columns: 100,
        loop: false,
        onSelect: (el) => selectCardPlay(el),
        onBack: () => {},
      });
    });
    contentRowZones = zoneNames;
    contentRowIndex = 0;
    if (zoneNames.length > 0) AegisNav.setZone(zoneNames[0], 0);
  }

  function registerChannelsBrowseZones() {
    const rows = dom.channelsView.querySelectorAll('.channel-row');
    const zoneNames = [];
    rows.forEach((row) => {
      const id = row.id.replace('row-', '');
      const zoneName = `channels-row-${id}`;
      zoneNames.push(zoneName);
      AegisNav.registerZone(zoneName, {
        selector: `#scroll-${id} .channel-card`,
        columns: 100,
        loop: false,
        onSelect: (el) => selectCardPlay(el),
        onBack: () => {},
      });
    });
    contentRowZones = zoneNames;
    contentRowIndex = 0;
    if (zoneNames.length > 0) AegisNav.setZone(zoneNames[0], 0);
  }

  function registerChannelsRows(zoneNames, scrollId) {
    contentRowZones = zoneNames;
    contentRowIndex = 0;
    zoneNames.forEach((zoneName) => {
      AegisNav.registerZone(zoneName, {
        selector: `#${scrollId} .channel-card`,
        columns: 100,
        loop: false,
        onSelect: (el) => selectCardPlay(el),
        onBack: () => {},
      });
    });
    if (zoneNames.length > 0) AegisNav.setZone(zoneNames[0], 0);
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
    contentRowZones = [];

    const favIds = AegisCache.getFavorites();
    const favChannels = favIds
      .map(id => allChannels.find(ch => ch.id === id))
      .filter(Boolean);

    if (favChannels.length === 0) {
      dom.favoritesEmpty.hidden = false;
      return;
    }

    dom.favoritesEmpty.hidden = true;
    for (const ch of favChannels) {
      dom.favoritesGrid.appendChild(createChannelCard(ch));
    }

    AegisNav.registerZone('favorites-grid', {
      selector: '#favorites-grid .channel-card',
      columns: 5,
      loop: false,
      onSelect: (el) => selectCardPlay(el),
      onBack: () => {},
    });
    contentRowZones = ['favorites-grid'];
    contentRowIndex = 0;
    AegisNav.setZone('favorites-grid', 0);
  }

  function runEnterAnimations(container) {
    requestAnimationFrame(() => {
      const hero = container.querySelector('.hero-section');
      if (hero) hero.classList.add('visible');
      const cards = container.querySelectorAll('.channel-card');
      cards.forEach((card, i) => {
        setTimeout(() => card.classList.add('loaded'), i * 25);
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

  function createChannelRow(title, channels, id) {
    const row = document.createElement('div');
    row.className = 'channel-row';
    row.id = `row-${id}`;

    const header = document.createElement('div');
    header.className = 'channel-row-header';
    header.innerHTML = `
      <span class="channel-row-title">${escapeHtml(title)}</span>
      <span class="channel-row-count">${channels.length} canale</span>
    `;
    row.appendChild(header);

    const scroll = document.createElement('div');
    scroll.className = 'channel-row-scroll';
    scroll.id = `scroll-${id}`;

    for (const ch of channels) {
      scroll.appendChild(createChannelCard(ch));
    }

    row.appendChild(scroll);
    return row;
  }

  function createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.dataset.channelId = channel.id;
    card.tabIndex = -1;

    const isFav = AegisCache.isFavorite(channel.id);
    if (isFav) card.classList.add('is-favorite');

    const epgText = (channel.epg && channel.epg.now) ? channel.epg.now.title : '';
    const logoSrc = channel.logo || '';

    card.innerHTML = `
      <div class="channel-card-thumb">
        <img class="channel-card-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(channel.name)}" loading="lazy" onerror="this.style.display='none'">
        <span class="channel-card-quality">${channel.quality || 'HD'}</span>
        <span class="channel-card-live"><span class="channel-card-live-dot"></span>LIVE</span>
        ${isFav ? '<span class="channel-card-fav-badge" aria-hidden="true">★</span>' : ''}
      </div>
      <div class="channel-card-info">
        <div class="channel-card-name">${isFav ? '★ ' : ''}${escapeHtml(channel.name)}</div>
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

  return {
    init,
    renderHome,
    switchView,
    showToast,
    getChannels,
    escapeHtml,
  };
})();
