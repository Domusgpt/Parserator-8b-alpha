# Lean LLM Integration Snapshot

## Current Implementation Highlights
- **Core resolver gating and reuse.** `ParseratorCore` can hot-swap the lean resolver and exposes runtime overrides; the resolver itself gates on plan confidence and per-parse budgets while caching shared extractions for reuse.【F:packages/core/src/index.ts†L193-L228】【F:packages/core/src/resolvers.ts†L458-L640】【F:packages/core/src/resolvers.ts†L640-L809】
- **Fallback telemetry and playbook export.** Extractor metadata now carries both the fallback usage summary and a structured playbook payload derived from the active plan and runtime limits.【F:packages/core/src/extractor.ts†L148-L214】【F:packages/core/src/lean-llm-playbook.ts†L1-L125】
- **API wiring and Gemini client.** `ParseService` merges configuration overrides, instantiates the Gemini-backed `LeanLLMClient`, and registers the resolver with budget and gating options when enabled.【F:packages/api/src/services/parse.service.ts†L43-L129】【F:packages/api/src/services/parse.service.ts†L330-L461】【F:packages/api/src/services/lean-llm-client.ts†L1-L205】
- **Developer tooling.** The Claude Code plugin packages commands and a helper agent that consume the exported playbook for subagent launches.【F:parserator-extensions/claude-plugin/README.md†L1-L34】

## Outstanding Work Before Launch
1. **Production configuration & rollout guardrails**  
   - Decide default enablement and provide environment-driven toggles; the resolver is still disabled by default in `ParseService.DEFAULT_CONFIG`.【F:packages/api/src/services/parse.service.ts†L73-L117】
   - Define per-tenant budgets/plan gates so runtime overrides map cleanly to customer SLAs.
   - Ensure cloud deployment templates propagate Gemini credentials and lean runtime knobs.

2. **End-to-end validation**  
   - Exercise staging parses against Gemini with representative documents to confirm prompt format, JSON parsing, and shared extraction reuse paths.  
   - Add integration smoke tests (or a canary script) that run the API with lean fallback enabled to catch regressions beyond the existing unit specs.【F:packages/core/src/__tests__/lean-llm-resolver.test.ts†L1-L160】

3. **Observability and alerting**  
   - Wire resolver usage metrics (`parserator-core:lean-llm-resolver-*`) into central monitoring and set alerts on error/skipped counts.  
   - Extend API logging dashboards to visualise playbook fields (resolved vs skipped, budget consumption) for launch readiness.【F:packages/core/src/resolvers.ts†L462-L732】

4. **Documentation & SDK polish**  
   - Publish public-facing docs covering lean fallback configuration, runtime overrides, and playbook consumption (README currently only mentions the plugin at a high level).【F:parserator-extensions/claude-plugin/README.md†L1-L34】
   - Update SDK examples to demonstrate per-request `leanLLM` overrides and interpreting the playbook payload.【F:packages/sdk-node/src/types/index.ts†L188-L214】

## Testing & Relaunch Timeline
- **Week 0–1: Controlled staging soak.** Enable lean fallback in a staging environment, run scripted parses, and monitor usage/latency. Capture baseline telemetry for the new metrics and adjust budgets before widening rollout.
- **Week 1–2: Beta client rollout.** Opt in a small cohort via profile or runtime overrides, using the playbook outputs to guide manual review. Confirm SDK consumers handle the expanded metadata.
- **Week 2+: Full launch readiness.** Once staging and beta metrics stabilise, flip the production toggle, publish external documentation, and coordinate with the Claude plugin release for coordinated messaging.

