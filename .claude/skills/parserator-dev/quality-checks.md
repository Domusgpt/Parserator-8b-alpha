# Quality and documentation checks

Use this suite after completing the commands in [workflows.md](workflows.md). Copy only the sections that apply to your change.

## General PR checklist
- [ ] Reference the exact commands and docs you touched in the PR description (include paths or log files).
- [ ] Keep `npm run build` + `npm test` (or equivalents) passing for every impacted package.
- [ ] Update changelogs or READMEs when public surfaces change.
- [ ] Verify telemetry/logging outputs retain required fields (guard against silent schema drift).
- [ ] Update the Quick Command table in [../../AGENTS.md](../../AGENTS.md) if you introduce or change workflow commands.

## Core engine changes
- [ ] Add or update unit tests for new resolvers, heuristics, session flows.
- [ ] Cover fallback paths (lean resolver, hybrid architect) in integration tests.
- [ ] `npm run test:integration` is green.
- [ ] Document telemetry updates in `docs/HEURISTIC_STACK_REVIEW.md` or linked runbooks.

## API changes
- [ ] Exercise emulators (`npm run dev`) and smoke test critical endpoints.
- [ ] `npm run test:integration` is green.
- [ ] Reflect response/metadata changes in `docs/API_CHANGELOG.md` and plugin command docs.
- [ ] Validate `ParseService.getLeanOrchestrationSnapshot` (and related helpers) still expose required properties.

## SDK changes
- [ ] Node SDK: `npm run build`, `npm test`, `npm run example:advanced` complete successfully.
- [ ] Python SDK: `poetry run pytest` (and `poetry run mypy src` if typing enforced).
- [ ] README usage examples updated; version bumped when publishing.
- [ ] Regenerate `dist/` or `build/` artifacts before shipping.

## Plugin + tooling updates
- [ ] Run smoke scripts in `claude/plugins/dev-marketplace/parserator-lean-orchestration/scripts/`.
- [ ] Update `/parserator-status` + `/parserator-parse` docs for new flags/payloads.
- [ ] Execute `./claude/plugins/package-lean-plugin.sh` when preparing releases.

## Ops / deployment tasks
- [ ] Record domain/email changes in `DOMAIN_REDIRECT_FIX.md`, `DOMAIN_FIX_INSTRUCTIONS.md`, or `MARKETING_LAUNCH_CHECKLIST.md`.
- [ ] Update `PRODUCTION_DEPLOYMENT_STATUS.md` with deployment timestamps and notes.
- [ ] Append telemetry validation notes to `SYSTEMS_VALIDATION_REPORT.md` or `DAILY_TRACKING.md`.
