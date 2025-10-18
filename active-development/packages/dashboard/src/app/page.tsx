import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Workflow,
  ShieldCheck,
  Cpu,
  Waves,
  LineChart,
  Compass,
  ExternalLink,
  Orbit,
  LayoutGrid,
  Users,
  BookOpen
} from 'lucide-react';

const stats = [
  { label: '95% accuracy on production runs', value: '95%', accent: 'Operational today' },
  { label: '70% lower token spend via Architect→Extractor pipeline', value: '70%', accent: 'Cost savings' },
  { label: '2.2s average parse time at scale', value: '2.2s', accent: 'Median latency' },
];

const featureCards = [
  {
    title: 'Architected for agents',
    description:
      'ParseratorCore exposes plan caching, telemetry streams, and session helpers so Claude agents, automations, and dashboards stay in sync.',
    icon: Workflow,
    highlight: 'Agent-first orchestration',
  },
  {
    title: 'Swap anything, leave anytime',
    description:
      'Every resolver, architect, and extractor can be swapped at runtime. EMA promises portability so teams retain full control over their data flows.',
    icon: ShieldCheck,
    highlight: 'EMA aligned',
  },
  {
    title: 'Instrumented from day one',
    description:
      'Telemetry surfaces plan rewrites, fallback usage, and queue health. Operators get the same view as the dashboard and SDKs.',
    icon: LineChart,
    highlight: 'Transparent operations',
  },
  {
    title: 'SDKs, API, & extensions',
    description:
      'Production Firebase API, Node SDK, MCP adapter, and Chrome extension ship together so developers can integrate however they prefer.',
    icon: LayoutGrid,
    highlight: 'Unified ecosystem',
  },
];

const architecture = [
  {
    step: 'Stage 1 · The Architect',
    icon: Cpu,
    summary:
      'Gemini 1.5 Flash analyzes a small sample and your schema to produce a SearchPlan. Plans are cached, portable, and observable.',
    details: [
      'Low-token planning with reusable sessions',
      'Schema + instructions + heuristics blended together',
      'Architect telemetry streamed for downstream agents',
    ],
  },
  {
    step: 'Stage 2 · The Extractor',
    icon: Waves,
    summary:
      'The Extractor executes on full data using the plan. Lean fallback resolvers catch edge cases while respecting guardrails.',
    details: [
      'Batch parses inherit cached plans automatically',
      'Pre/post processors normalize messy transcripts',
      'Lean LLM fallbacks gated by confidence thresholds',
    ],
  },
];

const emaPillars = [
  {
    title: 'Freedom to leave',
    description:
      'Export SearchPlans, snapshots, and raw data at any time. Parserator documents every exit so teams remain sovereign.',
  },
  {
    title: 'Visible decision making',
    description:
      'Stage metrics, cooldowns, and fallback signals are exposed through the API, dashboard, and telemetry hubs—no hidden orchestration.',
  },
  {
    title: 'Community over lock-in',
    description:
      'EMA whitepaper sets the movement tone: sustainability, agency, and shared stewardship across Nimbus Guardian, Reposiologist, and Parserator.',
  },
];

const ecosystem = [
  {
    name: 'Nimbus Guardian',
    description: 'Protect your sensor grids and streaming agents with the same liberation-first principles.',
    href: 'https://nimbus-guardian.web.app/',
    logo: '/guardian-beacon.svg',
    cta: 'Visit Nimbus Guardian',
  },
  {
    name: 'Reposiologist',
    description: 'Research-grade repository intelligence with card-bending navigation and transparent insights.',
    href: 'https://reposiologist-beta.web.app/',
    logo: '/reposiologist-glyph.svg',
    cta: 'Explore Reposiologist',
    mirrored: true,
  },
  {
    name: 'Clear Seas HQ',
    description: 'Parent initiative aligning every launch under the Clear Seas movement. Dive into the charter and shared values.',
    href: 'https://domusgpt.github.io/ClearSeas-Enhanced/',
    logo: '/clear-seas-logo.svg',
    cta: 'Enter Clear Seas',
  },
];

const readiness = [
  {
    title: 'Production systems live',
    content:
      'API, dashboard, authentication, and telemetry are in production with validated accuracy and latency benchmarks.',
    proof: 'Live API & dashboard verified in June 2025 audit.',
  },
  {
    title: 'Launch materials complete',
    content:
      'Marketing campaigns, social narratives, and integration guides are written. Only polish and alignment remain.',
    proof: '104 marketing assets ready alongside EMA storytelling.',
  },
  {
    title: 'Immediate fixes tracked',
    content:
      'Domain redirect, Chrome extension submission, and Workspace email configuration are the only remaining blockers.',
    proof: 'Documented in DOMAIN_REDIRECT_FIX.md and launch checklist.',
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="background-grid" aria-hidden="true"></div>
      <div className="background-glow" aria-hidden="true"></div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center space-x-3 transition-transform hover:-translate-y-0.5">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-lg shadow-sky-500/30">
              <Image src="/parserator-logo.svg" alt="Parserator" width={28} height={28} className="h-7 w-7" priority />
            </span>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-200/70">Parserator</p>
              <p className="-mt-1 text-lg font-semibold text-white">Wide Market Autonomy</p>
            </div>
          </Link>
          <nav className="hidden items-center space-x-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#architecture" className="nav-link">Product</a>
            <a href="#features" className="nav-link">Capabilities</a>
            <a href="#ema" className="nav-link">EMA Movement</a>
            <a href="#ecosystem" className="nav-link">Ecosystem</a>
            <a href="#readiness" className="nav-link">Readiness</a>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="btn-glow">
              Launch Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="https://parserator-production.web.app/docs.html"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400/40 hover:text-white"
            >
              View Docs
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 pb-24">
        <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28 lg:pt-24">
          <div className="space-y-10">
            <div className="inline-flex items-center space-x-3 rounded-full border border-white/10 bg-slate-900/60 px-5 py-2 text-sm text-slate-200 shadow-inner shadow-white/5">
              <Sparkles className="h-4 w-4 text-sky-300" />
              <span className="font-medium">Two-stage parsing · Architect → Extractor</span>
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Transform unstructured chaos into structured intelligence without sacrificing autonomy.
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Parserator pairs a lean Architect plan with an Extractor execution engine to deliver 95% accuracy, predictable latency,
              and 70% token savings. Every stage is observable, swappable, and ready for agents across the Clear Seas ecosystem.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard" className="btn-primary-hero">
                Start in the Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a
                href="https://app-5108296280.us-central1.run.app/v1/parse"
                className="btn-secondary-hero"
              >
                Ping the Live API
              </a>
              <a href="https://parserator-production.web.app/parserator-demo.mp4" className="btn-secondary-hero">
                Watch the Walkthrough
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((item) => (
                <div key={item.label} className="bent-card">
                  <p className="text-2xl font-semibold text-white sm:text-3xl">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                  <span className="mt-3 inline-flex items-center text-xs font-semibold uppercase tracking-widest text-sky-300/80">
                    {item.accent}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="hero-slab">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-sky-200/80">Parserator Core</p>
                <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-200">Live</span>
              </div>
              <div className="mt-6 space-y-5 text-sm text-slate-200">
                <div className="glass-row">
                  <Cpu className="h-5 w-5 text-sky-300" />
                  <div>
                    <p className="font-medium text-white">createSession()</p>
                    <p className="text-xs text-slate-300">Reuse Architect plans and guardrails across batched parses.</p>
                  </div>
                </div>
                <div className="glass-row">
                  <Waves className="h-5 w-5 text-sky-300" />
                  <div>
                    <p className="font-medium text-white">parseMany()</p>
                    <p className="text-xs text-slate-300">Fan out across transcripts while preserving telemetry.</p>
                  </div>
                </div>
                <div className="glass-row">
                  <LineChart className="h-5 w-5 text-sky-300" />
                  <div>
                    <p className="font-medium text-white">getLeanLLMFieldFallbackState()</p>
                    <p className="text-xs text-slate-300">Inspect fallback usage, cooldowns, and recommended actions.</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-sky-400/20 bg-slate-900/80 p-4 text-xs text-slate-300">
                <code className="block whitespace-pre-wrap leading-relaxed">
{`const session = core.createSession({
  outputSchema: { name: 'string', email: 'string' },
  instructions: 'extract the contact record',
  seedInput: sampleTranscript,
});

const first = await session.parse(sampleTranscript);
const next = await session.parse(nextTranscript);
console.log(session.snapshot());`}
                </code>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full bg-sky-400/40 blur-3xl"></div>
            <div className="pointer-events-none absolute -bottom-10 left-8 h-36 w-36 rounded-full bg-indigo-500/30 blur-3xl"></div>
          </div>
        </section>

        <section id="architecture" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <Compass className="h-4 w-4" />
              <span>Architect → Extractor</span>
            </div>
            <h2 className="section-title">Observable two-stage architecture</h2>
            <p className="section-description">
              The Parserator pipeline blends deterministic heuristics, cached plans, and lean fallbacks. You decide which stages run
              and how telemetry surfaces across SDKs, APIs, and dashboards.
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            {architecture.map((stage) => (
              <div key={stage.step} className="stage-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="stage-icon">
                      <stage.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{stage.step}</h3>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-200/70">Managed</span>
                </div>
                <p className="mt-4 text-sm text-slate-300">{stage.summary}</p>
                <ul className="mt-6 space-y-3 text-sm text-slate-200">
                  {stage.details.map((detail) => (
                    <li key={detail} className="flex items-start space-x-3">
                      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-sky-400"></span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <Orbit className="h-4 w-4" />
              <span>Built for WMA delivery</span>
            </div>
            <h2 className="section-title">Capabilities that meet the EMA charter</h2>
            <p className="section-description">
              Everything in Parserator reinforces liberation-first software. Swap cores, inspect decisions, and deploy to any surface
              without retooling.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => (
              <div key={feature.title} className="feature-card">
                <div className="feature-icon">
                  <feature.icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-200/70">{feature.highlight}</p>
                <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="ema" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <Users className="h-4 w-4" />
              <span>Ethical Market Autonomy</span>
            </div>
            <h2 className="section-title">EMA in its own lane</h2>
            <p className="section-description">
              The movement that started inside Clear Seas now anchors Parserator. EMA lives as a dedicated section so teams can adopt
              the philosophy without sifting through product docs.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {emaPillars.map((pillar) => (
              <div key={pillar.title} className="ema-card">
                <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{pillar.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-3xl border border-sky-400/30 bg-slate-900/70 p-8 shadow-xl shadow-sky-900/40">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">EMA whitepaper</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">730 lines of narrative, commitments, and proof</h3>
                <p className="mt-3 max-w-2xl text-sm text-slate-300">
                  Dive deep into the liberation doctrine guiding Parserator and its sister products. Learn why WMA and EMA keep customers
                  sovereign and how the architecture enforces those values technically.
                </p>
              </div>
              <a
                href="https://github.com/parserator/Parserator-8b-alpha/blob/main/essential-context/EMA_WHITE_PAPER.md"
                className="btn-glow-secondary"
              >
                Read the EMA Manifesto
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section id="ecosystem" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <BookOpen className="h-4 w-4" />
              <span>Clear Seas ecosystem</span>
            </div>
            <h2 className="section-title">Built to stand beside Nimbus Guardian &amp; Reposiologist</h2>
            <p className="section-description">
              Consistent navigation, glassmorphism, and gradient palettes create a shared feel across the movement. Parserator now mirrors the polish of its sibling launches.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {ecosystem.map((product) => (
              <a key={product.name} href={product.href} className={`ecosystem-card ${product.mirrored ? 'mirrored' : ''}`}>
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900/80 shadow-inner shadow-sky-900/40">
                  <Image src={product.logo} alt={product.name} width={64} height={64} className="h-16 w-16 object-contain" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">{product.name}</h3>
                <p className="mt-3 text-sm text-slate-300">{product.description}</p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-sky-300">
                  {product.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </section>

        <section id="readiness" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <ShieldCheck className="h-4 w-4" />
              <span>Launch readiness</span>
            </div>
            <h2 className="section-title">Project status · June 2025 audit</h2>
            <p className="section-description">
              Every document in this repository aligns on a single message: Parserator is production ready, only polish items remain.
              Here is what the latest audits confirm.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {readiness.map((item) => (
              <div key={item.title} className="readiness-card">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{item.content}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-sky-200/70">{item.proof}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-wrapper">
          <div className="cta-panel">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">Ready when you are</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Deploy Parserator today, scale the EMA movement tomorrow.</h2>
              <p className="mt-4 max-w-2xl text-sm text-slate-300">
                Connect through the dashboard, call the live API, or embed the Node SDK. Parserator plays nicely with every surface in the Clear Seas constellation.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard" className="btn-primary-hero">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a href="https://www.npmjs.com/package/parserator-sdk" className="btn-secondary-hero">
                Install SDK
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950/90 border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-sky-400/40 bg-slate-900/70 p-3 shadow-inner shadow-sky-900/40">
              <Image src="/clear-seas-logo.svg" alt="Clear Seas" width={48} height={48} className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Clear Seas Alliance</p>
              <p className="text-sm text-slate-300">Parserator · Nimbus Guardian · Reposiologist</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-sm text-slate-400 md:flex-row md:items-center md:gap-6">
            <a href="https://nimbus-guardian.web.app/" className="footer-link">Nimbus Guardian</a>
            <a href="https://reposiologist-beta.web.app/" className="footer-link">Reposiologist</a>
            <a href="https://domusgpt.github.io/ClearSeas-Enhanced/" className="footer-link">Clear Seas HQ</a>
            <a href="https://parserator-production.web.app/privacy-policy.html" className="footer-link">Privacy</a>
            <a href="https://parserator-production.web.app/terms.html" className="footer-link">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
