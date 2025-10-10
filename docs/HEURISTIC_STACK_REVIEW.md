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

## Lean LLM Fallback Bridge
The new lean LLM resolver plugs into the existing resolver registry so heuristics continue to run first. Only after JSON, section, and loose key/value strategies fail for a required field does the fallback stage fire. When that happens the resolver gathers unresolved required fields from the active plan, skips keys that already resolved heuristically, and calls an external client once per parse. Results are cached in the shared resolver map so subsequent fields reuse the same response without issuing another network request.

- **Async discipline:** The resolver schedules LLM calls through the shared async task queue, preserving back-pressure controls and telemetry-friendly metrics. Cooldowns guard against thrash inside a single parse, while the queue ensures background tasks never leak exceptions up the stack.
- **Optionality guardrails:** By default only required fields participate; callers can opt in optional keys when workloads demand it. Diagnostics capture when the fallback is skipped, invoked, or fails so operators know exactly when a model participated.
- **Swap-friendly client:** The resolver speaks to a lightweight `LeanLLMClient` contract, making it trivial to bolt on inexpensive APIs (e.g., Gemini Flash, Claude Haiku) as last-chance extractors. Because the underlying planner and extractor remain deterministic, teams can trial the hybrid mode without rewriting existing heuristics or telemetry pipelines.
