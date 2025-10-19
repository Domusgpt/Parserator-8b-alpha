# Reference: Parserator repository

## Active-development monorepo
- `active-development/package.json` — Turbo workspace orchestrating package builds/tests. Scripts: `npm run dev|build|test|lint|demo|onboarding`.
- `active-development/examples/` — runnable demos (`basic-demo.js`, etc.) aligned with the Quick Command reference.
- `active-development/scripts/` — helper utilities including onboarding CLI (`show-onboarding.js`).

### `packages/core`
- Location: `active-development/packages/core/`
- Purpose: Architect→Resolver→Extractor kernel exposing session management, lean LLM fallback, heuristics, preprocess/postprocess stacks, telemetry, and plan caching.
- Key files: `src/index.ts` (orchestration + extension points), `src/resolvers.ts`, `src/session.ts`, `src/telemetry.ts`, `src/heuristics.ts`, `src/preprocessors.ts`, `src/postprocessors.ts`, `src/profiles.ts`, `src/lean-llm-field-resolver.ts`, `src/hybrid-architect.ts`, `src/cache.ts`, `src/types.ts`.
- Tests: `npm test`, `npm run test:integration`, check `src/__tests__/` and integration specs.

### `packages/api`
- Location: `active-development/packages/api/`
- Purpose: Firebase Functions wrapper around `ParseratorCore` with lean orchestration endpoints and telemetry snapshots.
- Key files: `src/services/parse.service.ts`, `src/index.ts`, `src/config.ts`, integration tests under `src/test/`.
- Scripts: `npm run dev` (emulators), `npm run build`, `npm test`, `npm run test:integration`, `npm run deploy`.
- Supporting docs: [../../docs/API_CHANGELOG.md](../../docs/API_CHANGELOG.md), [../../docs/LEAN_PLUGIN_RUNBOOK.md](../../docs/LEAN_PLUGIN_RUNBOOK.md).

### `packages/dashboard`
- Location: `active-development/packages/dashboard/`
- Purpose: Next.js dashboard served from Firebase hosting; keep env config in sync with production.
- Important entry: `src/app/dashboard/page.tsx` and accompanying components/hooks.
- Scripts: `npm run dev`, `npm run build`, `npm run deploy`.

### `packages/sdk-node`
- Location: `active-development/packages/sdk-node/`
- Purpose: Published Node SDK exposing `ParseratorClient`, session helpers, and examples.
- Key files: `src/services/ParseratorClient.ts`, `src/index.ts`, `src/types/`, example scripts in `examples/`.
- Scripts: `npm run build`, `npm test`, `npm run lint`, `npm run example:*`, `npm run benchmark`.
- Docs to update: package README, `dist/` artifacts via build, and [../../docs/API_CHANGELOG.md](../../docs/API_CHANGELOG.md) when surfacing new surface area.

### `packages/sdk-python`
- Location: `active-development/packages/sdk-python/`
- Purpose: Python client; uses Poetry/pyproject metadata. Tests reside in `tests/`.
- Commands: install via Poetry (`poetry install`), run `poetry run pytest`, publish via `poetry build` when instructed.

### `packages/email-parser`
- Serverless email ingestion pipeline with Firebase function `emailToSchema`; scripts for Gmail webhooks and SES handler.
- Ensure secrets and transport configs are documented before deploying (`npm run deploy` in this package).

### Additional packages
- `packages/mcp-adapter/` (if present in production snapshot) align with MCP server integration; confirm against README and docs before modifying.

## Extensions & tooling
- `active-development/parserator-extensions/` — Chrome & VS Code extensions prepared for release; follow store submission checklists in marketing docs.
- `claude/plugins/dev-marketplace/` — Claude Code plugin scaffolding (`/.claude-plugin/marketplace.json`, command docs, scripts). Packaging script: `./claude/plugins/package-lean-plugin.sh`.
- `testing-validation/api-testing/` — Node scripts hitting live endpoints for regression verification (e.g., `test-live-parserator.js`, `test-comprehensive-suite.js`).
- `testing-validation/debug-tools/` — Diagnostic helpers for telemetry snapshots and plan cache inspection.

## Documentation stash
- Launch & strategy: `README.md`, `NAVIGATION.md`, `COMPLETE_PROJECT_AUDIT.md`, `CRITICAL_PROJECT_STATE.md`, `SYSTEMS_VALIDATION_REPORT.md`.
- Technical deep dives: `docs/AGENTIC_RELAUNCH.md`, `docs/PLUGIN_LAUNCH_PLAN.md`, `docs/HEURISTIC_STACK_REVIEW.md`, `docs/ASYNC_ARCHITECTURE_REVIEW.md`.
- Operational guides: `DOMAIN_REDIRECT_FIX.md`, `DOMAIN_FIX_INSTRUCTIONS.md`, `MARKETING_LAUNCH_CHECKLIST.md`, `PRODUCTION_DEPLOYMENT_STATUS.md`.
- Essential context: `essential-context/` (API docs, EMA philosophy), marketing deliverables scattered in root-level markdown files.

## Key status touchpoints
- Production telemetry snapshot: `PRODUCTION_SYSTEM_ASSESSMENT.md` + `SYSTEMS_VALIDATION_REPORT.md`.
- Daily status updates: `DAILY_TRACKING.md`.
- Launch gating issues: `IMMEDIATE_FIXES_GUIDE.md`, `DOMAIN_REDIRECT_FIX.md`, `MISSING_COMPONENTS_RESTORED.md`.
- Visual diff of repos: `🗂️ __Full vs. New Parserator Directory Comparison__.pdf` for verifying parity.
