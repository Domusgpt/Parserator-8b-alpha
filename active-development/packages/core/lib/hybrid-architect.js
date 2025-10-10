"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHybridArchitect = createHybridArchitect;
const async_queue_1 = require("./async-queue");
const utils_1 = require("./utils");
const DEFAULT_MIN_CONFIDENCE = 0.75;
const DEFAULT_COOLDOWN_MS = 5000;
function normalisePlanMetadata(base, candidate) {
    const plan = (0, utils_1.clonePlan)(candidate, 'model');
    const fallback = base.metadata;
    plan.metadata = {
        detectedFormat: candidate.metadata?.detectedFormat ?? fallback.detectedFormat,
        complexity: candidate.metadata?.complexity ?? fallback.complexity,
        estimatedTokens: candidate.metadata?.estimatedTokens ?? fallback.estimatedTokens,
        origin: 'model'
    };
    return plan;
}
function buildUsageDiagnostic(usage) {
    if (!usage) {
        return undefined;
    }
    const pieces = [];
    if (usage.tokensUsed !== undefined) {
        pieces.push(`${usage.tokensUsed} tokens`);
    }
    if (usage.latencyMs !== undefined) {
        pieces.push(`${usage.latencyMs}ms`);
    }
    if (usage.model) {
        pieces.push(usage.model);
    }
    if (pieces.length === 0) {
        return undefined;
    }
    return {
        field: '*',
        stage: 'architect',
        message: `Lean LLM rewrite usage: ${pieces.join(', ')}`,
        severity: 'info'
    };
}
function createHybridArchitect(options) {
    const { base, client, logger, minHeuristicConfidence = DEFAULT_MIN_CONFIDENCE, concurrency = 1, cooldownMs = DEFAULT_COOLDOWN_MS } = options;
    const queue = (0, async_queue_1.createAsyncTaskQueue)({
        concurrency: Math.max(1, Math.floor(concurrency)),
        onError: error => {
            logger?.error?.('parserator-core:lean-llm-plan-rewrite-queue-error', {
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });
    let lastAttemptAt = 0;
    return {
        async createPlan(context) {
            const heuristicStart = Date.now();
            const heuristicResult = await base.createPlan(context);
            const heuristicElapsed = Date.now() - heuristicStart;
            if (!heuristicResult.success || !heuristicResult.searchPlan) {
                return heuristicResult;
            }
            const diagnostics = [...heuristicResult.diagnostics];
            const baseThreshold = Math.max(minHeuristicConfidence, context.config.minConfidence);
            const requestedThreshold = context.options?.confidenceThreshold
                ? Math.max(context.options.confidenceThreshold, baseThreshold)
                : baseThreshold;
            if (heuristicResult.confidence >= requestedThreshold) {
                return {
                    ...heuristicResult,
                    diagnostics
                };
            }
            const now = Date.now();
            const cooldownWindow = Math.max(0, cooldownMs);
            if (cooldownWindow > 0 && lastAttemptAt && now - lastAttemptAt < cooldownWindow) {
                diagnostics.push({
                    field: '*',
                    stage: 'architect',
                    message: 'Lean LLM rewrite skipped due to cooldown window',
                    severity: 'info'
                });
                return {
                    ...heuristicResult,
                    diagnostics
                };
            }
            lastAttemptAt = now;
            try {
                const rewriteStart = Date.now();
                const response = await queue.enqueue(() => client.rewrite({
                    inputData: context.inputData,
                    outputSchema: context.outputSchema,
                    instructions: context.instructions,
                    heuristicPlan: (0, utils_1.clonePlan)(heuristicResult.searchPlan, heuristicResult.searchPlan.metadata.origin),
                    diagnostics,
                    context: {
                        profile: context.profile,
                        requestId: context.requestId,
                        sessionId: context.sessionId
                    }
                }));
                const rewriteDuration = Date.now() - rewriteStart;
                if (!response?.plan) {
                    diagnostics.push({
                        field: '*',
                        stage: 'architect',
                        message: 'Lean LLM rewrite returned no plan; continuing with heuristic result',
                        severity: 'warning'
                    });
                    return {
                        ...heuristicResult,
                        diagnostics
                    };
                }
                const rewrittenPlan = normalisePlanMetadata(heuristicResult.searchPlan, response.plan);
                const rewriteConfidence = (0, utils_1.clamp)(Math.max(heuristicResult.confidence, response.confidence ?? requestedThreshold), 0, 1);
                diagnostics.push({
                    field: '*',
                    stage: 'architect',
                    message: 'Lean LLM rewrite applied over heuristic plan',
                    severity: 'info'
                });
                if (response.diagnostics?.length) {
                    diagnostics.push(...response.diagnostics);
                }
                const usageDiagnostic = buildUsageDiagnostic(response.usage);
                if (usageDiagnostic) {
                    diagnostics.push(usageDiagnostic);
                }
                const rewriteTokens = response.usage?.tokensUsed ?? Math.max(48, Math.round(rewrittenPlan.steps.length * 6));
                const heuristicDuration = Math.max(heuristicResult.processingTimeMs, heuristicElapsed);
                return {
                    success: true,
                    searchPlan: rewrittenPlan,
                    tokensUsed: heuristicResult.tokensUsed + rewriteTokens,
                    processingTimeMs: heuristicDuration + rewriteDuration,
                    confidence: rewriteConfidence,
                    diagnostics
                };
            }
            catch (error) {
                logger?.warn?.('parserator-core:lean-llm-plan-rewrite-error', {
                    message: error instanceof Error ? error.message : String(error)
                });
                diagnostics.push({
                    field: '*',
                    stage: 'architect',
                    message: `Lean LLM rewrite failed: ${error instanceof Error ? error.message : String(error)}`,
                    severity: 'warning'
                });
                return {
                    ...heuristicResult,
                    diagnostics
                };
            }
        }
    };
}
//# sourceMappingURL=hybrid-architect.js.map