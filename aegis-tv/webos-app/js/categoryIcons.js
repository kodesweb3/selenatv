/**
 * Pictograme SVG premium (fără emoji) — linii aurii pe fundal închis
 */
const CategoryIcons = (function() {
  'use strict';

  const stroke = '#C6A972';
  const dim = '0 0 56 56';

  function wrap(pathInner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${dim}" fill="none" aria-hidden="true"><g stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathInner}</g></svg>`;
  }

  const icons = {
    'Știri': wrap('<circle cx="28" cy="28" r="18"/><path d="M20 22h16v12H20z"/><path d="M24 26h8M24 30h6"/>'),
    'Info': wrap('<circle cx="28" cy="28" r="18"/><path d="M28 20v4M28 32v4"/><circle cx="28" cy="38" r="1.5" fill="' + stroke + '"/>'),
    'Sport': wrap('<circle cx="28" cy="28" r="18"/><circle cx="28" cy="28" r="8"/><path d="M28 12v6M28 38v6M12 28h6M38 28h6"/>'),
    'Filme': wrap('<rect x="16" y="18" width="24" height="20" rx="2"/><path d="M22 18v20M34 18v20"/>'),
    'Documentare': wrap('<circle cx="28" cy="28" r="18"/><ellipse cx="28" cy="28" rx="10" ry="6"/><path d="M18 28h20"/>'),
    'Istorie': wrap('<path d="M28 14l14 8v12l-14 8-14-8V22z"/><path d="M28 22v12M21 26l7 4 7-4"/>'),
    'Știință și natură': wrap('<circle cx="28" cy="28" r="6"/><path d="M28 10v8M28 38v8M10 28h8M38 28h8"/><path d="M16 16l6 6M34 34l-6-6M40 16l-6 6M22 34l6-6"/>'),
    'Muzică': wrap('<circle cx="22" cy="34" r="5"/><circle cx="38" cy="30" r="5"/><path d="M27 34V18M43 30V14"/>'),
    'Copii': wrap('<circle cx="28" cy="30" r="10"/><circle cx="28" cy="20" r="6"/><path d="M22 42c2 4 14 4 16 0"/>'),
    'Lifestyle': wrap('<path d="M28 12l8 8-8 16-8-16z"/><path d="M20 36h16"/>'),
    'Regional': wrap('<path d="M14 40V22l14-8 14 8v18"/><path d="M22 26l6 4 6-4"/>'),
    'General': wrap('<rect x="14" y="16" width="28" height="24" rx="3"/><path d="M20 22h16M20 28h12"/>'),
    '4K': wrap('<rect x="14" y="14" width="28" height="28" rx="4"/><path d="M22 30l6-12 6 12M24 26h8"/>'),
    'Ultra HD': wrap('<rect x="14" y="14" width="28" height="28" rx="4"/><path d="M22 30l6-12 6 12M24 26h8"/>'),
  };

  function svgForCategory(name) {
    if (!name) return icons['General'];
    if (icons[name]) return icons[name];
    const n = String(name);
    if (/4k|uhd|ultra/i.test(n)) return icons['4K'] || icons['General'];
    return icons['General'];
  }

  return { svgForCategory };
})();
