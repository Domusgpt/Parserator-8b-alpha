# Lean Orchestration Runbook

This runbook translates `recommendedActions` emitted by `/v1/lean/snapshot` into
repeatable operational steps. Share it with Claude plugin operators so the
status command produces actionable outcomes.

## When snapshots report errors

### `Investigate recent plan rewrite error`
1. Use `/parserator-status --json` to capture the latest snapshot and copy the
   `requestId`.
2. Query the telemetry store for `plan:rewrite` events with the same `requestId`
   to retrieve the failed payload.
3. Check `lastError` for Gemini API details. If the error references quota,
   disable plan rewrite via the admin console and notify the LLM quota owner.
4. Re-enable lean plan rewrite once telemetry shows two successful rewrites in a
   row.

### `Investigate recent field fallback error`
1. Run `/parserator-status` to confirm the `lastError` string and affected field.
2. Look up the matching `field:fallback` telemetry for the provided `requestId`
   and capture the Gemini response payload.
3. File a bug with the lean resolver owner including the payload and schema that
   triggered the fallback.
4. If three consecutive fallbacks fail, disable lean fallbacks and switch to
   deterministic heuristics until a fix is deployed.

## When lean features are disabled

### `Enable lean plan rewrite when ready to exercise the hybrid planner`
1. Verify staging traffic keeps the queue idle for 48 hours.
2. Confirm quota and billing approvals for the target Gemini project.
3. Call the admin configuration endpoint or deploy the Firebase config change to
   enable `leanPlanRewrite.enabled = true`.
4. Monitor `/parserator-status` for one hour to ensure cooldowns stay inactive.

### `Enable lean field fallback to provide last-chance coverage for required fields`
1. Confirm `ParseratorLeanLLMFieldFallbackState.queue.pending` is `0` and
   `failures` have not increased for 48 hours in staging.
2. Announce the enabling plan in the ops channel with a 30 minute warning.
3. Flip `leanFieldFallback.enabled = true` in the ParseService configuration and
   redeploy.
4. Monitor the fallback queue size for the first 20 production requests.

## Routine monitoring

- **Queue backlog**: If either queue’s `pending` metric exceeds 10 for more than
  5 minutes, alert the on-call engineer and pause lean rollouts.
- **Cooldown storms**: Two consecutive snapshots with
  `planRewriteState.pendingCooldown = true` indicates rewrites are thrashing.
  Disable plan rewrite until the root cause is found.
- **Telemetry gaps**: If the plugin cannot fetch a snapshot for 5 minutes,
  verify Firebase authentication and audit API gateway logs before retrying.

## Escalation matrix

| Issue | Escalate to | SLA |
| --- | --- | --- |
| Gemini quota exceeded | LLM platform owner | 1 hour |
| Persistent fallback failures | Lean resolver maintainer | 4 hours |
| Snapshot endpoint errors | API on-call engineer | 30 minutes |

Keep this runbook in sync with `ParseService.getLeanOrchestrationSnapshot`
changes to guarantee plugin users receive consistent instructions.
