# Lean Orchestration Plugin Runbook

This runbook translates the `recommendedActions` surfaced by the lean orchestration snapshot
into concrete operational steps. Use it when `/parserator-status` highlights required follow-up
before toggling the lean plan rewrite or field fallback features for customers.

## How to use this document
1. Run `/parserator-status` (or execute `claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/parserator-status.mjs`).
2. Review the `recommendedActions` array in the response.
3. Match each message to the guidance below and perform the remediation steps.
4. Remember the `/parserator-parse` helper refuses to run while investigation actions remain; supply `--force` only when you intentionally need to probe failure scenarios.
5. Re-run the status command to confirm the snapshot reports a healthy state.

## Action Guide

### "Enable lean plan rewrite when ready to exercise the hybrid planner."
1. Confirm staging telemetry shows the plan rewrite queue idle for the last 48 hours.
2. Update the ParseService configuration (`leanPlanRewrite.enabled = true`) via the service
   management console or deployment config.
3. Trigger a smoke parse through `/parserator-parse` and verify that `planRewriteState.enabled`
   reports `true` with no pending cooldown.

### "Investigate recent plan rewrite error: <details>"
1. Capture the `<details>` substring from the recommended action to identify the failing request ID.
2. Query the ParseService logs filtered by `operation: 'plan-rewrite'` and the request ID to
   inspect the Gemini response and queue metrics.
3. If the error is reproducible, disable `leanPlanRewrite.enabled` to stop additional retries and
   file an incident with the captured diagnostics.
4. Once mitigated, clear the plan rewrite queue via `ParseratorCore.getLeanLLMPlanRewriteState()`
   to ensure no stale work remains before re-enabling the feature.

### "Enable lean field fallback to provide last-chance coverage for required fields."
1. Validate that plan rewrite is already enabled and stable; field fallbacks depend on the same
   lean infrastructure and should trail plan rewrites by at least one release.
2. Toggle `leanFieldFallback.enabled = true` in the ParseService configuration and redeploy if
   required.
3. Execute `/parserator-parse` with a payload that previously triggered heuristic misses and
   confirm the response metadata lists `field:fallback` telemetry entries.

### "Investigate recent field fallback error: <details>"
1. Record the `<details>` text to extract the failing task ID.
2. Inspect ParseService logs for `operation: 'field-fallback'` entries and gather the request
   payload plus Gemini transcript.
3. Pause lean field fallbacks by disabling `leanFieldFallback.enabled` if the issue persists to
   prevent repeated failures.
4. Open a ticket with the captured diagnostics and coordinate with the heuristic team to determine
   whether the resolver prompt or schema instructions require updates.

### "Monitor telemetry to confirm queues stay healthy as traffic ramps."
1. No immediate action required; leave lean features enabled.
2. Schedule follow-up status checks every hour during the ramp period.
3. Subscribe the operations channel to telemetry alerts for queue backlog thresholds to catch any
   regressions early.

## Escalation Paths
- **Ops On-Call** – Handles queue health issues, cooldown loops, or repeated model failures.
- **Heuristics Team** – Engages when fallback results diverge from schema expectations or prompt
  templates require adjustments.
- **Platform Team** – Coordinates Gemini quota expansions when usage forecasts exceed configured
  guardrails.

Keep this runbook alongside the [Plugin Launch Plan](PLUGIN_LAUNCH_PLAN.md) so on-call engineers
can cross-reference readiness criteria before promoting the plugin in Claude marketplaces.
