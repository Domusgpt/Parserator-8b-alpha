---
description: Run Parserator with lean LLM fallback enabled and capture the playbook output for downstream agents.
---

# Parserator Lean Fallback Command

1. Use the Parserator Node SDK or MCP server to submit the current document with the provided schema.
2. Set `options.leanLLM` to mirror the configured budgets (invocations, tokens, plan gate) shared in the prompt.
3. After parsing, collect the `metadata.fallback.leanLLMPlaybook` payload and surface:
   - `headline`
   - `overview` bullet list
   - `spawnCommand`
   - Per-field `steps`
4. If the fallback budgets are exhausted, recommend escalating to the full Gemini pipeline.
