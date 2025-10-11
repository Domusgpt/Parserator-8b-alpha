# Parserator Heuristic Pipeline Assessment

## Deterministic Core Composition
ParseratorCore bootstraps a deterministic pipeline that wires the heuristic architect, the regex-oriented extractor, and a resolver registry while layering plan caching, telemetry, and profile overrides. Constructors accept interceptors, preprocessors, and postprocessors so agents can compose functionality without rewriting the kernel.

The architect blends schema metadata, caller instructions, and lightweight domain detection into per-field search plans. Optional fields and caller hints become structured diagnostics so downstream stages keep context about why a heuristic was selected.

## Planner & Extractor Heuristics
Planner heuristics normalise keys, merge instruction hints, and detect domain contexts to emit step-by-step search plans. Every schema key receives a structured plan without invoking an LLM, keeping output deterministic and debuggable.

Extraction flows through layered resolvers (JSON path, section scoring, key/value heuristics, and type-specific regex matchers) so common data classes—dates, amounts, names, addresses—resolve without model calls. Resolver chaining keeps execution fast while surfacing token counts and diagnostics.

## Asynchronous Architecture Synergy
The async plan cache queue serialises persistence, exposes per-queue metrics (pending, in-flight, successes, failures, duration), and surfaces attempt reasons so observers can distinguish storage saturation from transient blips. Auto-refresh work piggybacks on the same telemetry contracts, reporting queued, skipped, and completed refresh actions without blocking callers.

Sessions expose `waitForIdleTasks()` and `getBackgroundTaskState()` so agents can deterministically drain background work or poll readiness. Combined with plan export/import helpers, this keeps cached heuristics portable across runtimes.

## Effectiveness & Competitiveness
- **Usefulness:** For structured and semi-structured inputs the deterministic heuristics deliver fast parses, rich diagnostics, and cache reuse—all without LLM latency.
- **Elegance:** The architecture isolates asynchronous work, maintains immutability guarantees for cached plans, and keeps resolver chains composable.
- **Competitiveness:** Few rule-first parsers offer instruction-aware planning, contextual hints, reusable plan caches, and unified telemetry. Parserator’s approach balances deterministic parsing with agent-friendly observability, making it competitive against heavier orchestration stacks.

## Efficiency Outlook
The queue metrics and auto-refresh telemetry provide immediate signals for optimisation, while deterministic planners keep compute predictable. Future enhancements can dial concurrency or swap caches without disturbing the observable contracts surfaced today.

## Lean LLM Plan Rewrite Bridge
The lean LLM bridge now wraps the architect instead of the extractor. Heuristics still generate the initial plan, but when confidence falls below the configured floor the hybrid architect enqueues a plan rewrite through the async task queue. The rewrite preserves deterministic defaults: the queue enforces concurrency, cooldowns prevent repeated calls on noisy inputs, and diagnostics record when the model is skipped, applied, or fails.

- **Async discipline:** Rewrite requests share the same queue metrics, error handling, and idle hooks as cache persistence, keeping background orchestration observable and recoverable.
- **Confidence guardrails:** Thresholds derive from the core config and per-request overrides, so the LLM only participates when heuristics admit uncertainty. Cooldown windows ensure the system stabilises before issuing another rewrite.
- **Swap-friendly client:** The bridge talks to a lightweight `LeanLLMPlanClient`, letting teams experiment with inexpensive models without forking the core. Because plans are still cached and exported, the hybrid mode remains portable across sessions and runtimes.
- **Telemetry parity:** A `plan:rewrite` telemetry series broadcasts lifecycle actions alongside queue state, confidence thresholds, and usage data, giving operators the same observability guarantees they rely on for cache and auto-refresh instrumentation.
- **Stateful introspection:** Both the hybrid architect and `ParseratorCore.getLeanLLMPlanRewriteState()` report cooldown status, last success/failure timestamps, and queue/backlog counts so agents can reason about LLM utilisation without scraping logs.
