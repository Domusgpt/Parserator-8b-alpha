document.documentElement.classList.add('js');

const yearSpan = document.querySelector('[data-current-year]');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear().toString();
}

const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealElements = document.querySelectorAll('[data-reveal]');
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

  revealElements.forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'));
}

if (!reduceMotion) {
  const tiltElements = document.querySelectorAll('[data-tilt]');
  tiltElements.forEach((element) => {
    const maxTilt = element.dataset.tiltMax ? Number(element.dataset.tiltMax) : 7;

    const handleMove = (event) => {
      const rect = element.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateY = ((offsetX - centerX) / centerX) * maxTilt;
      const rotateX = ((centerY - offsetY) / centerY) * maxTilt;

      element.style.setProperty('transform', `perspective(1100px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`);
      element.classList.add('is-tilting');
    };

    const resetTilt = () => {
      element.style.setProperty('transform', 'perspective(1100px) rotateX(0deg) rotateY(0deg)');
      element.classList.remove('is-tilting');
    };

    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerleave', resetTilt);
    element.addEventListener('pointerup', resetTilt);
    element.addEventListener('blur', resetTilt);
  });
}

const metricButtons = document.querySelectorAll('[data-metric]');
const metricLabel = document.querySelector('[data-metric-label]');
const metricValue = document.querySelector('[data-metric-value]');

const METRICS = {
  accuracy: { label: 'Accuracy', value: '95% validated' },
  latency: { label: 'Latency', value: '~2.2s average response' },
  tokens: { label: 'Token savings', value: '≈70% vs. baseline prompting' },
  surfaces: { label: 'Surfaces', value: 'REST API · Node SDK · MCP' }
};

if (metricButtons.length && metricLabel && metricValue) {
  metricButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.metric;
      const config = METRICS[key];
      if (!config) return;

      metricButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
      metricLabel.textContent = config.label;
      metricValue.textContent = config.value;
    });
  });
}

const toggleButtons = document.querySelectorAll('[data-toggle]');
const copyHeading = document.querySelector('[data-copy-heading]');
const copyBody = document.querySelector('[data-copy-body]');
const copyList = document.querySelector('[data-copy-list]');
const codeBlock = document.querySelector('[data-code]');

const COPY = {
  rest: {
    heading: 'Send JSON via REST',
    body:
      'POST the data you want parsed alongside your desired schema. Parserator replies with structured JSON plus metadata describing every extraction decision.',
    list: [
      'Include schema + raw text in a single call',
      'Confidence and token telemetry in the response',
      'Backed by 95% accuracy and ~2.2s latency'
    ],
    language: 'language-bash',
    code: `curl -X POST "https://app-5108296280.us-central1.run.app/v1/parse" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer pk_live_your_api_key" \\
  -d '{\n    "inputData": "Acme Co. Contract Signed 3/12/24",\n    "outputSchema": {\n      "company": "string",\n      "event": "string",\n      "date": "date"\n    }\n  }'`
  },
  node: {
    heading: 'Use the Node SDK',
    body:
      'Install the published SDK and call `parse` with your schema. The client manages retries, telemetry metadata, and confidence scoring out of the box.',
    list: [
      'npm package: @parserator/node-sdk',
      'Architect → Extractor pipeline from Node',
      'Confidence and token telemetry in the response'
    ],
    language: 'language-javascript',
    code: `npm install @parserator/node-sdk\n\nconst { ParseratorClient } = require('@parserator/node-sdk');\n\nconst client = new ParseratorClient({\n  apiKey: 'pk_live_your_api_key_here'\n});\n\nconst result = await client.parse({\n  inputData: \`John Smith\\nSenior Developer\\njohn@techcorp.com\\n(555) 123-4567\`,\n  outputSchema: {\n    name: 'string',\n    title: 'string',\n    email: 'email',\n    phone: 'phone'\n  }\n});\n\nconsole.log(result.parsedData);`
  }
};

if (toggleButtons.length && copyHeading && copyBody && copyList && codeBlock) {
  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.toggle;
      const config = COPY[mode];
      if (!config) return;

      toggleButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn === button);
        btn.setAttribute('aria-selected', btn === button ? 'true' : 'false');
      });

      copyHeading.textContent = config.heading;
      copyBody.textContent = config.body;
      copyList.innerHTML = config.list.map((item) => `<li>${item}</li>`).join('');
      codeBlock.className = config.language;
      codeBlock.textContent = config.code;
    });
  });
}
