---
name: Parserator Development Stewardship
description: Guides Claude Code through Parserator-8b-alpha, highlighting activation cues, repo orientation, workflows, and validation duties. Use when working on Parserator code, documentation, or operational artefacts.
---

# Parserator Development Stewardship

## Activation signals
- The request references **Parserator**, the Architect→Extractor pipeline, or paths inside `active-development/`.
- A teammate needs authoritative runbooks, command sequences, or release guardrails for Parserator deliverables.
- You must summarise or modify Parserator docs, telemetry, or deployment status files.

> Progressive disclosure: pull in supporting guides only as needed.
> - [reference.md](reference.md) → directory map + ownership cues.
> - [workflows.md](workflows.md) → per-package command checklists.
> - [quality-checks.md](quality-checks.md) → PR validation + documentation duties.

## Quick orientation (copy this checklist)
```
Parserator Orientation
- [ ] Re-read repo guardrails in AGENTS.md (WMA swappability, diagnostics, exit ramps)
- [ ] Skim README.md + NAVIGATION.md for current launch + asset locations
- [ ] Load PARSERATOR_PRODUCTION_CLAUDE.md and docs/AGENTIC_RELAUNCH.md for production framing
- [ ] Consult audits (COMPLETE_PROJECT_AUDIT.md, CRITICAL_PROJECT_STATE.md, SYSTEMS_VALIDATION_REPORT.md) when answering history/risk questions
- [ ] Treat essential-context/ + marketing archives as read-only unless specifically tasked
```

## Repository map
- `active-development/` holds the Turborepo workspace. Use [reference.md](reference.md#active-development-monorepo) for package entry points and telemetry hooks.
- Operational harnesses (`testing-validation/`, `claude/plugins/`) back incident response and Claude marketplace surfaces.
- Authoritative documentation lives beside code—link to source files rather than paraphrasing when responding.

## Stewardship principles
1. **Swappable modules** — Extend heuristics/resolvers through the exposed factories (`packages/core/src/index.ts`, `resolvers.ts`, `session.ts`). Avoid coupling that blocks profile toggles or lean orchestration.
2. **Transparent diagnostics** — Preserve telemetry and metadata parity (telemetry modules, snapshot helpers) whenever parse flows move.
3. **Portability first** — Document new environment variables, overrides, and exit ramps in the relevant README/runbook to maintain EMA/WMA guarantees.

## Execution pattern
- Lean on [workflows.md](workflows.md) for install→lint→test→build scripts per package. Keep TS packages green on `npm run build` + `npm test`; run Firebase emulators + integration suites for API changes.
- When touching SDKs or plugins, mirror updates in package READMEs, `docs/API_CHANGELOG.md`, and ensure smoke scripts in `claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/` succeed.
- Coordinate documentation edits with repo onboarding: refresh the Quick Command table in [AGENTS.md](../../AGENTS.md) and align storytelling with [docs/AGENTIC_RELAUNCH.md](../../docs/AGENTIC_RELAUNCH.md) + `README.md`.

## Ship-readiness gates
- Run the relevant checklist from [quality-checks.md](quality-checks.md) and capture command output for PR evidence.
- Confirm telemetry surfaces (`ParseService.getLeanOrchestrationSnapshot`, session helpers) still return required fields after orchestration changes.
- Update changelogs + READMEs, regenerate distributables (`npm run build`, `npm run demo`, plugin packaging scripts), and document new runbook steps.

## Examples
- **Add a resolver** → Review resolver guidance in [reference.md](reference.md#packagescore), execute the `Core Engine` flow in [workflows.md](workflows.md#core-engine), add tests under `packages/core/src/__tests__/`, then document telemetry impact.
- **Answer an ops question** → Load `SYSTEMS_VALIDATION_REPORT.md`, cross-check `NAVIGATION.md` for domain/email status, and cite authoritative sources.
- **Ship plugin updates** → Follow `Claude Plugin` steps, run smoke scripts, refresh runbooks, then package via `./claude/plugins/package-lean-plugin.sh`.

Leave the repository clearer than you found it.
