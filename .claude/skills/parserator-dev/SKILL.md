---
name: Parserator Development Stewardship
description: Guides Claude Code through the Parserator-8b-alpha repository, covering architecture, documentation touchpoints, workflows, and validation gates. Use when answering questions about Parserator or making changes inside active-development packages, docs, or supporting operations material.
---

# Parserator Development Stewardship

## When to activate
- Tasks mention **Parserator**, the Architect→Extractor parsing pipeline, or directories under `active-development/`.
- You need orientation across the production docs in this repo before coding or summarising work.
- A teammate asks for step-by-step help running builds, tests, or release chores for Parserator artifacts.

> Always load the supporting references when deeper detail is required:
> - [reference.md](reference.md) → directory map, ownership, and primary entry points
> - [workflows.md](workflows.md) → command checklists per package
> - [quality-checks.md](quality-checks.md) → validation + documentation duties before shipping

## First-pass orientation checklist
1. Read the repo-level guardrails in [AGENTS.md](../../AGENTS.md) and keep WMA (Wide Market Autonomy) principles in mind: swappable modules, exposed diagnostics, documented exits.
2. Skim [README.md](../../README.md) and [NAVIGATION.md](../../NAVIGATION.md) to understand current launch status, open infrastructure fixes, and where neighbouring assets live.
3. For production context and tone, consult [PARSERATOR_PRODUCTION_CLAUDE.md](../../PARSERATOR_PRODUCTION_CLAUDE.md) and the strategy briefs in `docs/` (especially [docs/AGENTIC_RELAUNCH.md](../../docs/AGENTIC_RELAUNCH.md)).
4. Use the audits in `COMPLETE_PROJECT_AUDIT.md`, `CRITICAL_PROJECT_STATE.md`, and `SYSTEMS_VALIDATION_REPORT.md` when risk-checking or answering historical questions.
5. Treat `essential-context/` and marketing archives as read-only unless explicitly asked; they capture movement philosophy and outbound assets.

## Repository shape at a glance
- The active workspace lives in `active-development/` (Turbo monorepo). Package responsibilities, API entry points, and telemetry hooks are mapped in [reference.md](reference.md#active-development-monorepo).
- Operational tooling and validation harnesses live in `testing-validation/` and `claude/plugins/`; inspect them before touching incident response or plugin behaviour.
- High-signal documentation sits alongside the code—favour linking back to the source files rather than duplicating prose in responses.

## Core stewardship duties
- **Keep modules swappable**: new heuristics, resolvers, or fallback agents must register through the extension points exposed in `packages/core/src/index.ts`, `resolvers.ts`, and the session APIs. Avoid hard-coding assumptions that break profile toggles or lean orchestration.
- **Expose diagnostics**: wire telemetry events, return metadata, and update the shared snapshot endpoints when changing parse flows so Claude plugins and dashboards remain in sync.
- **Respect portability**: document overrides, environment variables, and exit ramps in the relevant README or runbook whenever you add behaviour that could lock operators in.

## Working patterns
- Follow the bootstrapping and package-specific workflows in [workflows.md](workflows.md). Each section lists the commands for install, lint, build, test, integration checks, and demo scripts (core, API, dashboard, SDKs, MCP adapter, extensions).
- When editing TypeScript packages, keep `npm run build` and `npm test` green before committing. For API work, run Firebase emulators locally and execute integration tests in `packages/api/src/test/`.
- For SDK or plugin updates, mirror changes across docs (`packages/sdk-node/README.md`, `docs/API_CHANGELOG.md`, plugin command docs) and ensure the smoke-test scripts in `claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/` still succeed.
- Coordinate major documentation changes with the onboarding assets: update the Quick Command table in [AGENTS.md](../../AGENTS.md) and sync narrative updates with [docs/AGENTIC_RELAUNCH.md](../../docs/AGENTIC_RELAUNCH.md) plus `README.md`.

## Quality gates before shipping
- Execute the applicable checklist from [quality-checks.md](quality-checks.md) and capture command output in PRs.
- Confirm telemetry snapshots (`ParseService.getLeanOrchestrationSnapshot`, session state helpers) still report expected fields when altering orchestration paths.
- Update change logs (`docs/API_CHANGELOG.md`, package READMEs) and regenerate distributable artifacts (`npm run build`, `npm run demo`, plugin packaging scripts) when versions shift.
- Ensure new instructions, environment variables, or release steps are reflected in `docs/LEAN_PLUGIN_RUNBOOK.md`, `MARKETING_LAUNCH_CHECKLIST.md`, or other operational guides as appropriate.

## Examples
- **Implementing a new resolver**: Read the resolver extension notes in [reference.md](reference.md#packagescore) then follow the `Core Engine` workflow in [workflows.md](workflows.md#core-engine). Add tests under `packages/core/src/__tests__/`, run lint/build/test, and document telemetry impact.
- **Answering an ops question**: Load `SYSTEMS_VALIDATION_REPORT.md` for the latest verification snapshot, cross-check domain/email status via `NAVIGATION.md`, and summarise while citing the authoritative files.
- **Updating the Claude plugin**: Follow the `Claude Plugin` workflow, run the smoke scripts, update runbooks, and package with `./claude/plugins/package-lean-plugin.sh`.

Stay vigilant about hand-offs: every substantial change should leave the repo easier for the next agent to understand and operate.
