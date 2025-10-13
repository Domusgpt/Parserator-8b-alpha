# Parserator Lean Orchestration Plugin

This Claude Code plugin exposes operational commands for Parserator's lean LLM orchestration.
It ships alongside the API snapshot endpoint so operators can decide when the hybrid plan rewrite
and field fallback features are safe to enable for customers.

## Commands

- `/parserator-status` — Fetches the lean orchestration snapshot from the API and summarises queue
  health, cooldowns, and recommended actions before surfacing guidance for Claude users. Backed by
  the `parserator-status` CLI helper for consistent output.
- `/parserator-parse` — Sends a parse request to the API while respecting readiness guidance from the
  latest snapshot. The command calls the `parserator-parse` helper which automatically includes
  metadata, echoes request IDs, and surfaces lean readiness in the summary.

Both commands can be executed directly from the command line after installing dependencies:

```bash
cd claude/plugins/dev-marketplace/parserator-lean-orchestration
npm install # not strictly required, but enables npx bin resolution

# Snapshot summary
PARSERATOR_ADMIN_API_KEY=... node scripts/status.mjs --json

# Parse a document using file paths
PARSERATOR_API_KEY=... \
  PARSERATOR_ADMIN_API_KEY=... \
  node scripts/parse.mjs \
  --input-file ./fixtures/sample-input.txt \
  --schema-file ./fixtures/sample-schema.json
```

## Configuration

Set the following environment variables inside Claude Code before installing from the local
marketplace:

- `PARSERATOR_API_BASE` — Base URL for the Parserator API (defaults to the production URL if unset).
- `PARSERATOR_ADMIN_API_KEY` — Admin-level API key (used for `/parserator-status`).
- `PARSERATOR_API_KEY` — Standard API key for running parses via `/parserator-parse`.

Both commands assume JSON responses from the API and will request telemetry snapshots before issuing
lean-enabled parse calls. Review `docs/PLUGIN_LAUNCH_PLAN.md` for the go/no-go checklist and
`docs/LEAN_ORCHESTRATION_RUNBOOK.md` for remediation guidance.
