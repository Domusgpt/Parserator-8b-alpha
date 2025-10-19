# Workflows and command checklists

## Bootstrapping the workspace
1. `cd active-development`
2. `npm install`
3. (Optional) `npm run onboarding` to print the command cheat sheet.
4. Verify Turborepo awareness with `npm run demo` (executes `examples/basic-demo.js`).
5. Run `npm run build` once to surface TypeScript type issues across packages.

## Core engine
```
cd active-development/packages/core
npm run lint
npm run build
npm test
npm run test:integration   # when resolvers/session logic changes
```
- Regenerate docs/examples if public APIs shift.
- Inspect telemetry updates in `src/telemetry.ts` and `docs/HEURISTIC_STACK_REVIEW.md` when adjusting heuristics.

## API (Firebase Functions)
```
cd active-development/packages/api
npm install        # if dependencies moved
npm run lint
npm run build
npm test
npm run test:integration
npm run dev        # emulate locally when touching handlers
# Deploy only after reviews:
firebase deploy --only functions
```
- Keep `.env`/Firebase config notes in sync with `PRODUCTION_DEPLOYMENT_STATUS.md`.
- Update `docs/API_CHANGELOG.md` when response shapes, telemetry, or routes change.

## Dashboard (Next.js)
```
cd active-development/packages/dashboard
npm install
npm run lint
npm run dev        # local smoke test
npm run build
npm run deploy     # Firebase hosting deploy
```
- Ensure marketing redirects remain correct per `DOMAIN_REDIRECT_FIX.md`.

## Node SDK
```
cd active-development/packages/sdk-node
npm install
npm run lint
npm run build
npm test
npm run example:advanced    # spot-check session helpers
npm run benchmark           # optional perf baseline
```
- Publish flow: `npm publish --access public` after version bump and changelog updates.
- Sync docs with `README.md` in the package and repo-level changelog.

## Python SDK
```
cd active-development/packages/sdk-python
poetry install
poetry run pytest
poetry run mypy src        # if typing guard is enabled
poetry build               # only when cutting releases
```
- Update `src/parserator/client.py` and docs together; refresh `tests/` fixtures for new behaviours.

## Email parser function
```
cd active-development/packages/email-parser
npm install
npm test            # uses Node scripts to validate parsing
firebase deploy --only functions:emailToSchema
```
- Document sender domains, secrets, and webhook URLs in `EMAIL_PARSER` sections of ops docs.

## Claude plugin & tooling
```
cd claude/plugins/dev-marketplace
# Validate commands align with API behaviour
node parserator-lean-orchestration/scripts/parserator-status.mjs
node parserator-lean-orchestration/scripts/parserator-parse.mjs
# Package for release
../../package-lean-plugin.sh
```
- Ensure `/parserator-status` and `/parserator-parse` docs reflect any API payload changes.

## Testing-validation harnesses
- `node testing-validation/api-testing/test-live-parserator.js` — hits production endpoint, ensure rate limits respected.
- `node testing-validation/api-testing/test-comprehensive-suite.js` — regression suite for known transcripts.
- Update expected outputs when heuristics or metadata change.

## Documentation updates
- After code changes, review `docs/AGENTIC_RELAUNCH.md`, `README.md`, `NAVIGATION.md`, and `MARKETING_LAUNCH_CHECKLIST.md` for alignment.
- Append entries to `SYSTEMS_VALIDATION_REPORT.md` or `DAILY_TRACKING.md` if you validated production-facing paths.
