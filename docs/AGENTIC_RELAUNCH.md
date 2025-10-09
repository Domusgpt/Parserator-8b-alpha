# Parserator Lean Agent Blueprint

## 1. Context & Intent
Parserator already ships a production-ready API, dashboard, and SDK. What we lacked was a **lightweight core** that vibe coders, agency operators, and autonomous agents could drop into bespoke workflows without inheriting the Firebase stack. The objective of this refactor is to supply that core: a predictable two-stage pipeline that works offline, exposes meaningful diagnostics, and can be upgraded to LLM-backed modules when teams are ready.

This blueprint aligns with the EMA promise (“freedom to leave”) and the WMA principle we market on parserator.com (“wide market autonomy”). The core should feel welcoming to hackers experimenting on a Saturday, yet credible for teams planning high-scale sensor ingestion.

## 2. What Changed in `@parserator/core`
- **ParseratorCore facade** – still the single entry point, but now mounts a shared `ResolverRegistry` so runtime config, agent swaps, and resolver registration all live in one lightweight surface.【F:active-development/packages/core/src/index.ts†L36-L143】
- **HeuristicArchitect** – promoted into its own module and still synthesises SearchPlans with heuristics, but now ships typed metadata so downstream agents can reason about origin/complexity without inspecting raw objects.【F:active-development/packages/core/src/architect.ts†L1-L79】
- **ResolverRegistry + defaults** – new resolver pipeline (JSON-first + section-aware + heuristic fallback) that agents can extend via `registerResolver`, keeping extraction logic composable as we introduce sensor-grade modules.【F:active-development/packages/core/src/resolvers.ts†L1-L365】
- **RegexExtractor** – now orchestrates resolvers, aggregates confidence per step, and records missing field diagnostics so downstream systems know why data failed to materialise.【F:active-development/packages/core/src/extractor.ts†L1-L104】
- **Consolidated types** – `types.ts` now exports resolver contracts (`FieldResolver`, `FieldResolutionContext`) alongside the original request/response types so agent authors can contribute modules without reaching into internals.【F:active-development/packages/core/src/types.ts†L108-L217】
- **ParseratorSession** – spin up cached Architect plans with `createSession`, reuse them across batched parses, and introspect confidence/token telemetry via `snapshot()` without re-running expensive planning calls.【F:active-development/packages/core/src/session.ts†L34-L208】【F:active-development/packages/core/src/types.ts†L219-L240】
- **Plan cache and portability** – configure a shared `planCache` (or use the bundled `createInMemoryPlanCache`) so SearchPlans survive across workers, direct `core.parse` calls, and hydrated sessions without re-running the architect, while keeping metadata/telemetry aligned.【F:active-development/packages/core/src/index.ts†L300-L420】【F:active-development/packages/core/src/session.ts†L720-L870】【F:active-development/packages/core/src/cache.ts†L1-L47】
- **Plan calibration tools** – call `session.refreshPlan()` to regenerate heuristics with new samples or instructions and query `session.getPlanState()` for diagnostics/seed metadata before agents proceed.【F:active-development/packages/core/src/session.ts†L120-L344】【F:active-development/packages/core/src/types.ts†L219-L327】
- **Auto-refresh guardrails** – supply an `autoRefresh` policy when creating sessions to trigger plan regeneration automatically after low-confidence parses or scheduled intervals, then observe cooldowns and last triggers via `session.getAutoRefreshState()` or `snapshot()`.【F:active-development/packages/core/src/session.ts†L34-L360】【F:active-development/packages/core/src/types.ts†L219-L308】
- **Session portability helpers** – hydrate fresh workers with `ParseratorCore#createSessionFromResponse` or persist plan state using `ParseratorSession#exportInit()` so cached heuristics survive queues, cold starts, and agent restarts.【F:active-development/packages/core/src/index.ts†L188-L274】【F:active-development/packages/core/src/session.ts†L270-L318】
- **Batch parsing helper** – the new `ParseratorCore#parseMany` API reuses cached plans for aligned schemas/instructions, giving ops teams a turnkey way to chew through inboxes or transcripts without hand-rolling session orchestration.【F:active-development/packages/core/src/index.ts†L200-L302】【F:active-development/packages/core/src/types.ts†L49-L68】
- **Lifecycle interceptors** – register global hooks with `ParseratorCore#use` (or supply them at construction) to tap into before/after/failure lifecycles for both direct parses and sessions—perfect for analytics, guardrails, or adaptive agents without touching orchestration code.【F:active-development/packages/core/src/index.ts†L107-L360】【F:active-development/packages/core/src/session.ts†L64-L520】
- **Preprocessor stack** – every parse now passes through lightweight preprocessors before validation/interceptors, trimming whitespace, normalising line endings, and tidying schema keys while exposing metrics and diagnostics alongside architect/extractor stages.【F:active-development/packages/core/src/preprocessors.ts†L1-L158】【F:active-development/packages/core/src/index.ts†L300-L456】【F:active-development/packages/core/src/session.ts†L120-L360】
- **Pipeline introspection** – call `core.describePipeline()` or `session.describe()` to enumerate active preprocessors, resolver stacks, interceptors, telemetry listeners, and cache capabilities so ops dashboards and adaptive agents can reason about the current orchestration without spelunking logs.【F:active-development/packages/core/src/index.ts†L188-L360】【F:active-development/packages/core/src/session.ts†L120-L420】【F:active-development/packages/core/src/types.ts†L219-L288】
- **Profile presets** – built-in `lean-agent`, `vibe-coder`, and `sensor-grid` options bundle configs/heuristics so vibe coders, ops teams, and sensor grids can swap behaviours with a single `applyProfile` call or API toggle.【F:active-development/packages/core/src/profiles.ts†L1-L86】【F:active-development/packages/core/src/index.ts†L107-L188】【F:active-development/packages/api/src/services/parse.service.ts†L93-L143】

## 3. Why This Matters
1. **Agent-first defaults** – Developers can achieve useful parsing locally; swapping in LLM- or sensor-aware modules becomes a drop-in upgrade rather than a hard requirement.
2. **Transparent diagnostics** – Every response carries combined architect/extractor diagnostics so marketing, support, and ops can trace low-confidence paths without digging through logs, now with section-level hints describing which heading produced each value.【F:active-development/packages/core/src/resolvers.ts†L78-L312】【F:active-development/packages/core/src/index.ts†L190-L353】
3. **WMA-aligned extensibility** – Teams can ship their own `ArchitectAgent` or `ExtractorAgent` implementations (CrewAI, LangGraph, on-prem GPUs) by calling `setArchitect`/`setExtractor`, keeping structure flexible.
4. **No rigid kernel dependency** – We deliberately avoided a monolithic orchestrator. The exported abstractions are simple functions/interfaces, encouraging experimentation and incremental hardening.

## 4. Recommended Rollout Steps
### Phase A – SDK & API Sync
- Update `packages/api` to depend on `@parserator/core` for SearchPlan generation so diagnostics stay consistent across environments.
- Refresh the Node SDK to surface `metadata.diagnostics` and propagate the `LOW_CONFIDENCE` warning when fallbacks are disabled.【F:active-development/packages/core/src/index.ts†L111-L170】

### Phase B – Website & Storytelling
- Highlight the “works offline, upgrade when ready” narrative on parserator.com to mirror EMA/WMA messaging.
- Publish quickstarts for vibe coders (local heuristics) and business ops (swapping in governed modules).

### Phase C – Future Enhancements
- Introduce optional streaming hooks so agents can observe extraction progress for long documents.
- Promote a resolver authoring guide covering section heuristics, new validation types (currency/percentage/address/name), and how to distribute community packs safely.【F:active-development/packages/core/src/heuristics.ts†L1-L146】【F:active-development/packages/core/src/resolvers.ts†L78-L365】
- Document session-oriented recipes (e.g., batched inbox parsing, localized sensor calibration) to show how cached plans reduce latency and token spend for EMA-aligned operators.【F:active-development/packages/core/src/session.ts†L34-L208】
- Ship curated module packs: e.g., `@parserator/core-vision` for ND sensor arrays, `@parserator/core-finance` for ledger-style records.
- Partner with EMA community builders to certify open modules, reinforcing the right-to-leave ethos.

## 5. Implementation Checklist
- [x] Replace monolithic stub with configurable, documented core.
- [x] Provide default modules that require zero external credentials.
- [x] Wire the API/SDK to consume the shared pipeline (follow-up work).
- [ ] Design landing page updates spotlighting the lean core and autonomy principles.

The refactor lands a usable ancestor for the eventual sensor-grade kernel without overwhelming today’s adopters. It keeps Parserator nimble, honest, and ready for the coming wave of agent-powered integrations.
