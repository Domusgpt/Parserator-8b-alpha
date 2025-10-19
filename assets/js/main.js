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
