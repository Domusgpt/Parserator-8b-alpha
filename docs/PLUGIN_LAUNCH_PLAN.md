# Lean Plugin Launch Plan

## Purpose
This plan prepares Parserator's lean LLM orchestration to ship as a Claude Code plugin the moment we mark the hybrid stack GA. It captures the readiness signals emitted by the API, the background observability hooks in the core, and the release steps we need to follow so the plugin can be added to a marketplace without surprises.

## Current Readiness Signals
- **ParseService snapshot API** – `getLeanOrchestrationSnapshot()` now aggregates queue health, cooldown state, and recommended operator actions in a single call, giving the plugin a deterministic way to decide whether lean rewrites or fallbacks should appear as enabled features.【F:active-development/packages/api/src/services/parse.service.ts†L81-L96】【F:active-development/packages/api/src/services/parse.service.ts†L384-L440】
- **Integration tests** – Regression coverage asserts both the disabled baseline and the enabled idle path so plugin automation can trust the snapshot contract when gating UI toggles or command availability.【F:active-development/packages/api/src/test/parse.integration.test.ts†L1-L142】【F:active-development/packages/api/src/test/parse.integration.test.ts†L190-L232】
- **Core telemetry** – The lean plan rewrite and field fallback states surface queue metrics, cooldown windows, and last errors so the plugin can surface human-readable diagnostics alongside Claude command output.【F:active-development/packages/core/src/types.ts†L204-L327】【F:active-development/packages/core/src/telemetry.ts†L120-L242】

## Launch Checklist
1. **Marketplace scaffolding** – Prepare the `.claude-plugin` manifests plus `commands/` instructions mirroring the ParseService snapshot output. Reuse the Quickstart steps in the Claude Code plugin reference for local validation. **Status:** ✅ Local marketplace and plugin live under `claude/plugins/dev-marketplace` with snapshot-aware commands ready for testing.【F:claude/plugins/dev-marketplace/.claude-plugin/marketplace.json†L1-L11】【F:claude/plugins/dev-marketplace/parserator-lean-orchestration/commands/parserator-status.md†L1-L24】
2. **Snapshot contract freeze** – Lock the `ILeanOrchestrationSnapshot` shape and document it in the SDK/API changelog. Any future changes must remain backwards compatible for installed plugins. **Status:** ✅ Documented in `docs/API_CHANGELOG.md` with links to the frozen TypeScript contract and admin endpoint implementation.【F:docs/API_CHANGELOG.md†L1-L16】
3. **Plugin command wiring** – Implement `/parserator-status` to call the snapshot endpoint and `/parserator-parse` to forward parse requests with lean features toggled based on readiness flags. **Status:** ✅ Helper scripts under `claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/` now drive both calls so Claude commands and CI smoke tests share the same execution path.【F:claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/parserator-status.mjs†L1-L110】【F:claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/parserator-parse.mjs†L1-L108】
4. **Operational runbook** – Translate `recommendedActions` into actionable on-call tasks so plugin users know when to escalate versus retry.
5. **Marketplace submission** – Package the plugin into the target marketplace and publish release notes detailing the lean orchestration requirements and fallback behaviour.

## Immediate Next Steps
- ✅ Finalised API authentication for the snapshot route by exposing `/v1/lean/snapshot` behind the existing admin API-key guard, ensuring operators can query queue health without broad privileges.【F:active-development/packages/api/src/index-full.ts†L248-L294】
- ✅ Stubbed a local marketplace in `claude/plugins/dev-marketplace` with Parserator commands so the Claude workflow can be tested end-to-end before publishing.【F:claude/plugins/dev-marketplace/.claude-plugin/marketplace.json†L1-L11】【F:claude/plugins/dev-marketplace/parserator-lean-orchestration/README.md†L1-L23】
- Coordinate with marketing to announce plugin availability once telemetry stays green for a full week of staging traffic.

## Go/No-Go Criteria
- ✅ Snapshot responses show both lean queues idle for 48 hours under staging load.
- ✅ No unresolved `recommendedActions` mentioning errors in the previous 24 hours.
- ✅ Gemini usage limits confirm sufficient quota for plugin-driven traffic.
- ✅ Documentation and README updated with plugin installation path and troubleshooting tips.

## Post-Launch Monitoring
- Subscribe the plugin command handler to telemetry webhooks so queue backlogs or cooldown thrash emit alerts.
- Review usage weekly to ensure lean fallbacks stay under the cost guardrails defined for the hybrid release.
- Iterate on `recommendedActions` strings as ops feedback rolls in so plugin prompts remain actionable.
