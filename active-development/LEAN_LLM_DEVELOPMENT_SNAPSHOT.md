# Lean LLM Integration Snapshot

## Current Coverage
- **Core fallback pipeline is feature-complete.** `LeanLLMResolver` now honours planner confidence gates, invocation/token budgets, and shared extraction reuse before deciding whether to hit the model, while logging the outcome for every field. 【F:active-development/packages/core/src/resolvers.ts†L620-L739】
- **API wiring exposes runtime controls.** `ParseService` merges default and per-request options, instantiates the lean Gemini client when enabled, and feeds the resolver limits into `ParseratorCore`, keeping the fallback hot-swappable at runtime. 【F:active-development/packages/api/src/services/parse.service.ts†L118-L219】【F:active-development/packages/api/src/services/parse.service.ts†L360-L459】
- **Playbook telemetry is ready for agents.** The playbook builder packages plan context, budgets, per-field outcomes, and the spawn command that Claude’s plugin consumes. 【F:active-development/packages/core/src/lean-llm-playbook.ts†L20-L194】
- **Claude Code plugin delivers the workflow.** Commands and a subagent brief interpret the playbook so Claude can request fallback reruns and spawn helpers that respect budgets. 【F:active-development/parserator-extensions/claude-plugin/README.md†L1-L34】

## Remaining Gaps Before Enabling by Default
1. **Production configuration & secrets.** Roll Gemini API credentials and resolver defaults into the deployment config, then flip `leanLLM.enabled` to `true` once staging verifies latency and budget ceilings. 【F:active-development/packages/api/src/services/parse.service.ts†L125-L136】
2. **End-to-end coverage.** Add API contract tests that submit inputs which force heuristic misses to confirm lean fallback invocation, shared extraction reuse, and failure reporting are stable across the Firebase wrapper.
3. **Operational telemetry.** Pipe the new fallback usage summary and playbook headline into dashboards or alerting so we can spot budget exhaustion and high skip rates; the resolver already emits structured logs we can forward. 【F:active-development/packages/core/src/resolvers.ts†L688-L735】【F:active-development/packages/core/src/lean-llm-playbook.ts†L134-L165】
4. **Plugin packaging & onboarding.** Promote the local Claude plugin to your shared marketplace (or ship installation docs) so agent teams can access `/lean-fallback` without cloning the repo. 【F:active-development/parserator-extensions/claude-plugin/README.md†L11-L20】

## Testing & Relaunch Timeline
| Phase | Goal | Owner checklist |
| --- | --- | --- |
| **Week 0 – Staging bring-up** | Configure Gemini credentials, enable lean fallback in staging, and confirm baseline heuristics still pass. | ✅ Run `npm run build` in `@parserator/core` and `@parserator/api`; ✅ execute `npm test` for `@parserator/core` to ensure resolver specs stay green. 【F:AGENTS.md†L5-L18】 |
| **Week 1 – Hybrid validation** | Exercise API endpoints with heuristic edge cases plus Claude plugin flows to capture playbooks and budget skips. | Capture parse metadata diffs, verify `/lean-fallback` reflects shared extractions, and log token/ invocation totals for budgeting. |
| **Week 2 – Launch rehearsal** | Harden observability, document rollout toggles, and rehearse disable/enable using `configureLLMFallback`. | ✅ Re-run core/API builds, ✅ smoke the Node SDK so telemetry types stay aligned, then freeze dependencies ahead of release. 【F:AGENTS.md†L5-L18】 |

## Relaunch Readiness Signals
- Staging parse logs show lean fallback invoked only on low-confidence plans and respecting budgets (no `skipped-limit` spikes). 【F:active-development/packages/core/src/resolvers.ts†L688-L737】
- Parse responses consistently include `metadata.fallback.leanLLMPlaybook`, and Claude plugin runs without manual tweaks. 【F:active-development/packages/core/src/lean-llm-playbook.ts†L44-L165】【F:active-development/parserator-extensions/claude-plugin/README.md†L1-L34】
- Operations confirms on-call procedures for toggling `configureLLMFallback` in production and tracking usage dashboards.

Once these checkpoints pass, start the relaunch communications, cut a release candidate, and schedule broader regression testing ahead of public announcement.
