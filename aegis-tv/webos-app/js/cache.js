/**
 * AegisTV — Local Cache Manager
 * Uses localStorage for offline-first ultra-fast startup
 */

const AegisCache = (function() {
  'use strict';

  const PREFIX = 'aegis_';
  const TTL = {
    channels: 30 * 60 * 1000,    // 30 minutes
    categories: 60 * 60 * 1000,   // 1 hour
    featured: 30 * 60 * 1000,     // 30 minutes
    epg: 60 * 60 * 1000,          // 1 hour
    favorites: Infinity,           // Never expires
    recent: Infinity,              // Never expires
    settings: Infinity,            // Never expires
  };

  /**
   * Save data to local storage with timestamp
   */
  function set(key, data) {
    try {
      const entry = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch (e) {
      // Storage full — clear old data
      clearOld();
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (e2) {
        console.warn('[Cache] Storage full, cannot save:', key);
      }
    }
  }

  /**
   * Get data from local storage, respecting TTL
   */
  function get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;

      const entry = JSON.parse(raw);
      const ttl = TTL[key] || 30 * 60 * 1000;

      if (ttl !== Infinity && Date.now() - entry.timestamp > ttl) {
        localStorage.removeItem(PREFIX + key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Remove a specific key
   */
  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  /**
   * Clear expired entries
   */
  function clearOld() {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (!key.startsWith(PREFIX)) continue;
      const shortKey = key.slice(PREFIX.length);
      const ttl = TTL[shortKey];
      if (!ttl || ttl === Infinity) continue;

      try {
        const entry = JSON.parse(localStorage.getItem(key));
        if (Date.now() - entry.timestamp > ttl) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  }

  // ── Favorites ──

  function getFavorites() {
    return get('favorites') || [];
  }

  function addFavorite(channelId) {
    const favs = getFavorites();
    if (!favs.includes(channelId)) {
      favs.unshift(channelId);
      set('favorites', favs);
    }
  }

  function removeFavorite(channelId) {
    const favs = getFavorites().filter(id => id !== channelId);
    set('favorites', favs);
  }

  function isFavorite(channelId) {
    return getFavorites().includes(channelId);
  }

  function toggleFavorite(channelId) {
    if (isFavorite(channelId)) {
      removeFavorite(channelId);
      return false;
    } else {
      addFavorite(channelId);
      return true;
    }
  }

  // ── Recently Watched ──

  function getRecent() {
    return get('recent') || [];
  }

  function addRecent(channel) {
    let recent = getRecent().filter(r => r.id !== channel.id);
    recent.unshift({
      id: channel.id,
      name: channel.name,
      logo: channel.logo,
      category: channel.category,
      watchedAt: Date.now(),
    });
    // Keep last 20
    recent = recent.slice(0, 20);
    set('recent', recent);
  }

  // ── Settings ──

  function getSettings() {
    return get('settings') || {
      backendUrl: 'https://selenatv-production.up.railway.app',
      pinEnabled: false,
      pin: '',
      autoplay: true,
      lastChannel: null,
    };
  }

  function saveSettings(settings) {
    set('settings', settings);
  }

  return {
    set,
    get,
    remove,
    clearOld,
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    getRecent,
    addRecent,
    getSettings,
    saveSettings,
  };
})();
