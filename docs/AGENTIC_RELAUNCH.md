# Parserator Lean Agent Blueprint

## 1. Context & Intent
Parserator already ships a production-ready API, dashboard, and SDK. What we lacked was a **lightweight core** that vibe coders, agency operators, and autonomous agents could drop into bespoke workflows without inheriting the Firebase stack. The objective of this refactor is to supply that core: a predictable two-stage pipeline that works offline, exposes meaningful diagnostics, and can be upgraded to LLM-backed modules when teams are ready.

This blueprint aligns with the EMA promise (“freedom to leave”) and the WMA principle we market on parserator.com (“wide market autonomy”). The core should feel welcoming to hackers experimenting on a Saturday, yet credible for teams planning high-scale sensor ingestion.

## 2. What Changed in `@parserator/core`
- **ParseratorCore facade** – still the single entry point, but now mounts a shared `ResolverRegistry` so runtime config, agent swaps, and resolver registration all live in one lightweight surface.【F:active-development/packages/core/src/index.ts†L36-L143】
- **ParseratorSession orchestration** – each parse request can be wrapped in a `ParseratorSession` that emits lifecycle events, enabling observers to instrument plan/extract phases or run them independently when agents want more control.【F:active-development/packages/core/src/session.ts†L1-L266】【F:active-development/packages/core/src/index.ts†L79-L143】
- **HeuristicArchitect** – promoted into its own module and still synthesises SearchPlans with heuristics, but now ships typed metadata so downstream agents can reason about origin/complexity without inspecting raw objects.【F:active-development/packages/core/src/architect.ts†L1-L79】
- **ResolverRegistry + defaults** – new resolver pipeline (JSON-first + heuristic fallback) that agents can extend via `registerResolver`, keeping extraction logic composable as we introduce sensor-grade modules.【F:active-development/packages/core/src/resolvers.ts†L1-L229】
- **RegexExtractor** – now orchestrates resolvers, aggregates confidence per step, and records missing field diagnostics so downstream systems know why data failed to materialise.【F:active-development/packages/core/src/extractor.ts†L1-L104】
- **Consolidated types** – `types.ts` now exports resolver contracts (`FieldResolver`, `FieldResolutionContext`) alongside the original request/response types so agent authors can contribute modules without reaching into internals.【F:active-development/packages/core/src/types.ts†L61-L177】

## 3. Why This Matters
1. **Agent-first defaults** – Developers can achieve useful parsing locally; swapping in LLM- or sensor-aware modules becomes a drop-in upgrade rather than a hard requirement.
2. **Transparent diagnostics** – Every response carries combined architect/extractor diagnostics so marketing, support, and ops can trace low-confidence paths without digging through logs.
3. **Observer-grade transparency** – Lifecycle observers plug in without forking the core, capturing request validation, architect, extractor, and completion events for analytics dashboards or realtime agent supervision.【F:active-development/packages/core/src/index.ts†L105-L143】
4. **WMA-aligned extensibility** – Teams can ship their own `ArchitectAgent` or `ExtractorAgent` implementations (CrewAI, LangGraph, on-prem GPUs) by calling `setArchitect`/`setExtractor`, keeping structure flexible.
5. **No rigid kernel dependency** – We deliberately avoided a monolithic orchestrator. The exported abstractions are simple functions/interfaces, encouraging experimentation and incremental hardening.

## 4. Recommended Rollout Steps
### Phase A – SDK & API Sync
- Update `packages/api` to depend on `@parserator/core` for SearchPlan generation so diagnostics stay consistent across environments.
- Refresh the Node SDK to surface `metadata.diagnostics` and propagate the `LOW_CONFIDENCE` warning when fallbacks are disabled.【F:active-development/packages/core/src/index.ts†L121-L156】

### Phase B – Website & Storytelling
- Highlight the “works offline, upgrade when ready” narrative on parserator.com to mirror EMA/WMA messaging.
- Publish quickstarts for vibe coders (local heuristics) and business ops (swapping in governed modules).

### Phase C – Future Enhancements
- Layer in async streaming observers so external systems can subscribe to long-running extractions without polling.
- Ship curated module packs: e.g., `@parserator/core-vision` for ND sensor arrays, `@parserator/core-finance` for ledger-style records.
- Partner with EMA community builders to certify open modules, reinforcing the right-to-leave ethos.

## 5. Implementation Checklist
- [x] Replace monolithic stub with configurable, documented core.
- [x] Provide default modules that require zero external credentials.
- [ ] Wire the API/SDK to consume the shared pipeline (follow-up work).
- [ ] Design landing page updates spotlighting the lean core and autonomy principles.

The refactor lands a usable ancestor for the eventual sensor-grade kernel without overwhelming today’s adopters. It keeps Parserator nimble, honest, and ready for the coming wave of agent-powered integrations.
