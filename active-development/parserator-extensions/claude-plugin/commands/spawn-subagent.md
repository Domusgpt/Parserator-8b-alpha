---
description: Spawn a focused Claude subagent that follows the lean fallback playbook to resolve missing fields.
---

# Spawn Lean Fallback Subagent

1. Instantiate a Claude subagent named `LeanFallbackRunner`.
2. Provide the `spawnCommand` value from the latest Parserator playbook as the agent's startup directive.
3. Share the outstanding schema fields and any remaining budgets from the playbook `budgets` section.
4. Instruct the subagent to only call Parserator when:
   - The field is required, and
   - The plan confidence is below the gate, and
   - Invocations/tokens are still within limits.
5. Ask the subagent to append its resolutions back into the parent thread, tagging each with the originating field key.
