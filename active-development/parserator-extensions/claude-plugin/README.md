# Parserator Lean Fallback Claude Plugin

This plugin packages commands and an auxiliary agent that make it easy for Claude Code to trigger Parserator's lean LLM fallback, consume the new playbook metadata, and spawn focused subagents when heuristics stall.

## Features

- `/lean-fallback`: submit a parse request with lean fallback budgets and capture the resulting playbook summary.
- `/spawn-subagent`: spin up a constrained helper that follows the exported `spawnCommand` and budget guidance.
- `LeanFallbackRunner` agent: executes additional fallback attempts while respecting invocation/token limits.

## Local testing

```bash
cd active-development/parserator-extensions/claude-plugin
claude
/plugin marketplace add ./.claude-plugin
/plugin install parserator-lean-fallback@parserator-dev
```

Restart Claude Code after installation, then run `/lean-fallback` inside a workspace that already has Parserator credentials configured.

## Playbook schema

The plugin expects `metadata.fallback.leanLLMPlaybook` to be present in parse responses. This release introduces the generator inside `@parserator/core`, exposing:

- `headline`
- `overview`
- `context` (plan identity and origin)
- `runtime` (active lean fallback options)
- `budgets` (invocation/token usage)
- `steps` (per-field status)
- `spawnCommand` (pre-baked Claude subagent command)

If the playbook is absent the commands exit early and recommend rerunning the parse with lean fallback enabled.
