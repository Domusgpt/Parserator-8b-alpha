"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLeanLLMPlaybook = buildLeanLLMPlaybook;
function buildLeanLLMPlaybook(options = {}) {
    const { plan, usage, runtime } = options;
    const runtimeSummary = {
        allowOptionalFields: runtime?.allowOptionalFields,
        defaultConfidence: runtime?.defaultConfidence,
        maxInputCharacters: runtime?.maxInputCharacters,
        planConfidenceGate: runtime?.planConfidenceGate ?? usage?.planConfidenceGate,
        maxInvocationsPerParse: runtime?.maxInvocationsPerParse ?? usage?.maxInvocationsPerParse,
        maxTokensPerParse: runtime?.maxTokensPerParse ?? usage?.maxTokensPerParse
    };
    const context = {
        planId: plan?.id,
        planVersion: plan?.version,
        planOrigin: plan?.metadata.origin,
        plannerConfidence: plan?.metadata.plannerConfidence
    };
    const budgets = deriveBudgets(usage);
    const steps = deriveSteps(usage?.fields ?? []);
    const overview = buildOverviewLines(usage, runtimeSummary);
    const spawnCommand = buildSpawnCommand(context, runtimeSummary);
    return {
        headline: 'Lean LLM fallback playbook',
        overview,
        context,
        runtime: runtimeSummary,
        budgets,
        steps,
        spawnCommand
    };
}
function deriveBudgets(usage) {
    if (!usage) {
        return {};
    }
    const invocationsLimit = usage.maxInvocationsPerParse;
    const tokensLimit = usage.maxTokensPerParse;
    const invocationsBudget = usage.totalInvocations;
    const tokensBudget = usage.totalTokens;
    const budgets = {};
    if (invocationsLimit !== undefined || invocationsBudget > 0 || usage.skippedByLimits > 0) {
        const remaining = invocationsLimit !== undefined ? Math.max(invocationsLimit - invocationsBudget, 0) : undefined;
        budgets.invocations = {
            used: invocationsBudget,
            limit: invocationsLimit,
            remaining,
            skippedByLimit: usage.skippedByLimits
        };
    }
    if (tokensLimit !== undefined || tokensBudget > 0 || usage.skippedByLimits > 0) {
        const remaining = tokensLimit !== undefined ? Math.max(tokensLimit - tokensBudget, 0) : undefined;
        budgets.tokens = {
            used: tokensBudget,
            limit: tokensLimit,
            remaining,
            skippedByLimit: usage.skippedByLimits
        };
    }
    return budgets;
}
function deriveSteps(fields) {
    return fields.map(field => {
        let status = 'resolved';
        if (field.error && field.limitType) {
            status = 'skipped-limit';
        }
        else if (field.error && field.gate !== undefined) {
            status = 'skipped-plan-confidence';
        }
        else if (field.sourceField && field.sharedKeys?.length) {
            status = 'reused';
        }
        const rationaleLines = [];
        if (field.reason) {
            rationaleLines.push(field.reason);
        }
        if (field.error) {
            rationaleLines.push(field.error);
        }
        return {
            field: field.field,
            status,
            confidence: field.confidence,
            rationale: rationaleLines.length ? rationaleLines.join(' ') : undefined,
            sourceField: field.sourceField,
            sharedKeys: field.sharedKeys,
            tokensUsed: field.tokensUsed,
            plannerConfidence: field.plannerConfidence,
            gate: field.gate
        };
    });
}
function buildOverviewLines(usage, runtime) {
    if (!usage) {
        return ['Lean fallback was not invoked for this parse.'];
    }
    const lines = [
        `Invoked ${usage.totalInvocations} time${usage.totalInvocations === 1 ? '' : 's'} across ${usage.fields.length} field${usage.fields.length === 1 ? '' : 's'}.`,
        `${usage.resolvedFields} field${usage.resolvedFields === 1 ? '' : 's'} resolved via the lean model.`
    ];
    if (usage.reusedResolutions > 0) {
        lines.push(`${usage.reusedResolutions} field${usage.reusedResolutions === 1 ? '' : 's'} reused shared extraction results.`);
    }
    if (usage.skippedByPlanConfidence > 0) {
        lines.push(`${usage.skippedByPlanConfidence} field${usage.skippedByPlanConfidence === 1 ? '' : 's'} skipped due to the planner confidence gate.`);
    }
    if (usage.skippedByLimits > 0) {
        lines.push(`${usage.skippedByLimits} field${usage.skippedByLimits === 1 ? '' : 's'} skipped because budgets were reached.`);
    }
    if (runtime?.maxInvocationsPerParse !== undefined) {
        lines.push(`Invocation budget: ${usage.totalInvocations}/${runtime.maxInvocationsPerParse}.`);
    }
    if (runtime?.maxTokensPerParse !== undefined) {
        lines.push(`Token budget: ${usage.totalTokens}/${runtime.maxTokensPerParse}.`);
    }
    return lines;
}
function buildSpawnCommand(context, runtime) {
    const segments = ['\/spawn', 'parserator-lean-fallback'];
    if (context.planId) {
        segments.push(`--plan-id=${context.planId}`);
    }
    if (context.planVersion) {
        segments.push(`--plan-version=${context.planVersion}`);
    }
    if (context.planOrigin) {
        segments.push(`--plan-origin=${context.planOrigin}`);
    }
    if (runtime.planConfidenceGate !== undefined) {
        segments.push(`--plan-gate=${runtime.planConfidenceGate}`);
    }
    if (runtime.maxInvocationsPerParse !== undefined) {
        segments.push(`--invocation-budget=${runtime.maxInvocationsPerParse}`);
    }
    if (runtime.maxTokensPerParse !== undefined) {
        segments.push(`--token-budget=${runtime.maxTokensPerParse}`);
    }
    return segments.join(' ');
}
//# sourceMappingURL=lean-llm-playbook.js.map