---
description: Run a Parserator parse with lean orchestration awareness.
---

# /parserator-parse

Execute this command to parse structured data via the Parserator API while respecting the lean
orchestration readiness captured by `/parserator-status`.

1. If you do not already have a fresh snapshot, call `/parserator-status` first and reuse its
   response to understand whether lean plan rewrites or field fallbacks are enabled.
2. Build the POST payload for `${base}/v1/parse` (where `base` mirrors `$PARSERATOR_API_BASE` and
   defaults to `https://app-5108296280.us-central1.run.app`). Include:
   - `inputData`: the raw document to parse.
   - `outputSchema`: JSON schema describing expected keys.
   - Optional `instructions` for heuristic guidance.
   - Set `options.includeMetadata` to `true` so the response returns diagnostics, telemetry, and
     request IDs.
3. Send the request with header `Authorization: Bearer $PARSERATOR_API_KEY` and `Content-Type: application/json`.
4. On success, report the parsed payload, confidence, processing time, and whether lean plan rewrite
   and field fallback features were enabled according to the latest snapshot. Highlight any
   diagnostics or warnings returned by the API.
5. If the API responds with an error, surface the HTTP status code, error payload, and suggest
   consulting `/parserator-status` for recovery steps instead of retrying blindly.

Always include the response `metadata.requestId` in your summary so downstream tooling can trace the
operation across telemetry streams.
