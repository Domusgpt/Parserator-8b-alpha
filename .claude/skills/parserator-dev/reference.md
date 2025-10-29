# Reference: Parserator repository

## Contents
- [Active-development monorepo](#active-development-monorepo)
  - [`packages/core`](#packagescore)
  - [`packages/api`](#packagesapi)
  - [`packages/dashboard`](#packagesdashboard)
  - [`packages/sdk-node`](#packagessdk-node)
  - [`packages/sdk-python`](#packagessdk-python)
  - [`packages/email-parser`](#packagesemail-parser)
  - [Additional packages](#additional-packages)
- [Extensions & tooling](#extensions--tooling)
- [Documentation stash](#documentation-stash)
- [Key status touchpoints](#key-status-touchpoints)

## Active-development monorepo
- `active-development/package.json` — Turborepo workspace orchestrating package builds/tests. Scripts: `npm run dev|build|test|lint|demo|onboarding`.
- `active-development/examples/` — runnable demos (`basic-demo.js`, etc.) aligned with the onboarding cheat sheet.
- `active-development/scripts/` — helper utilities including onboarding CLI (`show-onboarding.js`).

### `packages/core`
- Location: `active-development/packages/core/`
- Purpose: Architect→Resolver→Extractor kernel exposing session management, lean LLM fallback, heuristics, preprocess/postprocess stacks, telemetry, and plan caching.
- Key files: `src/index.ts` (orchestration + extension points), `src/resolvers.ts`, `src/session.ts`, `src/telemetry.ts`, `src/heuristics.ts`, `src/preprocessors.ts`, `src/postprocessors.ts`, `src/profiles.ts`, `src/lean-llm-field-resolver.ts`, `src/hybrid-architect.ts`, `src/cache.ts`, `src/types.ts`.
- Tests: `npm test`, `npm run test:integration`; specs live in `src/__tests__/` and integration folders.

### `packages/api`
- Location: `active-development/packages/api/`
- Purpose: Firebase Functions wrapper around `ParseratorCore` with lean orchestration endpoints and telemetry snapshots.
- Key files: `src/services/parse.service.ts`, `src/index.ts`, `src/config.ts`, integration tests under `src/test/`.
- Scripts: `npm run dev` (emulators), `npm run build`, `npm test`, `npm run test:integration`, `npm run deploy`.
- Supporting docs: [../../docs/API_CHANGELOG.md](../../docs/API_CHANGELOG.md), [../../docs/LEAN_PLUGIN_RUNBOOK.md](../../docs/LEAN_PLUGIN_RUNBOOK.md).

### `packages/dashboard`
- Location: `active-development/packages/dashboard/`
- Purpose: Next.js dashboard served from Firebase hosting; keep env config aligned with production.
- Key entry: `src/app/dashboard/page.tsx` plus supporting components/hooks.
- Scripts: `npm run dev`, `npm run build`, `npm run deploy`.

### `packages/sdk-node`
- Location: `active-development/packages/sdk-node/`
- Purpose: Published Node SDK exposing `ParseratorClient`, session helpers, and examples.
- Key files: `src/services/ParseratorClient.ts`, `src/index.ts`, `src/types/`, example scripts in `examples/`.
- Scripts: `npm run build`, `npm test`, `npm run lint`, `npm run example:*`, `npm run benchmark`.
- Docs to update: package README, `dist/` artifacts via build, and [../../docs/API_CHANGELOG.md](../../docs/API_CHANGELOG.md) when surfaces move.

### `packages/sdk-python`
- Location: `active-development/packages/sdk-python/`
- Purpose: Poetry-managed Python client.
- Commands: `poetry install`, `poetry run pytest`, optional `poetry run mypy src`, publish with `poetry build` when instructed.

### `packages/email-parser`
- Function: Serverless email ingestion pipeline (`emailToSchema`).
- Guardrails: Document secrets + transport configs before deploying (`firebase deploy --only functions:emailToSchema`).

### Additional packages
- `packages/mcp-adapter/` (when present) — Model Context Protocol integration; confirm README + docs alignment before editing.

## Extensions & tooling
- `active-development/parserator-extensions/` — Chrome & VS Code extensions; follow store submission checklists in marketing docs.
- `claude/plugins/dev-marketplace/` — Claude Code plugin scaffolding (`/.claude-plugin/marketplace.json`, command docs, scripts). Package via `./claude/plugins/package-lean-plugin.sh`.
- `testing-validation/api-testing/` — Node scripts hitting live endpoints (e.g., `test-live-parserator.js`, `test-comprehensive-suite.js`).
- `testing-validation/debug-tools/` — Diagnostics for telemetry snapshots + plan cache inspection.

## Documentation stash
- Launch & strategy: `README.md`, `NAVIGATION.md`, `COMPLETE_PROJECT_AUDIT.md`, `CRITICAL_PROJECT_STATE.md`, `SYSTEMS_VALIDATION_REPORT.md`.
- Technical deep dives: `docs/AGENTIC_RELAUNCH.md`, `docs/PLUGIN_LAUNCH_PLAN.md`, `docs/HEURISTIC_STACK_REVIEW.md`, `docs/ASYNC_ARCHITECTURE_REVIEW.md`.
- Operational guides: `DOMAIN_REDIRECT_FIX.md`, `DOMAIN_FIX_INSTRUCTIONS.md`, `MARKETING_LAUNCH_CHECKLIST.md`, `PRODUCTION_DEPLOYMENT_STATUS.md`.
- Essential context: `essential-context/` (API docs, EMA philosophy) + root-level marketing artifacts.

## Key status touchpoints
- Production telemetry snapshot: `PRODUCTION_SYSTEM_ASSESSMENT.md` + `SYSTEMS_VALIDATION_REPORT.md`.
- Daily status updates: `DAILY_TRACKING.md`.
- Launch gating issues: `IMMEDIATE_FIXES_GUIDE.md`, `DOMAIN_REDIRECT_FIX.md`, `MISSING_COMPONENTS_RESTORED.md`.
- Visual parity: `🗂️ __Full vs. New Parserator Directory Comparison__.pdf`.
