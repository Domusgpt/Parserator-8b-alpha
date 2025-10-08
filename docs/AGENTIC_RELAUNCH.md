# Parserator Lean Agent Blueprint

## 1. Context & Intent
Parserator already ships a production-ready API, dashboard, and SDK. What we lacked was a **lightweight core** that vibe coders, agency operators, and autonomous agents could drop into bespoke workflows without inheriting the Firebase stack. The objective of this refactor is to supply that core: a predictable two-stage pipeline that works offline, exposes meaningful diagnostics, and can be upgraded to LLM-backed modules when teams are ready.

This blueprint aligns with the EMA promise (“freedom to leave”) and the WMA principle we market on parserator.com (“wide market autonomy”). The core should feel welcoming to hackers experimenting on a Saturday, yet credible for teams planning high-scale sensor ingestion.

## 2. What Changed in `@parserator/core`
- **ParseratorCore facade** – still the single entry point, but now mounts a shared `ResolverRegistry` so runtime config, agent swaps, and resolver registration all live in one lightweight surface.【F:active-development/packages/core/src/index.ts†L36-L143】
- **HeuristicArchitect** – promoted into its own module and still synthesises SearchPlans with heuristics, but now ships typed metadata so downstream agents can reason about origin/complexity without inspecting raw objects.【F:active-development/packages/core/src/architect.ts†L1-L79】
- **ResolverRegistry + defaults** – new resolver pipeline (JSON-first + section-aware + heuristic fallback) that agents can extend via `registerResolver`, keeping extraction logic composable as we introduce sensor-grade modules.【F:active-development/packages/core/src/resolvers.ts†L1-L365】
- **RegexExtractor** – now orchestrates resolvers, aggregates confidence per step, and records missing field diagnostics so downstream systems know why data failed to materialise.【F:active-development/packages/core/src/extractor.ts†L1-L104】
- **Consolidated types** – `types.ts` now exports resolver contracts (`FieldResolver`, `FieldResolutionContext`) alongside the original request/response types so agent authors can contribute modules without reaching into internals.【F:active-development/packages/core/src/types.ts†L61-L177】
- **ParseratorSession** – spin up cached Architect plans with `createSession`, reuse them across batched parses, and introspect confidence/token telemetry via `snapshot()` without re-running expensive planning calls.【F:active-development/packages/core/src/index.ts†L145-L357】【F:active-development/packages/core/src/types.ts†L179-L213】

## 3. Why This Matters
1. **Agent-first defaults** – Developers can achieve useful parsing locally; swapping in LLM- or sensor-aware modules becomes a drop-in upgrade rather than a hard requirement.
2. **Transparent diagnostics** – Every response carries combined architect/extractor diagnostics so marketing, support, and ops can trace low-confidence paths without digging through logs, now with section-level hints describing which heading produced each value.【F:active-development/packages/core/src/resolvers.ts†L78-L258】【F:active-development/packages/core/src/index.ts†L96-L169】
3. **WMA-aligned extensibility** – Teams can ship their own `ArchitectAgent` or `ExtractorAgent` implementations (CrewAI, LangGraph, on-prem GPUs) by calling `setArchitect`/`setExtractor`, keeping structure flexible.
4. **No rigid kernel dependency** – We deliberately avoided a monolithic orchestrator. The exported abstractions are simple functions/interfaces, encouraging experimentation and incremental hardening.

## 4. Recommended Rollout Steps
### Phase A – SDK & API Sync
- Update `packages/api` to depend on `@parserator/core` for SearchPlan generation so diagnostics stay consistent across environments.
- Refresh the Node SDK to surface `metadata.diagnostics` and propagate the `LOW_CONFIDENCE` warning when fallbacks are disabled.【F:active-development/packages/core/src/index.ts†L121-L156】

### Phase B – Website & Storytelling
- Highlight the “works offline, upgrade when ready” narrative on parserator.com to mirror EMA/WMA messaging.
- Publish quickstarts for vibe coders (local heuristics) and business ops (swapping in governed modules).

### Phase C – Future Enhancements
- Introduce optional streaming hooks so agents can observe extraction progress for long documents.
- Promote a resolver authoring guide covering section heuristics, new validation types (currency/percentage/address/name), and how to distribute community packs safely.【F:active-development/packages/core/src/heuristics.ts†L1-L146】【F:active-development/packages/core/src/resolvers.ts†L78-L365】
- Document session-oriented recipes (e.g., batched inbox parsing, localized sensor calibration) to show how cached plans reduce latency and token spend for EMA-aligned operators.【F:active-development/packages/core/src/index.ts†L145-L357】
- Ship curated module packs: e.g., `@parserator/core-vision` for ND sensor arrays, `@parserator/core-finance` for ledger-style records.
- Partner with EMA community builders to certify open modules, reinforcing the right-to-leave ethos.

## 5. Implementation Checklist
- [x] Replace monolithic stub with configurable, documented core.
- [x] Provide default modules that require zero external credentials.
- [ ] Wire the API/SDK to consume the shared pipeline (follow-up work).
- [ ] Design landing page updates spotlighting the lean core and autonomy principles.

The refactor lands a usable ancestor for the eventual sensor-grade kernel without overwhelming today’s adopters. It keeps Parserator nimble, honest, and ready for the coming wave of agent-powered integrations.
