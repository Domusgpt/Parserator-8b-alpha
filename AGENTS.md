# Parserator Agent Onboarding

Welcome to the Parserator codebase. This note is the first stop for autonomous agents and vibe coders jumping into active development. It keeps the **Wide Market Autonomy (WMA)** promise from parserator.com front-and-center: everything stays portable, swappable, and kind to folks who might leave. Use the table below as your working checklist before diving into deeper docs.

## Quick Command Reference
| Scenario | Workspace | Command | Purpose |
| --- | --- | --- | --- |
| Install workspace deps | `active-development` | `npm install` | Bootstraps all workspaces with a single install (Node ≥ 18, npm ≥ 9).
| Type-check & build core | `active-development/packages/core` | `npm run build` | Emit the compiled JS + declarations that fuel API, SDK, and agent workflows.
| Run core tests | `active-development/packages/core` | `npm test` | Execute unit specs for heuristics, resolvers, preprocess/postprocess stacks.
| Lint core source | `active-development/packages/core` | `npm run lint` | Keep the agent-first pipeline readable and policy-compliant.
| Serve API locally | `active-development/packages/api` | `npm run dev` | Launch Firebase emulators with the shared core wired in—great for end-to-end smoke tests.
| Build API bundle | `active-development/packages/api` | `npm run build` | Type-check and transpile Cloud Functions before deployment.
| Execute API tests | `active-development/packages/api` | `npm test` | Validate service wiring and ParseService regressions.
| Export API credentials | any shell | `export PARSERATOR_API_KEY="<your-key>"` | Required before CLI examples hit the hosted service.
| Build Node SDK | `active-development/packages/sdk-node` | `npm run build` | Emit `dist/` so CLI + automation scripts can import the client.
| CLI quick parse | `active-development/packages/sdk-node` | `npm run example:basic` | Walks through connection test, quickParse helper, presets, and failure modes.
| CLI batch parse | `active-development/packages/sdk-node` | `npm run example:batch` | Demonstrates plan reuse + telemetry for multi-doc flows.
| Run session examples | `active-development/packages/sdk-node` | `npm run example:advanced` | Observe session + batch helpers with the newest heuristic defaults.
| Blast the cheat sheet | repo root | `npm run onboarding` | Print the CLI onboarding tables and reminder to #add-this-to-memory.

> **Tip:** The workspace packages are intentionally decoupled. Install and build only what you need to keep setups light for EMA "freedom to leave" expectations. Set `PARSERATOR_API_KEY` in your shell before running the CLI demos so they can hit the hosted parser immediately.

## Directory Landmarks
| Path | Why it matters | When to touch |
| --- | --- | --- |
| `active-development/packages/core/src/` | Agent-first parsing kernel: architect, resolver, session, preprocess/postprocess stacks. | Extending heuristics, wiring telemetry, adjusting plan caches/profiles.
| `active-development/packages/api/src/services/parse.service.ts` | Firebase Function wrapper that mirrors local diagnostics and telemetry. | Aligning production API behaviour or toggling core profiles remotely.
| `active-development/packages/sdk-node/src/` | Official Node surface for automations and agent clients. | Updating types, metadata plumbing, or publishing new examples.
| `active-development/scripts/show-onboarding.js` | CLI cheat sheet rendered by `npm run onboarding`. | Keep tables in sync with new workflows.
| `docs/AGENTIC_RELAUNCH.md` | Strategy brief tying the refactor to EMA/WMA narratives. | Syncing product/marketing stories or planning roadmap updates.
| `README.md` | High-level orientation for humans landing in the repo. | Surface new capabilities, fixes, or docs you add elsewhere.

## Operating Principles
1. **Keep it swappable.** Any new module (resolver, pre/post-processor, interceptor) should plug into `ParseratorCore` without forcing a monolithic kernel.
2. **Expose diagnostics.** Maintain telemetry + metadata parity so agents and dashboards both understand low-confidence or fallback paths.
3. **Respect WMA.** Default choices should never lock users in—document exits, toggles, and overrides.

## Update Protocol
- When you add or change a key workflow command, update the Quick Command Reference table in this file.
- If you restructure directories or surface new strategy docs, refresh the Directory Landmarks table.
- Mirror substantial onboarding changes in `docs/AGENTIC_RELAUNCH.md` and `README.md` so marketing/dev narratives stay synced.

Happy parsing—leave the place better than you found it.
