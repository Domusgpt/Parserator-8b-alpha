---
description: Run a Parserator parse with lean orchestration awareness.
---

# /parserator-parse

Execute this command to parse structured data via the Parserator API while respecting the lean
orchestration readiness captured by `/parserator-status`.

1. If you do not already have a fresh snapshot, call `/parserator-status` first and reuse its
   response to understand whether lean plan rewrites or field fallbacks are enabled.
2. Use the `parserator-parse` helper (or `node scripts/parse.mjs`) so the CLI handles the POST payload
   for `${base}/v1/parse` (where `base` mirrors `$PARSERATOR_API_BASE` and defaults to
   `https://app-5108296280.us-central1.run.app`). Provide:
   - `--input` or `--input-file`: the raw document to parse.
   - `--schema` or `--schema-file`: JSON schema describing expected keys.
   - Optional `--instructions` or `--instructions-file` for heuristic guidance.
   The helper automatically sets `options.includeMetadata=true` so diagnostics, telemetry, and request
   IDs are included in the response and reuses the latest snapshot when an admin key is available.
3. The helper sends the request with header `Authorization: Bearer $PARSERATOR_API_KEY` and
   `Content-Type: application/json`.
4. On success, report the parsed payload, confidence, processing time, and whether lean plan rewrite
   and field fallback features were enabled according to the latest snapshot. Highlight any
   diagnostics or warnings returned by the API.
5. If the API responds with an error, surface the HTTP status code, error payload, and suggest
   consulting `/parserator-status` for recovery steps instead of retrying blindly.

Always include the response `metadata.requestId` in your summary so downstream tooling can trace the
operation across telemetry streams.
