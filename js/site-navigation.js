// Version: LB-STATIC-PAGES-20240709A
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  }

  ready(function () {
    const toggle = document.querySelector('[data-mobile-nav-toggle]');
    const menu = document.querySelector('[data-mobile-nav]');

    if (!toggle || !menu) return;

    const toggleMenu = function () {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      const nextExpanded = !expanded;
      toggle.setAttribute('aria-expanded', String(nextExpanded));
      if (nextExpanded) {
        menu.classList.remove('hidden');
      } else {
        menu.classList.add('hidden');
      }
    };

    toggle.addEventListener('click', function () {
      toggleMenu();
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 767px)').matches) {
          toggle.setAttribute('aria-expanded', 'false');
          menu.classList.add('hidden');
        }
      });
    });
  });
})();
