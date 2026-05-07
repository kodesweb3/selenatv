/**
 * ═══════════════════════════════════════════════════════
 *   S E L E N A   T V  —  MAIN APPLICATION
 *   Private Premium IPTV Operating System
 *   Personal Use Only
 * ═══════════════════════════════════════════════════════
 */

const AegisApp = (function() {
  'use strict';

  let splashEl = null;
  let appEl = null;
  let statusEl = null;
  let loaderBar = null;
  let isBooted = false;

  /**
   * Boot the application
   */
  async function boot() {
    console.log('%c SelenaTV v1.0.0 ', 'background:#C6A972;color:#050505;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:4px');
    console.log('%c Private Premium IPTV OS ', 'color:#888;font-size:11px');

    splashEl = document.getElementById('splash-screen');
    appEl = document.getElementById('app');
    statusEl = document.getElementById('splash-status');
    loaderBar = document.getElementById('splash-loader-bar');

    // Animate splash in
    await delay(100);
    showSplash();

    // Initialize modules
    updateSplash('INIȚIALIZARE SISTEME', 10);
    await delay(200);

    // Load settings
    const settings = AegisCache.getSettings();
    AegisAPI.setBaseUrl(settings.backendUrl || 'https://selenatv-production.up.railway.app');

    // Initialize remote
    updateSplash('CONFIGURARE TELECOMANDĂ', 20);
    AegisRemote.init();
    AegisNav.init();
    await delay(100);

    // Initialize UI
    updateSplash('CONSTRUIRE INTERFAȚĂ', 30);
    AegisUI.init();
    AegisPlayer.init();
    await delay(100);

    // Check PIN lock
    if (settings.pinEnabled && settings.pin) {
      // Show PIN screen (simplified — handled by UI)
    }

    // Load cached data first for instant startup
    updateSplash('ÎNCĂRCARE CACHE', 40);
    let channels = AegisCache.get('channels');
    let cats = AegisCache.get('categories');
    let featured = AegisCache.get('featured');
    await delay(100);

    // Try to fetch fresh data from backend
    updateSplash('CONECTARE LA SELENA ENGINE', 60);
    const isOnline = await AegisAPI.isOnline();

    if (isOnline) {
      updateSplash('ÎNCĂRCARE CANALE', 70);
      try {
        const [chData, catData, featData] = await Promise.all([
          AegisAPI.getChannels(),
          AegisAPI.getCategories(),
          AegisAPI.getFeatured(),
        ]);

        if (chData && chData.channels) {
          channels = chData.channels;
          AegisCache.set('channels', channels);
        }
        if (catData && catData.categories) {
          cats = catData.categories;
          AegisCache.set('categories', cats);
        }
        if (featData && featData.channels) {
          featured = featData.channels;
          AegisCache.set('featured', featured);
        }

        updateSplash('CANALE ÎNCĂRCATE', 90);
      } catch (err) {
        console.warn('[App] Failed to fetch from backend:', err);
        updateSplash('SE FOLOSESC DATE CACHE', 80);
      }
    } else {
      updateSplash('MOD OFFLINE', 80);
      if (!channels) {
        channels = [];
      }
    }

    // Render home UI
    updateSplash('REDARE INTERFAȚĂ', 95);
    await delay(100);

    if (channels && channels.length > 0) {
      AegisUI.renderHome(channels, cats || [], featured || []);
    } else {
      AegisUI.renderHome([], [], []);
    }

    // Complete boot
    updateSplash('SELENA ONLINE', 100);
    await delay(500);

    // Transition from splash to app
    hideSplash();
    await delay(600);

    appEl.classList.add('visible');
    isBooted = true;

    // Register back button handler for player
    AegisRemote.on([AegisRemote.KEY.BACK, AegisRemote.KEY.BACK_ALT], () => {
      if (AegisPlayer.isActive()) {
        AegisPlayer.stop();
        return true;
      }
    });

    // Start background data refresh
    setInterval(refreshData, 5 * 60 * 1000); // Every 5 minutes

    console.log('[App] ✅ SelenaTV boot complete');
    console.log(`[App] ${(channels || []).length} channels ready`);
  }

  /**
   * Show splash screen animations
   */
  function showSplash() {
    const logo = splashEl.querySelector('.splash-logo');
    const title = splashEl.querySelector('.splash-title');
    const subtitle = splashEl.querySelector('.splash-subtitle');
    const loader = splashEl.querySelector('.splash-loader');
    const status = splashEl.querySelector('.splash-status');

    if (logo) logo.classList.add('visible');
    setTimeout(() => { if (title) title.classList.add('visible'); }, 200);
    setTimeout(() => { if (subtitle) subtitle.classList.add('visible'); }, 400);
    setTimeout(() => { if (loader) loader.classList.add('visible'); }, 600);
    setTimeout(() => { if (status) status.classList.add('visible'); }, 800);
  }

  /**
   * Hide splash screen
   */
  function hideSplash() {
    splashEl.classList.add('fade-out');
    setTimeout(() => {
      splashEl.style.display = 'none';
    }, 600);
  }

  /**
   * Update splash status
   */
  function updateSplash(text, progress) {
    if (statusEl) statusEl.textContent = text;
    if (loaderBar) loaderBar.style.width = progress + '%';
  }

  /**
   * Background data refresh
   */
  async function refreshData() {
    try {
      const isOnline = await AegisAPI.isOnline();
      if (!isOnline) return;

      const [chData, catData, featData] = await Promise.all([
        AegisAPI.getChannels(),
        AegisAPI.getCategories(),
        AegisAPI.getFeatured(),
      ]);

      if (chData && chData.channels) {
        AegisCache.set('channels', chData.channels);
      }
      if (catData && catData.categories) {
        AegisCache.set('categories', catData.categories);
      }
      if (featData && featData.channels) {
        AegisCache.set('featured', featData.channels);
      }

      console.log('[App] Background refresh complete');
    } catch (err) {
      console.warn('[App] Background refresh failed:', err.message);
    }
  }

  /**
   * Simple delay helper
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return {
    boot,
  };
})();

// ── Boot on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  AegisApp.boot();
});
