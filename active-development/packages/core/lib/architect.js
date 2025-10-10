"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeuristicArchitect = void 0;
const heuristics_1 = require("./heuristics");
const utils_1 = require("./utils");
class HeuristicArchitect {
    constructor(logger) {
        this.logger = logger;
    }
    async createPlan(context) {
        const start = Date.now();
        const diagnostics = [];
        const systemContext = (0, heuristics_1.detectSystemContext)(context.outputSchema, context.instructions);
        const steps = (0, heuristics_1.buildPlannerSteps)(context.outputSchema, context.instructions, context.options, context.config, systemContext).map(step => {
            if (!step.isRequired) {
                diagnostics.push({
                    field: step.targetKey,
                    stage: 'architect',
                    message: `${step.targetKey} marked as optional by schema heuristics`,
                    severity: 'info'
                });
            }
            return step;
        });
        if (systemContext) {
            diagnostics.push({
                field: '*',
                stage: 'architect',
                message: `Detected ${systemContext.label} context (${Math.round(systemContext.confidence * 100)}% confidence).`,
                severity: 'info'
            });
            const rationale = systemContext.rationale[0];
            if (rationale) {
                diagnostics.push({
                    field: '*',
                    stage: 'architect',
                    message: rationale,
                    severity: 'info'
                });
            }
        }
        const plan = {
            id: `plan_${Date.now().toString(36)}`,
            version: '1.0',
            steps,
            strategy: context.config.defaultStrategy,
            confidenceThreshold: context.options?.confidenceThreshold ?? context.config.minConfidence,
            metadata: {
                detectedFormat: (0, heuristics_1.detectFormat)(context.inputData),
                complexity: (0, heuristics_1.estimateComplexity)(steps.length, context.inputData.length),
                estimatedTokens: (0, heuristics_1.estimateTokenCost)(steps.length, context.inputData.length),
                origin: 'heuristic',
                context: systemContext
            }
        };
        const confidence = steps.length > 0 ? (0, utils_1.clamp)(0.68 + steps.length * 0.01, 0, 0.92) : 0.65;
        this.logger.debug?.('parserator-core:architect-plan', {
            fields: steps.length,
            strategy: plan.strategy,
            confidence
        });
        return {
            success: true,
            searchPlan: plan,
            tokensUsed: Math.max(48, Math.round(plan.metadata.estimatedTokens * 0.3)),
            processingTimeMs: Date.now() - start,
            confidence,
            diagnostics
        };
    }
}
exports.HeuristicArchitect = HeuristicArchitect;
//# sourceMappingURL=architect.js.map