/**
 * AegisTV — Spatial Navigation Engine
 * Grid/list navigation for TV remote control
 */

const AegisNav = (function() {
  'use strict';

  // Navigation zones — each zone has focusable items
  const zones = {};
  let currentZone = null;
  let currentIndex = 0;
  let onFocusChange = null;
  let onSelect = null;
  let onBack = null;

  function clearZones() {
    Object.keys(zones).forEach((k) => delete zones[k]);
    currentZone = null;
    currentIndex = 0;
  }

  /**
   * Register a navigation zone
   * @param {string} name - Zone identifier
   * @param {object} config - { selector, columns, loop, onFocus, onSelect }
   */
  function registerZone(name, config) {
    zones[name] = {
      selector: config.selector,
      columns: config.columns || 1,
      loop: config.loop !== false,
      onFocus: config.onFocus || null,
      onSelect: config.onSelect || null,
      onBack: config.onBack || null,
      parent: config.parent || null,
    };
  }

  /**
   * Set the active zone
   */
  function setZone(name, startIndex) {
    const zone = zones[name];
    if (!zone) return;

    // Unfocus current
    unfocusCurrent();

    currentZone = name;
    currentIndex = startIndex || 0;

    // Focus first item
    focusCurrent();
  }

  /**
   * Get focusable items in current zone
   */
  function getItems() {
    if (!currentZone || !zones[currentZone]) return [];
    return Array.from(document.querySelectorAll(zones[currentZone].selector));
  }

  /**
   * Focus current item
   */
  function focusCurrent() {
    const items = getItems();
    if (items.length === 0) return;

    // Clamp index
    currentIndex = Math.max(0, Math.min(currentIndex, items.length - 1));

    const item = items[currentIndex];
    if (!item) return;

    // Add focused class
    item.classList.add('focused');

    // Scroll into view
    ensureVisible(item);

    // Callback
    const zone = zones[currentZone];
    if (zone && zone.onFocus) {
      zone.onFocus(item, currentIndex);
    }
    if (onFocusChange) {
      onFocusChange(item, currentIndex, currentZone);
    }
  }

  /**
   * Unfocus current item
   */
  function unfocusCurrent() {
    const items = getItems();
    items.forEach(item => item.classList.remove('focused'));
  }

  /**
   * Navigate in a direction
   */
  function navigate(direction) {
    const zone = zones[currentZone];
    if (!zone) return;

    const items = getItems();
    if (items.length === 0) return;

    const cols = zone.columns;
    const total = items.length;
    let newIndex = currentIndex;

    switch (direction) {
      case 'left':
        if (cols === 1) return; // Vertical list, no horizontal movement
        newIndex = currentIndex - 1;
        if (newIndex < 0) newIndex = zone.loop ? total - 1 : 0;
        break;

      case 'right':
        if (cols === 1) return;
        newIndex = currentIndex + 1;
        if (newIndex >= total) newIndex = zone.loop ? 0 : total - 1;
        break;

      case 'up':
        if (cols === 1) {
          newIndex = currentIndex - 1;
        } else {
          newIndex = currentIndex - cols;
        }
        if (newIndex < 0) newIndex = zone.loop ? total + newIndex : 0;
        break;

      case 'down':
        if (cols === 1) {
          newIndex = currentIndex + 1;
        } else {
          newIndex = currentIndex + cols;
        }
        if (newIndex >= total) newIndex = zone.loop ? newIndex - total : total - 1;
        break;
    }

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < total) {
      unfocusCurrent();
      currentIndex = newIndex;
      focusCurrent();
    }
  }

  /**
   * Select current item
   */
  function select() {
    const zone = zones[currentZone];
    if (!zone) return;

    const items = getItems();
    const item = items[currentIndex];
    if (!item) return;

    if (zone.onSelect) {
      zone.onSelect(item, currentIndex);
    }
    if (onSelect) {
      onSelect(item, currentIndex, currentZone);
    }
  }

  /**
   * Go back
   */
  function back() {
    const zone = zones[currentZone];
    if (zone && zone.onBack) {
      zone.onBack();
      return;
    }
    if (zone && zone.parent) {
      setZone(zone.parent);
      return;
    }
    if (onBack) {
      onBack(currentZone);
    }
  }

  /**
   * Ensure focused element is visible in its scroll container
   */
  function ensureVisible(element) {
    if (!element) return;

    const scrollParent = findScrollParent(element);
    if (scrollParent) {
      const scrollRect = scrollParent.getBoundingClientRect();
      const elemRect = element.getBoundingClientRect();

      // Horizontal scroll (ex. rânduri orizontale)
      if (elemRect.right > scrollRect.right) {
        scrollParent.scrollLeft += elemRect.right - scrollRect.right + 40;
      } else if (elemRect.left < scrollRect.left) {
        scrollParent.scrollLeft -= scrollRect.left - elemRect.left + 40;
      }

      // Vertical scroll în ancestor direct
      if (elemRect.bottom > scrollRect.bottom) {
        scrollParent.scrollTop += elemRect.bottom - scrollRect.bottom + 40;
      } else if (elemRect.top < scrollRect.top) {
        scrollParent.scrollTop -= scrollRect.top - elemRect.top + 40;
      }
    }

    // Zona principală de defilare (webOS): cardurile pot sta într-un părinte doar cu overflow-x,
    // deci forțăm și alinierea în #main-content.
    const main = document.getElementById('main-content');
    if (main && main.contains(element)) {
      const mr = main.getBoundingClientRect();
      const er = element.getBoundingClientRect();
      const pad = 48;
      if (er.bottom > mr.bottom - pad) {
        main.scrollTop += er.bottom - mr.bottom + pad;
      } else if (er.top < mr.top + pad) {
        main.scrollTop -= mr.top - er.top + pad;
      }
    }
  }

  /**
   * Find scrollable parent
   */
  function findScrollParent(element) {
    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (style.overflow === 'auto' || style.overflow === 'scroll' ||
          style.overflowX === 'auto' || style.overflowX === 'scroll' ||
          style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  /**
   * Get current state
   */
  function getState() {
    return { zone: currentZone, index: currentIndex };
  }

  /**
   * Set global callbacks
   */
  function setCallbacks(callbacks) {
    if (callbacks.onFocusChange) onFocusChange = callbacks.onFocusChange;
    if (callbacks.onSelect) onSelect = callbacks.onSelect;
    if (callbacks.onBack) onBack = callbacks.onBack;
  }

  function isSearchInputFocused() {
    const ae = document.activeElement;
    return !!(ae && ae.classList && ae.classList.contains('top-bar-search'));
  }

  /**
   * Initialize with remote control bindings
   */
  function init() {
    AegisRemote.on(AegisRemote.KEY.LEFT, () => {
      if (isSearchInputFocused()) return false;
      navigate('left');
      return true;
    });
    AegisRemote.on(AegisRemote.KEY.RIGHT, () => {
      if (isSearchInputFocused()) return false;
      navigate('right');
      return true;
    });
    AegisRemote.on(AegisRemote.KEY.UP, () => {
      if (isSearchInputFocused()) return false;
      navigate('up');
      return true;
    });
    AegisRemote.on(AegisRemote.KEY.DOWN, () => {
      if (isSearchInputFocused()) return false;
      navigate('down');
      return true;
    });
    AegisRemote.on(AegisRemote.KEY.ENTER, () => {
      if (isSearchInputFocused()) return false;
      select();
      return true;
    });
    AegisRemote.on([AegisRemote.KEY.BACK, AegisRemote.KEY.BACK_ALT, AegisRemote.KEY.BACK_WEBOS2], () => { back(); return true; });

    console.log('[Nav] Spatial navigation initialized');
  }

  return {
    registerZone,
    clearZones,
    setZone,
    navigate,
    select,
    back,
    getItems,
    getState,
    setCallbacks,
    init,
  };
})();
