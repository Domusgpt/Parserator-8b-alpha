---
description: Inspect Parserator lean orchestration readiness before exposing lean toggles.
---

# /parserator-status

Use this command to audit Parserator's lean LLM orchestration queues and summarise recommended
operator actions for Claude Code users.

1. Set `base` to the value of `$PARSERATOR_API_BASE` or default to
   `https://app-5108296280.us-central1.run.app` when the variable is undefined.
2. Issue an authenticated `GET` request to `${base}/v1/lean/snapshot` with the HTTP header
   `Authorization: Bearer $PARSERATOR_ADMIN_API_KEY`.
3. Parse the JSON response. It includes:
   - `snapshot.planRewriteState` and `snapshot.fieldFallbackState` objects with queue metrics,
     cooldown timers, and last error information.
   - `snapshot.readinessNotes` and `snapshot.recommendedActions` arrays describing launch readiness.
   - `requestId` for observability.
4. Summarise queue health, cooldown windows, backlog depth, and any pending recommended actions. Call
   out whether lean plan rewrites and field fallbacks are ready to be enabled for customers.
5. If the request fails, surface the HTTP status, response body, and next diagnostic steps instead of
   guessing.

Always include the raw `requestId` in your summary so operators can trace the snapshot in telemetry.
