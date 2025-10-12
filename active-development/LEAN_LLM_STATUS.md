# Lean LLM Integration Snapshot

_Last updated: 2025-10-12 18:30 UTC_

## Current surface area

### Core pipeline
- The `LeanLLMResolver` now enforces optional-field gating, plan-confidence thresholds, runtime budget limits, and shared-extraction reuse before dispatching a lightweight model, keeping calls strictly deterministic until the fallback is warranted.【F:active-development/packages/core/src/resolvers.ts†L433-L740】
- Extractor metadata clones the fallback usage summary and pipes it through a structured playbook generator so every parse response records budgets, field outcomes, and spawn commands for downstream agents.【F:active-development/packages/core/src/extractor.ts†L165-L184】【F:active-development/packages/core/src/lean-llm-playbook.ts†L1-L194】
- Focused unit tests exercise the resolver across success, optional-field skips, error diagnostics, reuse, and budget gates, documenting the intended behaviours ahead of integration testing.【F:active-development/packages/core/src/__tests__/lean-llm-resolver.test.ts†L1-L200】

### API + service wiring
- `ParseService` keeps lean fallback disabled by default but fully merges overrides, propagates per-request options, and reconfigures the core when toggled—ensuring runtime switches stay hot without redeploys.【F:active-development/packages/api/src/services/parse.service.ts†L120-L380】
- When enabled, the service instantiates the Gemini-backed `LeanLLMClient`, registers the resolver with plan gates and budget ceilings, and logs enable/disable transitions for ops visibility.【F:active-development/packages/api/src/services/parse.service.ts†L423-L460】
- The client prompts Gemini with plan context, enforces JSON-only replies, and parses shared extractions so one call can satisfy multiple schema fields while capturing model token usage.【F:active-development/packages/api/src/services/lean-llm-client.ts†L1-L200】

### SDK + agent ecosystem
- The Node SDK surfaces lean runtime overrides, fallback usage summaries, and the generated playbook on the public types so automations can reason about budgets and spawn helpers programmatically.【F:active-development/packages/sdk-node/src/types/index.ts†L1-L200】
- The bundled Claude plugin consumes the playbook metadata, exposes `/lean-fallback` and `/spawn-subagent`, and documents how Claude operators can trial the hybrid path locally today.【F:active-development/parserator-extensions/claude-plugin/README.md†L1-L34】

## Outstanding work

### 1. End-to-end validation (Immediate)
- Add ParseService-level integration tests that assert lean fallback metadata appears in API responses and respects plan gates, complementing the core-only unit coverage.【F:active-development/packages/core/src/__tests__/lean-llm-resolver.test.ts†L1-L200】
- Stand up a staging workflow that exercises ParseService with Gemini disabled/enabled to confirm hot reconfiguration and ensure failures degrade to heuristics cleanly.【F:active-development/packages/api/src/services/parse.service.ts†L120-L460】

### 2. Budget + telemetry hardening (Next 48 hours)
- Wire resolver usage metrics into existing telemetry exporters so budget skips and spawn command usage show up in dashboards alongside architect/extractor timings.【F:active-development/packages/core/src/resolvers.ts†L433-L740】【F:active-development/packages/core/src/extractor.ts†L165-L184】
- Define default invocation/token ceilings per environment and document the operational runbook for adjusting them without redeploying ParseService.【F:active-development/packages/api/src/services/parse.service.ts†L120-L460】

### 3. Client experience polish (Before beta relaunch)
- Expand SDK examples to demonstrate passing per-request lean runtime options and interpreting the playbook in custom agent loops.【F:active-development/packages/sdk-node/src/types/index.ts†L1-L200】
- Package the Claude plugin for marketplace submission and capture an installation screencast to unblock non-technical operators.【F:active-development/parserator-extensions/claude-plugin/README.md†L1-L34】
- Publish documentation clarifying when the lean fallback engages, including expected confidence ceilings when the model abstains.【F:active-development/packages/core/src/resolvers.ts†L630-L740】

### 4. Production readiness gates (Pre-launch)
- Run load tests comparing heuristic-only versus hybrid throughput to measure incremental latency and Gemini spend before setting SLA targets.【F:active-development/packages/core/src/resolvers.ts†L433-L740】
- Perform security and compliance reviews around Gemini usage (PII handling, logging retention) and update risk registers accordingly.【F:active-development/packages/api/src/services/lean-llm-client.ts†L1-L200】
- Finalise rollout toggles (feature flag or config endpoint) so marketing can control lean fallback availability during relaunch.【F:active-development/packages/api/src/services/parse.service.ts†L320-L460】

## Testing + relaunch timeline

1. **Week 0 (now)** – Implement ParseService integration tests, stage ParseService with lean fallback on/off, and confirm CI covers the new suites alongside existing core tests.
2. **Week 1** – Execute load and budget stress tests, validate telemetry feeds, and iterate on default ceilings based on observed Gemini usage.
3. **Week 2** – Roll the SDK + plugin guidance into public docs, secure sign-off from compliance, and freeze configuration knobs for launch.
4. **Relaunch readiness** – Once the above checkpoints are green, schedule a full regression run (core + API + SDK), rehearse the Claude plugin workflow, and prepare go/no-go review with marketing.
