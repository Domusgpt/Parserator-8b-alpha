# Parserator Agentic Relaunch Blueprint

## 1. Context & Vision
Parserator launched with a production-ready Architect → Extractor pipeline, Firebase infrastructure, and a polished dashboard. The next wave of work must position Parserator as an *agent-first kernel* that delight vibe coders, enterprise teams, and future sensor-driven systems simultaneously. The objective is to keep the current product usable today while laying the technical rails for ubiquitous, locally adaptable deployments.

This plan builds on the existing EMA (Exoditical Moral Architecture) promise of liberation-first tooling and introduces the complementary **WMA (Wide Market Autonomy)** principle that marketing has been leaning into for parserator.com: every touchpoint should communicate that teams can scale without being trapped in rigid vendor narratives.

## 2. Findings from the Current Stack
### 2.1 Core Product
- The API already follows the two-stage workflow in `packages/api` but the core TypeScript library previously exposed a monolithic `ParseratorCore` with hard-coded stubs.【F:active-development/packages/api/src/services/parse.service.ts†L1-L120】
- SDK consumers lacked hooks for instrumentation, streaming, or custom modules, making agent integration brittle.

### 2.2 Dashboard & Web Experience
- The Next.js dashboard routes to `/dashboard` immediately and is seeded entirely with mock data; no runtime data or personalization is surfaced yet.【F:active-development/packages/dashboard/src/app/page.tsx†L1-L20】【F:active-development/packages/dashboard/src/app/dashboard/page.tsx†L1-L120】
- Navigation emphasises “Dashboard / Documentation / Pricing” but does not communicate agentic workflows or EMA/WMA values on the landing experience.【F:active-development/packages/dashboard/src/app/dashboard/page.tsx†L61-L110】

### 2.3 Market & Storytelling Hooks
- The README and investor briefing lean heavily on the EMA narrative (“freedom to leave”) but the public site copy does not yet express the matching WMA promise of adaptive structure for different teams.【F:README.md†L1-L82】【F:Briefing Docs and Dev Details/PARSERATOR_COMPREHENSIVE_INVESTOR_BRIEFING.md†L1-L120】

## 3. Refactored Agentic Kernel (Shipping Now)
To unblock rapid iteration we re-architected the core package around a modular kernel that separates orchestration from capability modules.

### 3.1 Agentic Kernel Orchestrator
- `AgenticKernel` now manages planner/executor modules, validates payload constraints, and emits structured instrumentation events for observability.【F:active-development/packages/core/src/kernel/agentic-kernel.ts†L1-L260】
- Kernel configuration supports max payload sizing, schema caps, adaptive sampling flags, and pluggable instrumentation so agents can subscribe to state transitions.【F:active-development/packages/core/src/kernel/agentic-kernel.ts†L15-L73】【F:active-development/packages/core/src/types.ts†L44-L115】

### 3.2 Planner & Executor Modules
- `DefaultArchitectModule` creates deterministic SearchPlans from schemas and input hints, returning diagnostics useful for downstream agents.【F:active-development/packages/core/src/modules/architect-module.ts†L1-L87】
- `DefaultExtractorModule` runs lightweight JSON + text heuristics and reports completion ratios and confidence, providing a baseline extraction path until bespoke modules are swapped in.【F:active-development/packages/core/src/modules/extractor-module.ts†L1-L76】

### 3.3 ParseratorCore Facade
- The exported `ParseratorCore` now normalises invocation metadata, exposes a `reconfigure` method, and surfaces the kernel for advanced integrations—critical for agent orchestration frameworks.【F:active-development/packages/core/src/index.ts†L1-L77】

### 3.4 Kernelisation Benefits
- Agents can register alternative planner/executor modules (e.g., GPU-accelerated local planners, vision transformers for ND sensor graphs) without rewriting orchestration logic.
- The kernel emits structured events (`planner:start`, `executor:finish`, etc.) that downstream systems can route into metrics, stream processing, or adaptive retries.

## 4. Forward Architecture Strategy
### Phase 0 – Foundation (This Sprint)
1. Ship the modular core (completed above) and wire it into API/SDK packages.
2. Provide TypeScript definitions for agent contexts, instrumentation, and streaming hooks (done in `types.ts`).
3. Document kernel usage and extension points (this blueprint + README updates).

### Phase 1 – Agentic Developer Experience
1. SDK Enhancements: expose streaming diffs, typed diagnostics, and `invokedBy` semantics in Node & Python SDKs.
2. MCP & CrewAI adapters: mount the kernel so agents can inject bespoke modules at runtime.
3. Launch website refresh emphasising WMA: highlight modular kernel, pre-built agent recipes, and “freedom to refactor” messaging.

### Phase 2 – Kernel to Sensor Graphs
1. Introduce a `visual-transformer` executor module capable of consuming ND high-frame-rate tensors.
2. Add local adapters (WebGPU / CUDA) with automatic capability negotiation based on available hardware.
3. Extend the SearchPlan schema to describe temporal windows, sensor fusion strategies, and multi-modal validation.

### Phase 3 – Autonomy & Marketplace
1. Release a marketplace of certified planner/executor modules aligned with EMA/WMA principles.
2. Instrument kernel telemetry to back a public “Wall of Openness” metrics page showing confidence trends and exit readiness.
3. Offer enterprise controls for on-prem kernel deployment with policy-guardrails (rate limits, schema governance, audit trails).

## 5. Website & WMA Messaging Strategy
1. **Landing Narrative** – Replace the immediate dashboard redirect with an agentic storytelling page: introduce the kernel, call out EMA (right to leave) + WMA (wide market autonomy), and showcase modular plug-ins before linking to dashboard signup.
2. **Dynamic Data** – Replace mock cards with live usage + diagnostics streaming from kernel instrumentation so builders *see* autonomy metrics.
3. **Playbooks** – Add sections for vibe coders (rapid prototyping recipes) and business ops (governed schema pipelines) to show flexible structure.
4. **Migration Spotlight** – Prominently feature “Bring your own modules” and export workflows to reinforce liberation-first trust.
5. **Feedback Loop** – Instrument CTA flows to feed into kernel telemetry, enabling marketing experiments without rigid redesigns.

## 6. Immediate Next Actions
1. **API Wiring** – Point `packages/api` at the new core kernel to remove duplicated logic and capture diagnostics centrally.
2. **SDK Sync** – Update Node/Python SDKs to consume new `ParseResponse.metadata.diagnostics` and support invocation metadata.
3. **Dashboard Roadmap** – Replace mocks with authenticated API calls, add instrumentation stream, and surface EMA/WMA copy on landing.
4. **Documentation** – Publish agent-focused quickstarts (kernel module authoring, instrumentation webhooks, local fallback guides).

## 7. Appendix – Repo Mapping
- `packages/core` – new agentic kernel primitives (planner/executor modules, orchestration, types).
- `packages/api` – Firebase Functions orchestration; target for kernel wiring.
- `packages/dashboard` – Next.js app awaiting dynamic data + WMA messaging.
- `docs/` – evolving home for architectural blueprints (this file).

---
This blueprint frames today’s refactor as the first kernelised ancestor of Parserator’s long-term vision: a ubiquitous, elegant, and autonomous parsing infrastructure that scales from solo agents to global sensor networks without sacrificing the EMA promise of liberation or the WMA imperative of adaptable structure.
