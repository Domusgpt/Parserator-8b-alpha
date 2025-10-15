# Parserator Lean Orchestration Plugin

This Claude Code plugin exposes operational commands for Parserator's lean LLM orchestration.
It ships alongside the API snapshot endpoint so operators can decide when the hybrid plan rewrite
and field fallback features are safe to enable for customers.

## Commands

- `/parserator-status` — Fetches the lean orchestration snapshot from the API and summarises queue
  health, cooldowns, and recommended actions before surfacing guidance for Claude users. The helper
  script `scripts/parserator-status.mjs` performs the underlying HTTP call so you can validate the
  command locally or from CI without launching Claude.
- `/parserator-parse` — Sends a parse request to the API while respecting readiness guidance from the
  latest snapshot. The `scripts/parserator-parse.mjs` utility forwards JSON payloads and prints
  metadata, confidence, and diagnostics so plugin testers can capture full responses.

## Configuration

Set the following environment variables inside Claude Code before installing from the local
marketplace (they are also required by the helper scripts):

- `PARSERATOR_API_BASE` — Base URL for the Parserator API (defaults to the production URL if unset).
- `PARSERATOR_ADMIN_API_KEY` — Admin-level API key (used for `/parserator-status`).
- `PARSERATOR_API_KEY` — Standard API key for running parses via `/parserator-parse`.

Both commands assume JSON responses from the API and will request telemetry snapshots before issuing
lean-enabled parse calls. Review `docs/PLUGIN_LAUNCH_PLAN.md` for the go/no-go checklist.

## Packaging for Launch

1. From the repository root run `./claude/plugins/package-lean-plugin.sh`.
2. Upload the generated tarball under `claude/plugins/dist/` to your Claude marketplace.
3. Paste the accompanying release notes file into the submission form and attach
   `docs/LEAN_PLUGIN_RUNBOOK.md` for on-call guidance.
