// Patch Tag: LB-ICON-LITE-20260715A — Local icon renderer replacing external Lucide dependency.
(function initLazybacktestIcons(global) {
  const ICON_LIBRARY = Object.freeze({
    default: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path>',
    zap: '<polyline points="13 2 3 14 10 14 9 22 21 8 14 8 15 2"></polyline>',
    sparkles:
      '<path d="M12 5v4M12 15v4M5 12h4M15 12h4"></path>' +
      '<path d="M7.5 7.5l2 2M14.5 14.5l2 2M7.5 16.5l2-2M14.5 9.5l2-2"></path>',
    wrench: '<path d="M16 3a5 5 0 0 0-5.6 6.6L4 16v4l4-4 6.4-6.4A5 5 0 0 0 16 3z"></path>',
    settings:
      '<circle cx="12" cy="12" r="3"></circle>' +
      '<path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.5 6.5l1.4 1.4M16.1 16.1l1.4 1.4M6.5 17.5l1.4-1.4M16.1 7.9l1.4-1.4"></path>',
    sliders:
      '<line x1="4" y1="8" x2="20" y2="8"></line>' +
      '<line x1="4" y1="16" x2="20" y2="16"></line>' +
      '<circle cx="10" cy="8" r="2.5"></circle>' +
      '<circle cx="14" cy="16" r="2.5"></circle>',
    radar:
      '<circle cx="12" cy="12" r="9"></circle>' +
      '<circle cx="12" cy="12" r="4"></circle>' +
      '<path d="M12 12l6-6"></path><path d="M12 12h8"></path>',
    bug:
      '<circle cx="12" cy="12" r="4"></circle>' +
      '<path d="M12 8V4"></path><path d="M12 16v4"></path>' +
      '<path d="M4 12h4"></path><path d="M16 12h4"></path>' +
      '<path d="M5 8l3 2"></path><path d="M19 8l-3 2"></path>' +
      '<path d="M5 16l3-2"></path><path d="M19 16l-3-2"></path>',
    layers:
      '<path d="M12 4l9 4-9 4-9-4 9-4z"></path>' +
      '<path d="M3 12l9 4 9-4"></path>' +
      '<path d="M3 16l9 4 9-4"></path>',
    terminal:
      '<rect x="3" y="5" width="18" height="14" rx="2"></rect>' +
      '<path d="M7 9l3 3-3 3"></path>' +
      '<line x1="12" y1="15" x2="17" y2="15"></line>',
    message: '<rect x="3" y="6" width="18" height="12" rx="2"></rect><line x1="12" y1="9" x2="12" y2="13"></line><circle cx="12" cy="15.5" r="0.8"></circle>',
    database:
      '<ellipse cx="12" cy="6" rx="8" ry="3"></ellipse>' +
      '<path d="M4 6v8c0 2 3.6 3 8 3s8-1 8-3V6"></path>' +
      '<path d="M4 10c0 2 3.6 3 8 3s8-1 8-3"></path>',
    chartUp: '<path d="M4 19h16"></path><polyline points="5 15 10 10 13 13 19 7"></polyline>',
    chartDown: '<path d="M4 19h16"></path><polyline points="5 9 10 14 13 11 19 17"></polyline>',
    shield: '<path d="M12 3l7 4v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7z"></path>',
    target:
      '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle>' +
      '<line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line>' +
      '<line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line>',
    arrowUpCircle: '<circle cx="12" cy="12" r="9"></circle><polyline points="8 13 12 9 16 13"></polyline><line x1="12" y1="9" x2="12" y2="17"></line>',
    arrowDownCircle: '<circle cx="12" cy="12" r="9"></circle><polyline points="8 11 12 15 16 11"></polyline><line x1="12" y1="7" x2="12" y2="15"></line>',
    arrowDown: '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="6 13 12 19 18 13"></polyline>',
    arrowRightLeft: '<polyline points="7 8 3 12 7 16"></polyline><polyline points="17 8 21 12 17 16"></polyline><line x1="3" y1="12" x2="21" y2="12"></line>',
    fileText:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
      '<polyline points="14 2 14 8 20 8"></polyline>' +
      '<line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line>',
    clipboard:
      '<path d="M8 4h8l1 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3z"></path>' +
      '<rect x="9" y="2" width="6" height="4" rx="1"></rect>' +
      '<line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line>',
    save:
      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>' +
      '<polyline points="17 21 17 13 7 13 7 21"></polyline>' +
      '<polyline points="7 3 7 9 13 9"></polyline>',
    folderOpen:
      '<path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>' +
      '<path d="M3 7l2-3h5l2 2h9"></path>',
    trash:
      '<polyline points="3 6 5 6 21 6"></polyline>' +
      '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
      '<path d="M10 11v6"></path><path d="M14 11v6"></path>' +
      '<path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>',
    lightbulb:
      '<path d="M9 18h6"></path><path d="M10 22h4"></path>' +
      '<path d="M12 2a6 6 0 0 0-4 10.4V15h8v-2.6A6 6 0 0 0 12 2z"></path>',
    play: '<polygon points="9 7 9 17 17 12"></polygon>',
    playCircle: '<circle cx="12" cy="12" r="9"></circle><polygon points="10 8 10 16 16 12"></polygon>',
    refresh:
      '<polyline points="3 10 3 4 9 4"></polyline><polyline points="21 14 21 20 15 20"></polyline>' +
      '<path d="M5 12a7 7 0 0 1 12-5l2 2"></path>' +
      '<path d="M19 12a7 7 0 0 1-12 5l-2-2"></path>',
    repeat:
      '<polyline points="17 3 21 7 17 11"></polyline><polyline points="7 21 3 17 7 13"></polyline>' +
      '<path d="M21 7H9a4 4 0 0 0-4 4v2"></path>' +
      '<path d="M3 17h12a4 4 0 0 0 4-4v-2"></path>',
    rocket:
      '<path d="M5 19l4-1 7-7a3 3 0 0 0-4-4L5 15z"></path>' +
      '<path d="M9 5l2-2 5 5-2 2"></path>' +
      '<path d="M4 13l-1 6 6-1"></path>',
    square: '<rect x="4" y="4" width="16" height="16" rx="2"></rect>',
    hourglass: '<path d="M6 2h12"></path><path d="M6 22h12"></path><path d="M6 2l6 7 6-7"></path><path d="M6 22l6-7 6 7"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline>',
    cpu:
      '<rect x="4" y="4" width="16" height="16" rx="2"></rect>' +
      '<rect x="9" y="9" width="6" height="6" rx="1"></rect>' +
      '<line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line>' +
      '<line x1="6" y1="2" x2="6" y2="4"></line><line x1="18" y1="2" x2="18" y2="4"></line>' +
      '<line x1="6" y1="20" x2="6" y2="22"></line><line x1="18" y1="20" x2="18" y2="22"></line>' +
      '<line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line>',
    gauge: '<path d="M21 15a9 9 0 1 0-18 0"></path><path d="M12 12l4-4"></path><circle cx="12" cy="12" r="1"></circle>',
    download: '<path d="M12 3v12"></path><polyline points="7 11 12 16 17 11"></polyline><rect x="4" y="19" width="16" height="2"></rect>',
    loader: '<circle cx="12" cy="12" r="9" stroke-dasharray="56 20"></circle>',
    brain:
      '<path d="M8 3a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4v2a2 2 0 0 0 4 0v-2"></path>' +
      '<path d="M12 3a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4"></path>' +
      '<path d="M10 8h2v4h2"></path><circle cx="9" cy="9" r="0.8"></circle><circle cx="15" cy="13" r="0.8"></circle>',
    users:
      '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>' +
      '<circle cx="9" cy="7" r="4"></circle>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    layout: '<rect x="3" y="3" width="8" height="8" rx="1"></rect><rect x="13" y="3" width="8" height="5" rx="1"></rect><rect x="13" y="10" width="8" height="11" rx="1"></rect><rect x="3" y="13" width="8" height="8" rx="1"></rect>'
  });

  const ICON_ALIASES = Object.freeze({
    'sparkles': 'sparkles',
    'wand-2': 'sparkles',
    'wrench': 'wrench',
    'settings': 'settings',
    'sliders-horizontal': 'sliders',
    'radar': 'radar',
    'bug': 'bug',
    'layers': 'layers',
    'terminal-square': 'terminal',
    'message-square-warning': 'message',
    'database': 'database',
    'bar-chart-3': 'chartUp',
    'line-chart': 'chartUp',
    'trending-up': 'chartUp',
    'trending-down': 'chartDown',
    'shield': 'shield',
    'target': 'target',
    'arrow-up-circle': 'arrowUpCircle',
    'arrow-down-circle': 'arrowDownCircle',
    'arrow-down': 'arrowDown',
    'arrow-right-left': 'arrowRightLeft',
    'file-text': 'fileText',
    'clipboard-list': 'clipboard',
    'receipt': 'clipboard',
    'save': 'save',
    'folder-open': 'folderOpen',
    'trash-2': 'trash',
    'lightbulb': 'lightbulb',
    'play': 'play',
    'play-circle': 'playCircle',
    'refresh-cw': 'refresh',
    'repeat': 'repeat',
    'rocket': 'rocket',
    'square': 'square',
    'hourglass': 'hourglass',
    'clock': 'clock',
    'cpu': 'cpu',
    'gauge': 'gauge',
    'download': 'download',
    'loader': 'loader',
    'loader-2': 'loader',
    'brain-circuit': 'brain',
    'users': 'users',
    'layout-dashboard': 'layout',
    'sparkles-alt': 'sparkles',
    'zap': 'zap'
  });

  function resolveIconKey(rawName) {
    const key = String(rawName || '').trim().toLowerCase();
    if (ICON_LIBRARY[key]) {
      return key;
    }
    return ICON_ALIASES[key] || 'default';
  }

  function buildSvgMarkup(definition) {
    const body = ICON_LIBRARY[definition] || ICON_LIBRARY.default;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${body}</svg>`;
  }

  function renderIconElement(element) {
    if (!element || element.dataset.lbIconBound === 'true') {
      return;
    }
    const rawName = element.getAttribute('data-lucide');
    const iconKey = resolveIconKey(rawName);
    element.innerHTML = buildSvgMarkup(iconKey);
    element.classList.add('lb-icon');
    if (!element.hasAttribute('role')) {
      element.setAttribute('role', 'img');
    }
    if (!element.hasAttribute('aria-label') && typeof rawName === 'string') {
      element.setAttribute('aria-label', rawName.replace(/[-_]/g, ' '));
    }
    element.dataset.lbIconBound = 'true';
  }

  function createIcons(root) {
    const scope = root && root.querySelectorAll ? root : global.document;
    if (!scope || !scope.querySelectorAll) {
      return;
    }
    const nodes = scope.querySelectorAll('[data-lucide]');
    nodes.forEach((node) => renderIconElement(node));
  }

  const lucideShim = {
    createIcons,
    renderIcon: renderIconElement,
    version: 'LB-ICON-LITE-20260715A'
  };

  if (global.document && global.document.readyState !== 'loading') {
    createIcons(global.document);
  } else if (global.document) {
    global.document.addEventListener('DOMContentLoaded', () => createIcons(global.document));
  }

  global.lucide = lucideShim;
})(typeof window !== 'undefined' ? window : self);
