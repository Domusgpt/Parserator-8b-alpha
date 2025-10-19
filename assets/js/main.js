document.documentElement.classList.add('js');

const navToggle = document.querySelector('[data-mobile-toggle]');
const navLinks = document.querySelector('[data-nav-links]');

if (navToggle && navLinks) {
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

const yearSpan = document.querySelector('[data-current-year]');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear().toString();
}

const prefersReducedMotionQuery = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };
const prefersReducedMotion = prefersReducedMotionQuery.matches;

if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const revealElements = document.querySelectorAll('[data-reveal]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  revealElements.forEach((element) => {
    observer.observe(element);
  });
} else {
  document.querySelectorAll('[data-reveal]').forEach((element) => {
    element.classList.add('is-visible');
  });
}

if (!prefersReducedMotion) {
  const tiltElements = document.querySelectorAll('[data-tilt]');

  tiltElements.forEach((element) => {
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
      element.style.setProperty('--tilt-translate-z', '16px');
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

const navs = document.querySelectorAll('.site-nav');
if (navs.length) {
  const setNavState = () => {
    const offset = window.scrollY || document.documentElement.scrollTop;
    navs.forEach((element) => {
      element.classList.toggle('is-scrolled', offset > 24);
    });
  };

  setNavState();
  document.addEventListener('scroll', setNavState, { passive: true });
}

const usageButtons = document.querySelectorAll('[data-code-toggle]');
const usageHeading = document.querySelector('[data-copy-heading]');
const usageBody = document.querySelector('[data-copy-body]');
const usageList = document.querySelector('[data-usage-copy] .usage-list');
const usageCode = document.querySelector('[data-code-block] code');

if (usageButtons.length && usageHeading && usageBody && usageList && usageCode) {
  const usageConfig = {
    rest: {
      heading: 'Send JSON via REST',
      body:
        'POST the data you want parsed alongside your desired schema. Parserator replies with structured JSON plus metadata describing every extraction decision.',
      list: [
        'Include schema + raw text in a single call',
        'Confidence and token telemetry in the response',
        'Backed by 95% accuracy and ~2.2s latency'
      ],
      languageClass: 'language-bash',
      code: `curl -X POST "https://app-5108296280.us-central1.run.app/v1/parse" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer pk_live_your_api_key" \\
  -d '{
    "inputData": "Acme Co. Contract Signed 3/12/24",
    "outputSchema": {
      "company": "string",
      "event": "string",
      "date": "date"
    }
  }'`
    },
    node: {
      heading: 'Use the Node SDK',
      body:
        'Install the published SDK and call `parse` with your schema. The client manages retries, telemetry metadata, and confidence scoring out of the box.',
      list: [
        'npm package: parserator-sdk@1.0.0',
        'Architect → Extractor pipeline from Node',
        'Confidence and token telemetry in the response'
      ],
      languageClass: 'language-javascript',
      code: `npm install parserator-sdk

const { ParseratorClient } = require('parserator-sdk');

const client = new ParseratorClient({
  apiKey: 'pk_live_your_api_key_here'
});

const result = await client.parse({
  inputData: `John Smith\nSenior Developer\njohn@techcorp.com\n(555) 123-4567`,
  outputSchema: {
    name: 'string',
    title: 'string',
    email: 'email',
    phone: 'phone'
  }
});

console.log(result.parsedData);`
    }
  };

  usageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.codeToggle;
      const config = usageConfig[key];
      if (!config) return;

      usageButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn === button);
        btn.setAttribute('aria-selected', btn === button ? 'true' : 'false');
      });

      usageHeading.textContent = config.heading;
      usageBody.textContent = config.body;
      usageList.innerHTML = config.list.map((item) => `<li>${item}</li>`).join('');
      usageCode.className = config.languageClass;
      usageCode.textContent = config.code;
    });
  });
}

const variantPanel = document.querySelector('[data-variant-panel]');

if (variantPanel) {
  const cards = document.querySelectorAll('[data-variant-card]');
  const peekButtons = document.querySelectorAll('[data-variant-trigger]');
  const controls = variantPanel.querySelectorAll('[data-variant-control]');
  const title = variantPanel.querySelector('[data-variant-title]');
  const description = variantPanel.querySelector('[data-variant-description]');
  const highlights = variantPanel.querySelector('[data-variant-highlights]');
  const previewName = variantPanel.querySelector('[data-variant-name]');
  const primaryLink = variantPanel.querySelector('[data-variant-action="primary"]');
  const secondaryLink = variantPanel.querySelector('[data-variant-action="secondary"]');

  const variantCopy = {
    nebula: {
      name: 'Nebula Circuit',
      heading: 'Glassmorphic hero with a guided workflow',
      description:
        'Neon gradients, a looping product video, and sequential storytelling walk prospects through the Architect → Extractor pipeline with momentum proof at every scroll depth.',
      highlights: [
        'Hero pairs production video with telemetry-backed metrics and CTA set.',
        'Timeline explains plan caches, deterministic extractors, and lean fallbacks.',
        'Integration section ships REST versus Node SDK toggles for immediate adoption.'
      ],
      primary: 'variants/nebula/index.html',
      secondary: 'variants/nebula/index.html#overview'
    },
    aurora: {
      name: 'Aurora Panels',
      heading: 'Split-panel storytelling anchored by proof',
      description:
        'A dual-column hero locks in production metrics while frosted panels guide visitors from adoption evidence to integration code and EMA commitments.',
      highlights: [
        'Metric stack keeps accuracy, latency, and token savings visible at the top.',
        'Side-by-side integration tabs mirror the SDK and REST snippets from the docs.',
        'EMA guarantees sit beside Clear Seas links so compliance stays obvious.'
      ],
      primary: 'variants/aurora/index.html',
      secondary: 'variants/aurora/index.html#hero'
    },
    horizon: {
      name: 'Horizon Flow',
      heading: 'Process bands with lateral motion cues',
      description:
        'Wide format ribbons stage the story: why Parserator wins, how the workflow operates, and where to plug in, all while nav anchors stay persistent for quick evaluation.',
      highlights: [
        'Momentum proof rides inside a horizontal scroller with hover flourishes.',
        'Workflow band ties Architect decisions to Extractor checkpoints and lean fallbacks.',
        'Ecosystem ribbon links Parserator to Clear Seas, Nimbus, and Reposiologist touchpoints.'
      ],
      primary: 'variants/horizon/index.html',
      secondary: 'variants/horizon/index.html#hero'
    },
    quantum: {
      name: 'Quantum Grid',
      heading: 'Modular tiles ready for stakeholder review',
      description:
        'A dense grid arranges product value, technical workflow, integration routes, and EMA assurances into quick-scan cards ideal for sales, ops, and engineering teams.',
      highlights: [
        'Hero tiles emphasize production telemetry next to Architect → Extractor callouts.',
        'Usage tiles surface REST, Node SDK, and dashboard entry points with CTA focus.',
        'Footer navigation binds Parserator to the broader Clear Seas network for context.'
      ],
      primary: 'variants/quantum/index.html',
      secondary: 'variants/quantum/index.html#hero'
    }
  };

  const setActiveVariant = (key) => {
    const content = variantCopy[key];
    if (!content) return;

    variantPanel.dataset.activeVariant = key;

    controls.forEach((control) => {
      const isMatch = control.dataset.variantControl === key;
      control.classList.toggle('is-active', isMatch);
      control.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    cards.forEach((card) => {
      card.classList.toggle('is-active', card.dataset.variantCard === key);
    });

    if (title) {
      title.textContent = content.heading;
    }
    if (description) {
      description.textContent = content.description;
    }
    if (highlights) {
      highlights.innerHTML = content.highlights.map((item) => `<li>${item}</li>`).join('');
    }
    if (previewName) {
      previewName.textContent = content.name;
    }
    if (primaryLink) {
      primaryLink.href = content.primary;
    }
    if (secondaryLink) {
      secondaryLink.href = content.secondary;
    }
  };

  const defaultKey = variantPanel.dataset.activeVariant || 'nebula';
  setActiveVariant(defaultKey in variantCopy ? defaultKey : 'nebula');

  controls.forEach((control) => {
    control.addEventListener('click', () => {
      setActiveVariant(control.dataset.variantControl);
    });
  });

  cards.forEach((card) => {
    const key = card.dataset.variantCard;
    card.addEventListener('mouseenter', () => setActiveVariant(key));
    card.addEventListener('focusin', () => setActiveVariant(key));
  });

  peekButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveVariant(button.dataset.variantTrigger));
  });
}
