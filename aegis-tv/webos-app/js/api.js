/**
 * AegisTV — API Client
 * Communicates with the backend server
 */

const AegisAPI = (function() {
  'use strict';

  // Default backend — suprascris la boot din setări (cache) sau dev
  let BASE_URL = 'https://selenatv-production.up.railway.app';

  function setBaseUrl(url) {
    BASE_URL = url.replace(/\/$/, '');
  }

  /**
   * Generic fetch wrapper with timeout and error handling
   */
  async function request(endpoint, options = {}) {
    const url = BASE_URL + endpoint;
    const timeout = options.timeout || 8000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw err;
    }
  }

  /**
   * Get all channels, optionally filtered by category
   */
  async function getChannels(category) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return request(`/api/channels${query}`);
  }

  /**
   * Get single channel details
   */
  async function getChannel(id) {
    return request(`/api/channels/${id}`);
  }

  /**
   * Get all categories
   */
  async function getCategories() {
    return request('/api/categories');
  }

  /**
   * Get featured channels
   */
  async function getFeatured() {
    return request('/api/featured');
  }

  /**
   * Get EPG data
   */
  async function getEPG(channelId) {
    const query = channelId ? `?channel=${encodeURIComponent(channelId)}` : '';
    return request(`/api/epg${query}`);
  }

  /**
   * Search channels
   */
  async function search(query) {
    return request(`/api/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Get system status
   */
  async function getStatus() {
    return request('/api/status', { timeout: 5000 });
  }

  /**
   * Check if backend is reachable
   */
  async function isOnline() {
    try {
      await request('/health', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  return {
    setBaseUrl,
    getChannels,
    getChannel,
    getCategories,
    getFeatured,
    getEPG,
    search,
    getStatus,
    isOnline,
  };
})();
