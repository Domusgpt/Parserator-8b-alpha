# Workflows and command checklists

Copy the relevant block into your working notes and tick items as you go.

## Bootstrapping the workspace
```
Workspace Bootstrap
- [ ] cd active-development
- [ ] npm install
- [ ] (Optional) npm run onboarding   # prints command cheat sheet
- [ ] npm run demo                    # runs examples/basic-demo.js
- [ ] npm run build                   # surfaces workspace type issues
```

## Core engine
```
Core Engine
- [ ] cd active-development/packages/core
- [ ] npm run lint
- [ ] npm run build
- [ ] npm test
- [ ] npm run test:integration        # when resolvers/session logic changes
```
- Regenerate docs/examples if public APIs shift.
- Inspect telemetry updates in `src/telemetry.ts` and `docs/HEURISTIC_STACK_REVIEW.md` when adjusting heuristics.

## API (Firebase Functions)
```
API Functions
- [ ] cd active-development/packages/api
- [ ] npm install                     # if dependencies moved
- [ ] npm run lint
- [ ] npm run build
- [ ] npm test
- [ ] npm run test:integration
- [ ] npm run dev                      # emulate locally for handler changes
- [ ] firebase deploy --only functions # only post-review
```
- Keep `.env`/Firebase config notes in sync with `PRODUCTION_DEPLOYMENT_STATUS.md`.
- Update `docs/API_CHANGELOG.md` when response shapes, telemetry, or routes change.

## Dashboard (Next.js)
```
Dashboard
- [ ] cd active-development/packages/dashboard
- [ ] npm install
- [ ] npm run lint
- [ ] npm run dev
- [ ] npm run build
- [ ] npm run deploy                   # Firebase hosting deploy
```
- Ensure marketing redirects match `DOMAIN_REDIRECT_FIX.md`.

## Node SDK
```
Node SDK
- [ ] cd active-development/packages/sdk-node
- [ ] npm install
- [ ] npm run lint
- [ ] npm run build
- [ ] npm test
- [ ] npm run example:advanced
- [ ] (Optional) npm run benchmark
```
- Publish flow: `npm publish --access public` after version bump + changelog updates.
- Sync docs with package README and repo-level changelog.

## Python SDK
```
Python SDK
- [ ] cd active-development/packages/sdk-python
- [ ] poetry install
- [ ] poetry run pytest
- [ ] (Optional) poetry run mypy src
- [ ] poetry build                     # only when cutting releases
```
- Update `src/parserator/client.py`, docs, and fixtures together.

## Email parser function
```
Email Parser
- [ ] cd active-development/packages/email-parser
- [ ] npm install
- [ ] npm test                         # node-based validation scripts
- [ ] firebase deploy --only functions:emailToSchema
```
- Document sender domains, secrets, and webhook URLs in ops docs.

## Claude plugin & tooling
```
Claude Plugin
- [ ] cd claude/plugins/dev-marketplace
- [ ] node parserator-lean-orchestration/scripts/parserator-status.mjs
- [ ] node parserator-lean-orchestration/scripts/parserator-parse.mjs
- [ ] ../../package-lean-plugin.sh     # package for release
```
- Ensure `/parserator-status` and `/parserator-parse` docs reflect API payload changes.

## Testing-validation harnesses
- `node testing-validation/api-testing/test-live-parserator.js` — hits production endpoint; respect rate limits.
- `node testing-validation/api-testing/test-comprehensive-suite.js` — regression suite for known transcripts.
- Update expected outputs when heuristics or metadata change.

## Documentation updates
- After code changes, review `docs/AGENTIC_RELAUNCH.md`, `README.md`, `NAVIGATION.md`, and `MARKETING_LAUNCH_CHECKLIST.md` for alignment.
- Append entries to `SYSTEMS_VALIDATION_REPORT.md` or `DAILY_TRACKING.md` when you validate production paths.
