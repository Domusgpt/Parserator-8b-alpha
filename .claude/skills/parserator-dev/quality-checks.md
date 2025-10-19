# Quality and documentation checks

## General PR checklist
- [ ] Reference the exact docs/commands you ran in the PR description (cite output paths).
- [ ] Keep `npm run build` + `npm test` (or equivalent) passing for every touched package.
- [ ] Update changelog or README entries when public surfaces change.
- [ ] Verify telemetry/logging continues to emit expected fields (no silent schema drifts).
- [ ] Sync Quick Command table in [../../AGENTS.md](../../AGENTS.md) if you add/modify workflow commands.

## Core engine changes
- [ ] Unit tests updated/added for new resolvers, heuristics, or session flows.
- [ ] Integration tests cover fallback usage (lean resolver, hybrid architect) where relevant.
- [ ] `npm run test:integration` executed and green.
- [ ] Telemetry events documented in `docs/HEURISTIC_STACK_REVIEW.md` or related runbooks.

## API changes
- [ ] Emulators exercised (`npm run dev`) and critical endpoints smoke tested locally.
- [ ] `npm run test:integration` executed.
- [ ] Response/metadata changes reflected in `docs/API_CHANGELOG.md` and plugin command docs.
- [ ] Snapshot helpers (`ParseService.getLeanOrchestrationSnapshot`) still return required properties.

## SDK changes
- [ ] Node SDK builds + examples executed (`npm run example:advanced`).
- [ ] Python SDK tests (`poetry run pytest`) and typing guard if in scope.
- [ ] README usage examples updated; version bumped when publishing.
- [ ] Ensure `dist/`/`build/` artifacts regenerated before publishing.

## Plugin + tooling updates
- [ ] Smoke scripts in `claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/` executed.
- [ ] `/parserator-status` and `/parserator-parse` docs updated with any new flags or payload fields.
- [ ] `./claude/plugins/package-lean-plugin.sh` run when preparing releases.

## Ops / deployment tasks
- [ ] Domain/email fixes recorded in `DOMAIN_REDIRECT_FIX.md`, `DOMAIN_FIX_INSTRUCTIONS.md`, or `MARKETING_LAUNCH_CHECKLIST.md`.
- [ ] `PRODUCTION_DEPLOYMENT_STATUS.md` updated with new deployment timestamps.
- [ ] If telemetry validated, append notes to `SYSTEMS_VALIDATION_REPORT.md` or `DAILY_TRACKING.md`.
