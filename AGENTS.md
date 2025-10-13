# Parserator Agent Onboarding

Welcome to the Parserator codebase. This note is the first stop for autonomous agents and vibe coders jumping into active development. It keeps the **Wide Market Autonomy (WMA)** promise from parserator.com front-and-center: everything stays portable, swappable, and kind to folks who might leave. Use the table below as your working checklist before diving into deeper docs.

## Quick Command Reference

### Pre-flight
- Use **Node.js ≥ 18** and **npm ≥ 9** to match the workspace engines.
- Clone the repo and drop into `active-development/` before running workspace commands.
- Set `PARSERATOR_API_KEY` (env var or `.env`) so CLI demos and SDK calls can reach the hosted API.

| Step | Where | Command | What it does |
| --- | --- | --- | --- |
| Install workspace deps | `active-development` | `npm install` | Installs all dependencies and links workspaces. |
| Build parser core | `active-development` | `npm run build -w @parserator/core` | Compiles the agent-first kernel for local runs. |
| Build Node SDK | `active-development` | `npm run build -w @parserator/sdk-node` | Emits CLI-ready artifacts in `packages/sdk-node/dist`. |
| Set API key (bash/zsh) | shell | `export PARSERATOR_API_KEY="pk_live_or_test"` | Authenticates CLI + SDK calls against the cloud API. |
| Set API key (PowerShell) | shell | `$env:PARSERATOR_API_KEY="pk_live_or_test"` | Windows-friendly environment variable setup. |
| Run CLI parse demo | `active-development` | `npm run example:basic -w @parserator/sdk-node` | Executes the SDK CLI demo against sample transcripts. |
| Batch CLI example | `active-development` | `npm run example:batch -w @parserator/sdk-node` | Demonstrates cached-plan batching from the CLI. |
| Serve API locally | `active-development` | `npm run dev -w @parserator/api` | Launch Firebase emulators with the shared core wired in. |
| Build API bundle | `active-development` | `npm run build -w @parserator/api` | Type-check and transpile Cloud Functions before deployment. |
| Execute API tests | `active-development` | `npm run test -w @parserator/api` | Validate service wiring and ParseService regressions. |
| Run core tests | `active-development` | `npm run test -w @parserator/core` | Exercise heuristics, resolvers, preprocess/postprocess stacks. |
| Run onboarding again | repo root | `npm run onboarding` | Print the CLI cheat sheet + reminder to #add-this-to-memory. |

> **Tip:** The workspace packages are intentionally decoupled. Install and build only what you need to keep setups light for EMA "freedom to leave" expectations.

## Directory Landmarks
| Path | Why it matters | When to touch |
| --- | --- | --- |
| `active-development/packages/core/src/` | Agent-first parsing kernel: architect, resolver, session, preprocess/postprocess stacks. | Extending heuristics, wiring telemetry, adjusting plan caches/profiles.
| `active-development/packages/api/src/services/parse.service.ts` | Firebase Function wrapper that mirrors local diagnostics and telemetry. | Aligning production API behaviour or toggling core profiles remotely.
| `active-development/packages/sdk-node/src/` | Official Node surface for automations and agent clients. | Updating types, metadata plumbing, or publishing new examples.
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
