'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Gauge,
  LineChart,
  Network,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FeatureCard {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
}

interface Pillar {
  title: string;
  description: string;
  badge: string;
}

interface EcosystemCard {
  name: string;
  description: string;
  href: string;
  accent: string;
}

const features: FeatureCard[] = [
  {
    icon: Sparkles,
    title: 'Architect → Extractor Pipeline',
    description:
      'Gemini 1.5 Flash plans the extraction, the lean extractor executes with deterministic heuristics, and telemetry traces every step.',
    points: [
      '95% accuracy across invoices, medical records, and transcripts',
      '70% token savings compared to single-shot LLM parsing',
      'Architect plans are portable and reusable inside sessions'
    ]
  },
  {
    icon: Workflow,
    title: 'Session Intelligence Built In',
    description:
      'Cache plans, stream batched parses, and auto-refresh low-confidence sessions without leaving your workflow.',
    points: [
      'Create sessions that hydrate instantly from prior responses',
      'Auto-refresh guardrails regenerate plans when confidence dips',
      'Lean interceptors expose before/after/failure hooks for ops'
    ]
  },
  {
    icon: ShieldCheck,
    title: 'Transparent Diagnostics',
    description:
      'Telemetry-first responses surface heuristics, section hits, fallbacks, and queue health for every parse.',
    points: [
      'Field-level fallback telemetry with confidence reasons',
      'Plan rewrite diagnostics with cooldown state snapshots',
      'Share identical metadata across API, SDK, and plugins'
    ]
  }
];

const emaPillars: Pillar[] = [
  {
    title: 'Freedom to Leave',
    description:
      'Parserator ships portable plans, exportable sessions, and documented migration guides so every tenant can churn on their own terms.',
    badge: 'EMA Principle'
  },
  {
    title: 'Glass-Box Telemetry',
    description:
      'Every architect and extractor decision is logged, from heuristics to LLM fallbacks, delivering the transparency commitments outlined in the EMA white paper.',
    badge: 'Transparency'
  },
  {
    title: 'Composable Autonomy',
    description:
      'Swap in your own architect, extractor, or resolver modules without rewriting the kernel. EMA certification workflows stay intact because the core is swappable.',
    badge: 'Modularity'
  }
];

const ecosystem: EcosystemCard[] = [
  {
    name: 'Nimbus Guardian',
    description: 'Autonomous monitoring built on Parserator telemetry patterns with the same glassmorphism aesthetic.',
    href: 'https://nimbus-guardian.web.app/',
    accent: 'from-sky-400/40 via-blue-500/30 to-slate-900/60'
  },
  {
    name: 'Reposiologist',
    description: 'Card-bending navigation for repo audits that inspired the new Parserator section layout.',
    href: 'https://reposiologist-beta.web.app/',
    accent: 'from-purple-500/40 via-pink-500/30 to-slate-900/60'
  },
  {
    name: 'Clear Seas',
    description: 'Parent initiative stewarding EMA standards across the ecosystem and anchoring the liberation-first charter.',
    href: 'https://domusgpt.github.io/ClearSeas-Enhanced/',
    accent: 'from-cyan-400/40 via-slate-200/40 to-slate-900/70'
  }
];

const metrics = [
  { label: 'Accuracy', value: '95%', caption: 'Across 16 complex document suites' },
  { label: 'Token Savings', value: '70%', caption: 'Architect vs. brute-force parsing' },
  { label: 'Response Time', value: '~2.2s', caption: 'Median parse turnaround' }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-starfield text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-cyan-500/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-48 left-16 h-[28rem] w-[28rem] rounded-full bg-purple-600/20 blur-3xl" aria-hidden />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100%\' height=\'100%\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'80\' height=\'80\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 80 0 L 0 0 0 80\' fill=\'none\' stroke=\'rgba(148,163,184,0.12)\' stroke-width=\'1\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%\' height=\'100%\' fill=\'url(%23grid)\'/%3E%3C/svg%3E"' }} aria-hidden />
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-700/40 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/parserator-logo.svg" alt="Parserator" width={40} height={40} className="drop-shadow" />
            <span className="text-lg font-semibold tracking-wide">Parserator</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a href="#core" className="text-slate-200 transition hover:text-white">Core</a>
            <a href="#ema" className="text-slate-200 transition hover:text-white">EMA</a>
            <a href="#ecosystem" className="text-slate-200 transition hover:text-white">Ecosystem</a>
            <a href="#pricing" className="text-slate-200 transition hover:text-white">Pricing</a>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/40 transition hover:bg-cyan-400/20 hover:text-white">
              Launch Dashboard
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-20">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="section-eyebrow">Freedom-first parsing</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
                Architect your data liberation with{' '}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-teal-300 bg-clip-text text-transparent">
                  Parserator
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-slate-200 md:text-xl">
                Deploy the EMA-aligned Architect → Extractor pipeline that powers our production API, SDK, and plugins.
                Plans are portable, telemetry is transparent, and every stage honors the right to leave.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400"
                >
                  Get API Access
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://parserator-production.web.app/index-production-ready.html"
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/60 bg-slate-950/60 px-6 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:text-white"
                >
                  Explore the Demo
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-300">
                {metrics.map(({ label, value, caption }) => (
                  <div key={label} className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-5 py-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-sky-300/70">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                    <div className="mt-1 text-xs text-slate-400">{caption}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="glass-panel relative overflow-hidden rounded-3xl border border-cyan-500/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sky-200/80">Live parse telemetry</p>
                    <h2 className="mt-2 text-2xl font-semibold">Session Snapshot</h2>
                  </div>
                  <span className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" /> Live
                  </span>
                </div>
                <div className="gradient-divider my-6" />
                <pre className="glass-border max-h-72 overflow-auto rounded-2xl bg-slate-950/80 p-4 text-xs text-left text-slate-200 shadow-lg">
{`{
  "requestId": "req_8f2d3",
  "profile": "lean-agent",
  "confidence": 0.95,
  "architect": {
    "engine": "Gemini 1.5 Flash",
    "planId": "plan_7ca1",
    "segments": 12,
    "tokenSpend": 148
  },
  "extractor": {
    "resolvedFields": 24,
    "heuristicMatches": 18,
    "llmFallbacks": 2
  },
  "metadata": {
    "latencyMs": 2230,
    "planCache": "hit",
    "recommendedActions": []
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section id="core" className="relative border-y border-slate-800/40 bg-slate-950/40 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-3xl">
              <p className="section-eyebrow">Core architecture</p>
              <h2 className="section-title mt-4">What makes Parserator different</h2>
              <p className="mt-4 text-slate-300">
                The production core mirrors the strategy outlined in the AGENTIC Relaunch brief: lean heuristics, modular resolvers,
                and telemetry parity across dashboard, API, and SDK consumers.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="tilt-card rounded-3xl p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm text-slate-300">{feature.description}</p>
                  <ul className="mt-5 space-y-2 text-sm text-slate-400">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 lg:flex-row">
            <div className="flex-1">
              <p className="section-eyebrow">Parse in minutes</p>
              <h2 className="section-title mt-4">Drop-in developer experience</h2>
              <p className="mt-4 text-slate-300">
                Spin up parse sessions locally, stream batched inboxes, or ship lean connectors into Claude, VS Code, or JetBrains extensions.
                The same SDK powers the MCP server, Chrome extension, and Firebase Functions deployment tracked in the production reports.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
                  <div className="flex items-center gap-3 text-slate-200">
                    <Gauge className="h-5 w-5 text-cyan-300" />
                    Real-time usage dashboards
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    Monitor quotas and performance in the dashboard the moment you create an API key.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
                  <div className="flex items-center gap-3 text-slate-200">
                    <Zap className="h-5 w-5 text-cyan-300" />
                    Lean fallbacks
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    Keep LLM usage optional. When activated, batched fallbacks honour session guardrails and audit logs.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
                  <div className="flex items-center gap-3 text-slate-200">
                    <LineChart className="h-5 w-5 text-cyan-300" />
                    Telemetry everywhere
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    Subscribe to lifecycle events or export snapshots into monitoring suites like Nimbus Guardian.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
                  <div className="flex items-center gap-3 text-slate-200">
                    <Network className="h-5 w-5 text-cyan-300" />
                    Ecosystem ready
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    Integrations align with the EMA ecosystem—Nimbus Guardian, Reposiologist, and Clear Seas all share the story.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="glass-panel relative overflow-hidden rounded-3xl border border-cyan-500/20 p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-[0.3em] text-sky-200/80">SDK quickstart</span>
                    <h3 className="mt-2 text-xl font-semibold">TypeScript Session</h3>
                  </div>
                  <span className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs text-cyan-200">npm install parserator-sdk</span>
                </div>
                <pre className="glass-border mt-6 rounded-2xl p-4 text-xs text-slate-100">
{`import { Parserator } from 'parserator-sdk';

const core = new Parserator({ apiKey: process.env.PARSERATOR_KEY! });
const session = await core.createSession({
  outputSchema: { name: 'string', email: 'string' },
  instructions: 'extract contact info',
  seedInput: sampleTranscript,
  autoRefresh: { strategy: 'confidence', threshold: 0.9 }
});

const result = await session.parse(sampleTranscript);
console.log(result.metadata.telemetry);
`}
                </pre>
                <div className="mt-6 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-cyan-300" />
                    Sessions hydrate instantly from cached plans
                  </div>
                  <a
                    href="https://www.npmjs.com/package/parserator-sdk"
                    className="inline-flex items-center gap-1 text-cyan-200 transition hover:text-white"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SDK Docs
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ema" className="border-y border-slate-800/40 bg-slate-950/60 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-3xl">
              <p className="section-eyebrow">EMA alignment</p>
              <h2 className="section-title mt-4">Exoditical Moral Architecture in practice</h2>
              <p className="mt-4 text-slate-300">
                Parserator isn&apos;t just compliant with EMA guidelines—it was built as the flagship implementation. The EMA white paper
                and systems assessment documents inside this repo guided every portability, transparency, and governance decision.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {emaPillars.map((pillar) => (
                <div key={pillar.title} className="rounded-3xl border border-cyan-500/20 bg-slate-900/40 p-6 shadow-xl">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">{pillar.badge}</span>
                  <h3 className="mt-3 text-xl font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-3 text-sm text-slate-300">{pillar.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <a
                href="https://parserator-production.web.app/docs.html#ema"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 px-4 py-2 transition hover:border-cyan-300 hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Read the EMA White Paper
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="https://parserator-production.web.app/docs.html#agentic-relaunch"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 px-4 py-2 transition hover:border-cyan-300 hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Review the agentic relaunch blueprint
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section id="ecosystem" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="section-eyebrow">Ecosystem</p>
                <h2 className="section-title mt-4">Designed to flow with the Clear Seas network</h2>
                <p className="mt-4 text-slate-300">
                  Nimbus Guardian, Reposiologist, and Clear Seas share navigation cues, glass gradients, and freedom-first messaging.
                  Parserator now mirrors those patterns while staying distinctly focused on data parsing.
                </p>
              </div>
              <Image src="/clear-seas-logo.svg" alt="Clear Seas" width={120} height={120} className="drop-shadow-lg" />
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {ecosystem.map((site) => (
                <a
                  key={site.name}
                  href={site.href}
                  className={`tilt-card group rounded-3xl bg-gradient-to-br ${site.accent} p-6 transition`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{site.name}</h3>
                    <ArrowUpRight className="h-5 w-5 text-cyan-100 transition group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </div>
                  <p className="mt-4 text-sm text-slate-200/90">{site.description}</p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-1 text-xs text-slate-100/80 transition group-hover:border-white group-hover:text-white">
                    Visit site
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-slate-800/40 bg-slate-950/40 py-20">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <p className="section-eyebrow">Pricing</p>
            <h2 className="section-title mt-4">Straightforward tiers aligned with EMA promises</h2>
            <p className="mt-4 text-slate-300">
              Start on the free tier, scale into Pro or Enterprise, and always keep the right to export your data, sessions, and plans.
              The pricing structure mirrors the launch details in the production deployment status report.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { name: 'Free', price: '$0', details: ['100 requests / month', 'Live dashboard & telemetry', 'Community support'] },
                { name: 'Pro', price: '$249', details: ['10,000 requests / month', 'Priority support', 'Session auto-refresh controls'] },
                { name: 'Enterprise', price: 'Custom', details: ['100,000+ requests / month', 'Dedicated EMA onboarding', 'Private module packs'] }
              ].map((tier) => (
                <div key={tier.name} className="tilt-card rounded-3xl p-6 text-left">
                  <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                  <div className="mt-2 text-3xl font-bold text-cyan-200">{tier.price}</div>
                  <ul className="mt-6 space-y-2 text-sm text-slate-300">
                    {tier.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/dashboard"
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:text-white"
                  >
                    Choose plan
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/40 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/clear-seas-logo.svg" alt="Clear Seas" width={52} height={52} className="drop-shadow" />
            <div>
              <p className="text-sm font-semibold text-white">Clear Seas Initiative</p>
              <p className="text-xs text-slate-400">Parent ecosystem stewarding EMA standards.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-300">
            <a href="https://parserator-production.web.app/index-production-ready.html" className="transition hover:text-white">
              Legacy Marketing Site
            </a>
            <a href="https://nimbus-guardian.web.app/" className="transition hover:text-white">
              Nimbus Guardian
            </a>
            <a href="https://reposiologist-beta.web.app/" className="transition hover:text-white">
              Reposiologist
            </a>
            <a href="https://domusgpt.github.io/ClearSeas-Enhanced/" className="transition hover:text-white">
              Clear Seas Hub
            </a>
            <Link href="/dashboard" className="transition hover:text-white">
              Dashboard Login
            </Link>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Parserator. Built with EMA principles.</p>
        </div>
      </footer>
    </div>
  );
}
