(function () {
  const root = document.documentElement;
  root.classList.add('js');

  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  function initMobileNav(scope = document) {
    const navToggle = scope.querySelector('[data-mobile-toggle]');
    const navLinks = scope.querySelector('[data-nav-links]');

    if (!navToggle || !navLinks) return;

    navToggle.addEventListener('click', () => {
      const expanded = navLinks.getAttribute('aria-expanded') === 'true';
      navLinks.setAttribute('aria-expanded', (!expanded).toString());
      navToggle.setAttribute('aria-expanded', (!expanded).toString());
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 840) {
          navLinks.setAttribute('aria-expanded', 'false');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  function initCurrentYear(scope = document) {
    const target = scope.querySelector('[data-current-year]');
    if (target) {
      target.textContent = new Date().getFullYear().toString();
    }
  }

  function initReveal(scope = document) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      scope.querySelectorAll('[data-reveal]').forEach((element) => {
        element.classList.add('is-visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    scope.querySelectorAll('[data-reveal]').forEach((element) => {
      observer.observe(element);
    });
  }

  function initTilt(scope = document) {
    if (prefersReducedMotion) return;

    scope.querySelectorAll('[data-tilt]').forEach((element) => {
      const maxTilt = element.dataset.tiltMax ? Number(element.dataset.tiltMax) : 8;

      const handleMove = (event) => {
        const rect = element.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateY = ((offsetX - centerX) / centerX) * maxTilt;
        const rotateX = ((centerY - offsetY) / centerY) * maxTilt;

        element.style.setProperty('--tilt-rotate-x', `${rotateY.toFixed(2)}deg`);
        element.style.setProperty('--tilt-rotate-y', `${rotateX.toFixed(2)}deg`);
        element.style.setProperty('--tilt-translate-z', '18px');
        element.classList.add('is-tilting');
      };

      const resetTilt = () => {
        element.style.setProperty('--tilt-rotate-x', '0deg');
        element.style.setProperty('--tilt-rotate-y', '0deg');
        element.style.setProperty('--tilt-translate-z', '0px');
        element.classList.remove('is-tilting');
      };

      element.addEventListener('pointermove', handleMove);
      element.addEventListener('pointerleave', resetTilt);
      element.addEventListener('pointerup', resetTilt);
      element.addEventListener('blur', resetTilt);
      element.addEventListener('focus', () => {
        element.style.setProperty('--tilt-translate-z', '12px');
      });
    });
  }

  function initCodeTabs({
    buttons,
    heading,
    body,
    list,
    code,
    config,
  }) {
    if (!buttons || !buttons.length || !heading || !body || !list || !code || !config) {
      return;
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.codeToggle;
        const definition = config[key];
        if (!definition) return;

        buttons.forEach((btn) => {
          const isActive = btn === button;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        heading.textContent = definition.heading;
        body.textContent = definition.body;
        list.innerHTML = definition.list.map((item) => `<li>${item}</li>`).join('');
        code.className = definition.languageClass;
        code.textContent = definition.code;
      });
    });
  }

  window.ParseratorCommon = {
    initCore(options = {}) {
      const { scope = document, enableReveal = true, enableTilt = true } = options;
      initMobileNav(scope);
      initCurrentYear(scope);
      if (enableReveal) initReveal(scope);
      if (enableTilt) initTilt(scope);
    },
    initCodeTabs,
  };
})();
