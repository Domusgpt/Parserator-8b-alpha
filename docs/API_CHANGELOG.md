# Parserator API Changelog

This document captures externally visible API changes that Claude plugins, SDKs, and operator tools
must respect. All entries follow a "date – summary" format and link to the relevant implementation
sections for traceability.

## 2024-10-13 – Lean orchestration snapshot contract frozen
- Finalised the `ILeanOrchestrationSnapshot` interface exposed by `ParseService.getLeanOrchestrationSnapshot()`
  and documented its readiness notes plus recommended action semantics.【F:active-development/packages/api/src/services/parse.service.ts†L81-L116】【F:active-development/packages/api/src/services/parse.service.ts†L384-L440】
- Published the protected `/v1/lean/snapshot` endpoint for admin API keys so operational clients and
  Claude plugins can retrieve the contract directly.【F:active-development/packages/api/src/index-full.ts†L258-L294】
- Added helper scripts under `claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/`
  to exercise the snapshot and parse flows during marketplace validation runs.【F:claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/parserator-status.mjs†L1-L110】【F:claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/parserator-parse.mjs†L1-L108】

Future changes to the snapshot response must remain backwards compatible with this contract.
