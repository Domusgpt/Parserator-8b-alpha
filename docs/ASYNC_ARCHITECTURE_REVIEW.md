# Parserator Core Asynchronous Architecture Review

## Overview
The Parserator core now coordinates background work through two dedicated channels:

1. A serialized plan cache queue that persists architect outputs without blocking request/response flows.
2. An auto-refresh orchestrator that evaluates session health and rehydrates plans asynchronously when confidence or usage heuristics demand it.

These flows share telemetry emitters and expose explicit lifecycle hooks so downstream agents can monitor performance and drain outstanding tasks deterministically.

## Plan Cache Persistence
- `ParseratorSession` enqueues cache writes through `createAsyncTaskQueue`, ensuring all persistence is single-threaded while allowing parses to resolve immediately. Each enqueue now records attempt counts, duration, and reason metadata so diagnostics remain accurate even when persistence fails.
- Consumers can now call `getBackgroundTaskState()` to inspect pending writes, last attempt timestamps, and error state, and `waitForIdleTasks()` to flush the queue before tearing down a session.
- Background diagnostics expose pending vs. in-flight writes, lifetime success/failure counts, and the last persistence duration, making it easier to spot storage regressions or saturation.
- The queue remains resilient because enqueued tasks isolate their own rejection paths, allowing the pipeline to continue after transient storage failures.

## Auto-Refresh Scheduling
- Auto-refresh checks run after every parse without blocking the caller. When a refresh is triggered, the session captures the trigger reason, cooldown state, and pending status while tracking the in-flight promise count.
- Background metrics flow through the new `getBackgroundTaskState()` surface, letting agents observe when refreshes are queued, running, or cooling down.
- Telemetry remains consistent via the shared `createPlanCacheTelemetryEmitter`, so operational dashboards see matching metadata for cache hits, misses, stores, deletes, clears, and auto-refresh lifecycle events.

## Elegance & Efficiency Assessment
- **Isolation without starvation:** Serialization through the async queue eliminates cache race conditions while keeping the hot path non-blocking. Idle resolution guarantees (`onIdle`) make coordination deterministic for tests and hosted services, while concurrency controls keep future scaling options open.
- **Observability-first design:** Background diagnostics combine telemetry events with synchronous inspection APIs (`snapshot`, `getAutoRefreshState`, `getBackgroundTaskState`), reducing the need for log scraping when investigating latency outliers.
- **Failure containment:** Cache write failures surface as telemetry warnings and as structured state (`lastPersistError`), so agents can decide whether to retry, fall back, or escalate without guessing.
- **Graceful scalability:** Because auto-refresh runs independently of cache persistence, longer-running refresh operations do not delay cache writes, and vice versa. This separation keeps throughput stable even under aggressive refresh heuristics.

## Competitiveness
Compared to typical LLM orchestration kernels, Parserator’s approach now offers:

- Deterministic background draining (`waitForIdleTasks`) akin to job queues used in production agent frameworks, paired with per-queue metrics for capacity planning.
- Structured introspection for cache and refresh lifecycles, a feature rarely available without custom instrumentation in competing parsing SDKs.
- Unified telemetry contracts for cache and auto-refresh events, simplifying integration with monitoring stacks (e.g., DataDog, OpenTelemetry).

These additions keep the architecture portable and agent-friendly while maintaining performance parity with more heavyweight orchestration layers.

## Lean LLM Plan Rewrite Orchestration
The hybrid architect keeps heuristics on the hot path while offering a guarded LLM escape hatch. When heuristic confidence dips below the configured floor, the session enqueues a rewrite request through `createAsyncTaskQueue`, so concurrency limits, error handling, and telemetry mirrors match the rest of the background work. Cooldown tracking prevents thrash, queue metrics expose pending vs. in-flight rewrites, and diagnostics surface whenever the model is skipped, invoked, or fails—keeping the hybrid mode observable and deterministic.

- **First-class telemetry:** A dedicated `plan:rewrite` stream now emits `queued`, `started`, `applied`, `skipped`, and `failed` actions with queue metrics, thresholds, and usage data so monitoring dashboards can distinguish when the lean model participates versus when heuristics stay in control.
- **Operational introspection:** `createHybridArchitect` and `ParseratorCore.getLeanLLMPlanRewriteState()` surface cooldown status, last attempt timestamps, and queue statistics, giving agents the same visibility they already enjoyed for cache persistence and auto-refresh flows.

## Lean LLM Field Fallback Execution
The extractor’s new lean resolver shares the async queue primitives so LLM fallbacks for unresolved fields stay observable and non-blocking. Each parse seeds a shared promise that batches pending fields, queues the model call, and replays the structured response back into the resolver chain.

- **Queue-aware resolver:** `createLeanLLMFieldResolver` wraps the fallback client with `createAsyncTaskQueue`, recording attempts, successes, failures, and last-error metadata while allowing heuristics to continue unabated when the model is unavailable.
- **Telemetry parity:** Every enqueue emits a `field:fallback` event—`queued`, `started`, `resolved`, `skipped`, or `failed`—with queue metrics, skip reasons, and usage data so ops teams can audit when the LLM bridge actually ran.
- **Deterministic sharing:** Results are cached in the resolver’s shared state so subsequent fields reuse the same LLM response without additional calls, keeping the async orchestration deterministic even when multiple fields need fallback support.
