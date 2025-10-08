"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultArchitectModule = void 0;
const uuid_1 = require("uuid");
function inferValidationType(value) {
    if (typeof value === 'number')
        return 'number';
    if (typeof value === 'boolean')
        return 'boolean';
    if (Array.isArray(value)) {
        if (value.every(item => typeof item === 'number'))
            return 'number_array';
        return 'string_array';
    }
    if (value && typeof value === 'object')
        return 'object';
    return 'string';
}
function buildDiagnostics(job) {
    return [
        {
            stage: 'planner',
            severity: 'info',
            message: 'Architect module generated plan from schema',
            details: {
                fields: Object.keys(job.outputSchema).length,
                strategy: job.options?.confidenceThreshold ? 'custom' : 'default'
            }
        }
    ];
}
class DefaultArchitectModule {
    constructor() {
        this.name = 'planner/default-architect';
        this.kind = 'planner';
    }
    supports() {
        return true;
    }
    async execute(context, job) {
        const entries = Object.entries(job.outputSchema ?? {});
        const steps = entries.map(([key, descriptor]) => ({
            targetKey: key,
            description: `Extract ${key} from the source payload`,
            searchInstruction: `Identify the best candidate for “${key}” given the schema expectation.`,
            validationType: inferValidationType(descriptor),
            isRequired: true
        }));
        const plan = {
            id: (0, uuid_1.v4)(),
            version: '2024.09-agentic',
            steps,
            strategy: job.options?.confidenceThreshold ? 'adaptive' : 'sequential',
            confidenceThreshold: job.options?.confidenceThreshold ?? context.config.minConfidence,
            metadata: {
                detectedFormat: job.inputData.trim().startsWith('{') ? 'json' : 'text',
                complexity: steps.length > 20 ? 'high' : steps.length > 8 ? 'medium' : 'low',
                estimatedTokens: Math.max(32, Math.round(job.inputData.length / 6)),
                origin: 'model'
            }
        };
        return {
            success: true,
            output: plan,
            metadata: {
                confidence: 0.82,
                planPreview: steps.slice(0, 3).map(step => step.targetKey)
            },
            diagnostics: buildDiagnostics(job),
            tokensUsed: Math.round(steps.length * 18 + plan.metadata.estimatedTokens * 0.15)
        };
    }
}
exports.DefaultArchitectModule = DefaultArchitectModule;
//# sourceMappingURL=architect-module.js.map