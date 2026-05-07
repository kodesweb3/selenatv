/**
 * AegisTV — Remote Control Handler
 * Optimized for LG webOS Magic Remote and standard remote
 */

const AegisRemote = (function() {
  'use strict';

  // webOS key codes
  const KEY = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK: 461,       // webOS Back button
    BACK_ALT: 8,     // Backspace (browser fallback)
    BACK_WEBOS2: 10009, // unele firmware-uri webOS
    EXIT: 27,         // ESC / Exit
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    CH_UP: 33,        // Page Up / Channel Up
    CH_DOWN: 34,      // Page Down / Channel Down
    INFO: 457,
    GUIDE: 458,
    NUM_0: 48,
    NUM_1: 49,
    NUM_2: 50,
    NUM_3: 51,
    NUM_4: 52,
    NUM_5: 53,
    NUM_6: 54,
    NUM_7: 55,
    NUM_8: 56,
    NUM_9: 57,
  };

  // Registered handlers
  const handlers = {};
  let enabled = true;

  /**
   * Register a key handler
   * handler(keyCode, event) => boolean (return true to prevent default)
   */
  function on(keyOrKeys, handler) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    for (const key of keys) {
      if (!handlers[key]) handlers[key] = [];
      handlers[key].push(handler);
    }
  }

  /**
   * Remove a specific handler
   */
  function off(keyOrKeys, handler) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    for (const key of keys) {
      if (handlers[key]) {
        handlers[key] = handlers[key].filter(h => h !== handler);
      }
    }
  }

  /**
   * Remove all handlers for a key
   */
  function offAll(key) {
    if (key) {
      delete handlers[key];
    } else {
      Object.keys(handlers).forEach(k => delete handlers[k]);
    }
  }

  /**
   * Enable/disable remote handling
   */
  function setEnabled(state) {
    enabled = state;
  }

  /**
   * Initialize key listener
   */
  function init() {
    document.addEventListener('keydown', function(e) {
      if (!enabled) return;

      const keyCode = e.keyCode || e.which;
      const ae = document.activeElement;
      const typingInSearch = ae && ae.classList && ae.classList.contains('top-bar-search');

      if (typingInSearch) {
        if ([KEY.BACK, KEY.BACK_ALT, KEY.BACK_WEBOS2].includes(keyCode)) {
          ae.blur();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        return;
      }

      const keyHandlers = handlers[keyCode];

      if (keyHandlers && keyHandlers.length > 0) {
        // Execute handlers in reverse order (last registered = highest priority)
        for (let i = keyHandlers.length - 1; i >= 0; i--) {
          const result = keyHandlers[i](keyCode, e);
          if (result === true) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      // Prevent default browser behavior for navigation keys
      if ([KEY.UP, KEY.DOWN, KEY.LEFT, KEY.RIGHT, KEY.ENTER, KEY.BACK, KEY.BACK_ALT, KEY.BACK_WEBOS2].includes(keyCode)) {
        e.preventDefault();
      }
    }, true);

    console.log('[Remote] Initialized LG remote handler');
  }

  return {
    KEY,
    on,
    off,
    offAll,
    setEnabled,
    init,
  };
})();
