/**
 * AegisTV — Video Player Engine
 * HLS.js powered fullscreen IPTV player
 */

const AegisPlayer = (function() {
  'use strict';

  let videoEl = null;
  let hls = null;
  let currentChannel = null;
  let overlayTimer = null;
  let overlayVisible = false;
  let isPlaying = false;
  let channelList = [];
  let channelIndex = -1;

  // DOM references
  let dom = {};

  /**
   * Initialize player
   */
  function init() {
    videoEl = document.getElementById('player-video');
    dom = {
      view: document.getElementById('player-view'),
      overlay: document.getElementById('player-overlay'),
      loading: document.getElementById('player-loading'),
      error: document.getElementById('player-error'),
      channelName: document.getElementById('player-ch-name'),
      channelLogo: document.getElementById('player-ch-logo'),
      channelQuality: document.getElementById('player-ch-quality'),
      epgNowTitle: document.getElementById('player-epg-now-title'),
      epgNowTime: document.getElementById('player-epg-now-time'),
      epgNextTitle: document.getElementById('player-epg-next-title'),
      progress: document.getElementById('player-progress-fill'),
      errorText: document.getElementById('player-error-text'),
      switcherContainer: document.getElementById('channel-switcher'),
    };

    // Video events
    if (videoEl) {
      videoEl.addEventListener('playing', onPlaying);
      videoEl.addEventListener('waiting', onBuffering);
      videoEl.addEventListener('error', onError);
      videoEl.addEventListener('stalled', onBuffering);
    }

    // Remote bindings for player
    AegisRemote.on(AegisRemote.KEY.CH_UP, () => {
      if (isActive()) { switchChannel(1); return true; }
    });
    AegisRemote.on(AegisRemote.KEY.CH_DOWN, () => {
      if (isActive()) { switchChannel(-1); return true; }
    });
    AegisRemote.on(AegisRemote.KEY.INFO, () => {
      if (isActive()) { toggleOverlay(); return true; }
    });
    AegisRemote.on(AegisRemote.KEY.ENTER, () => {
      if (isActive() && !overlayVisible) { showOverlay(); return true; }
    });
    AegisRemote.on(AegisRemote.KEY.YELLOW, () => {
      if (isActive() && currentChannel) {
        const isFav = AegisCache.toggleFavorite(currentChannel.id);
        AegisUI.showToast(isFav ? 'Adăugat la favorite' : 'Eliminat din favorite');
        return true;
      }
    });

    console.log('[Player] Initialized');
  }

  /**
   * Play a channel
   */
  function play(channel, allChannels) {
    if (!channel || !channel.stream) {
      console.error('[Player] No stream URL');
      return;
    }

    currentChannel = channel;
    if (allChannels) {
      channelList = allChannels;
      channelIndex = allChannels.findIndex(c => c.id === channel.id);
    }

    // Show player view
    dom.view.classList.add('active');
    showLoading(true);
    showError(false);

    // Update overlay info
    updateOverlayInfo(channel);

    // Add to recently watched
    AegisCache.addRecent(channel);

    // Destroy previous HLS instance
    destroyHLS();

    // Start stream
    const url = channel.stream;

    if (url.includes('.m3u8') && typeof Hls !== 'undefined' && Hls.isSupported()) {
      // Use HLS.js
      hls = new Hls({
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 30 * 1000 * 1000,  // 30MB
        startLevel: -1,                     // Auto quality
        capLevelToPlayerSize: true,
        lowLatencyMode: true,
        testBandwidth: true,
        progressive: true,
        enableWorker: false,  // Disable for webOS compatibility
      });

      hls.loadSource(url);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          handleFatalError(data);
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari, some webOS)
      videoEl.src = url;
      videoEl.play().catch(() => {});
    } else {
      // Direct video URL
      videoEl.src = url;
      videoEl.play().catch(() => {});
    }

    isPlaying = true;
    showOverlay();

    console.log(`[Player] Playing: ${channel.name} — ${url.slice(0, 80)}`);
  }

  /**
   * Stop playback
   */
  function stop() {
    destroyHLS();

    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }

    dom.view.classList.remove('active');
    isPlaying = false;
    currentChannel = null;
    hideOverlay();

    console.log('[Player] Stopped');
  }

  /**
   * Switch to next/previous channel
   */
  function switchChannel(direction) {
    if (channelList.length === 0) return;

    channelIndex += direction;
    if (channelIndex >= channelList.length) channelIndex = 0;
    if (channelIndex < 0) channelIndex = channelList.length - 1;

    const nextChannel = channelList[channelIndex];
    if (nextChannel) {
      play(nextChannel);
    }
  }

  /**
   * Update overlay info
   */
  function updateOverlayInfo(channel) {
    if (dom.channelName) dom.channelName.textContent = channel.name;
    if (dom.channelQuality) dom.channelQuality.textContent = channel.quality || 'HD';

    if (dom.channelLogo) {
      const raw = channel.logo || '';
      const base = typeof AegisAPI !== 'undefined' && AegisAPI.getBaseUrl ? AegisAPI.getBaseUrl() : '';
      let src = raw;
      if (raw && !/^https?:\/\//i.test(raw) && !raw.startsWith('data:') && base) {
        src = base + (raw.startsWith('/') ? raw : '/' + raw);
      }
      dom.channelLogo.style.display = '';
      dom.channelLogo.alt = channel.name || '';
      const letter = (channel.name || '?').trim().charAt(0).toUpperCase() || 'TV';
      const ph = 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect fill="#121212" width="120" height="80"/><text x="60" y="50" text-anchor="middle" fill="#C6A972" font-size="32" font-family="system-ui,sans-serif">${letter}</text></svg>`
      );
      dom.channelLogo.src = src || ph;
      dom.channelLogo.onerror = function() {
        this.onerror = null;
        this.src = ph;
      };
    }

    // EPG info
    if (channel.epg && channel.epg.now) {
      if (dom.epgNowTitle) dom.epgNowTitle.textContent = channel.epg.now.title || '';
      if (dom.epgNowTime) {
        const start = new Date(channel.epg.now.start).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        const stop = channel.epg.now.stop ? new Date(channel.epg.now.stop).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '';
        dom.epgNowTime.textContent = `${start} — ${stop}`;
      }

      // Progress
      if (dom.progress && channel.epg.now.startTimestamp && channel.epg.now.stopTimestamp) {
        const now = Date.now();
        const total = channel.epg.now.stopTimestamp - channel.epg.now.startTimestamp;
        const elapsed = now - channel.epg.now.startTimestamp;
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        dom.progress.style.width = pct + '%';
      }
    } else {
      if (dom.epgNowTitle) dom.epgNowTitle.textContent = 'Live';
      if (dom.epgNowTime) dom.epgNowTime.textContent = '';
      if (dom.progress) dom.progress.style.width = '0%';
    }

    if (channel.epg && channel.epg.next) {
      if (dom.epgNextTitle) dom.epgNextTitle.textContent = channel.epg.next.title || '';
    } else {
      if (dom.epgNextTitle) dom.epgNextTitle.textContent = '';
    }
  }

  /**
   * Show/hide overlay
   */
  function showOverlay() {
    dom.overlay.classList.add('visible');
    overlayVisible = true;
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(hideOverlay, 5000);
  }

  function hideOverlay() {
    dom.overlay.classList.remove('visible');
    overlayVisible = false;
    clearTimeout(overlayTimer);
  }

  function toggleOverlay() {
    if (overlayVisible) hideOverlay();
    else showOverlay();
  }

  /**
   * Loading state
   */
  function showLoading(show) {
    if (dom.loading) {
      dom.loading.classList.toggle('visible', show);
    }
  }

  /**
   * Error state
   */
  function showError(show, message) {
    if (dom.error) {
      dom.error.classList.toggle('visible', show);
      if (dom.errorText && message) dom.errorText.textContent = message;
    }
  }

  /**
   * Handle fatal HLS errors with auto-recovery
   */
  function handleFatalError(data) {
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        console.warn('[Player] Network error, attempting recovery...');
        if (hls) hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.warn('[Player] Media error, attempting recovery...');
        if (hls) hls.recoverMediaError();
        break;
      default:
        console.error('[Player] Fatal error:', data);
        showLoading(false);
        showError(true, 'Canal indisponibil');
        // Try alternate stream if available
        if (currentChannel && currentChannel.alternateStreams && currentChannel.alternateStreams.length > 0) {
          const alt = currentChannel.alternateStreams.shift();
          console.log('[Player] Trying alternate stream...');
          setTimeout(() => {
            currentChannel.stream = alt.url;
            play(currentChannel);
          }, 1000);
        }
        break;
    }
  }

  // Video event handlers
  function onPlaying() {
    showLoading(false);
    showError(false);
  }

  function onBuffering() {
    showLoading(true);
  }

  function onError() {
    showLoading(false);
    showError(true, 'Eroare redare');
  }

  /**
   * Destroy HLS instance cleanly
   */
  function destroyHLS() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  /**
   * Check if player is active
   */
  function isActive() {
    return dom.view && dom.view.classList.contains('active');
  }

  /**
   * Get current channel
   */
  function getCurrent() {
    return currentChannel;
  }

  return {
    init,
    play,
    stop,
    switchChannel,
    showOverlay,
    hideOverlay,
    isActive,
    getCurrent,
  };
})();
