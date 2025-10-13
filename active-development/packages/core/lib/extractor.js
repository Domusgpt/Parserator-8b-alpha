"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegexExtractor = void 0;
const resolvers_1 = require("./resolvers");
const resolver_constants_1 = require("./resolver-constants");
const utils_1 = require("./utils");
class RegexExtractor {
    constructor(logger, registry) {
        this.logger = logger;
        this.registry = registry ?? new resolvers_1.ResolverRegistry((0, resolvers_1.createDefaultResolvers)(logger), logger);
    }
    attachRegistry(registry) {
        this.registry = registry;
    }
    async execute(context) {
        const start = Date.now();
        const parsed = {};
        const diagnostics = [];
        let resolvedRequired = 0;
        let requiredCount = 0;
        let aggregatedConfidence = 0;
        const sharedState = new Map();
        sharedState.set(resolver_constants_1.SHARED_PLAN_KEY, context.plan);
        if (context.instructions) {
            sharedState.set(resolver_constants_1.SHARED_INSTRUCTIONS_KEY, context.instructions);
        }
        if (context.outputSchema) {
            sharedState.set(resolver_constants_1.SHARED_SCHEMA_KEY, context.outputSchema);
        }
        if (context.requestId) {
            sharedState.set(resolver_constants_1.SHARED_REQUEST_ID_KEY, context.requestId);
        }
        if (context.sessionId) {
            sharedState.set(resolver_constants_1.SHARED_SESSION_ID_KEY, context.sessionId);
        }
        if (context.profile) {
            sharedState.set(resolver_constants_1.SHARED_PROFILE_KEY, context.profile);
        }
        for (const step of context.plan.steps) {
            if (step.isRequired) {
                requiredCount += 1;
            }
            const resolution = await this.registry.resolve({
                inputData: context.inputData,
                step,
                config: context.config,
                logger: this.logger,
                shared: sharedState
            });
            if (resolution) {
                diagnostics.push(...resolution.diagnostics);
                if (resolution.value !== undefined) {
                    parsed[step.targetKey] = resolution.value;
                    if (step.isRequired) {
                        resolvedRequired += 1;
                    }
                    sharedState.set(`${resolver_constants_1.SHARED_RESOLVED_FIELD_PREFIX}${step.targetKey}`, resolution.value);
                }
                aggregatedConfidence += computeStepConfidence(step.isRequired, resolution.confidence, resolution.value);
            }
            else {
                diagnostics.push({
                    field: step.targetKey,
                    stage: 'extractor',
                    message: `${step.targetKey} not found by any resolver`,
                    severity: step.isRequired ? 'warning' : 'info'
                });
                aggregatedConfidence += step.isRequired ? 0 : 0.2;
            }
        }
        const success = requiredCount === 0 || resolvedRequired === requiredCount;
        const processingTimeMs = Date.now() - start;
        const tokensUsed = Math.max(72, Math.round(context.plan.metadata.estimatedTokens * 0.7));
        if (!success) {
            const missing = context.plan.steps
                .filter(step => step.isRequired && !(step.targetKey in parsed))
                .map(step => step.targetKey);
            const error = {
                code: 'MISSING_REQUIRED_FIELDS',
                message: `Extractor could not resolve required fields: ${missing.join(', ')}`,
                stage: 'extractor',
                details: { missing }
            };
            diagnostics.push({
                field: '*',
                stage: 'extractor',
                message: error.message,
                severity: 'error'
            });
            return {
                success: false,
                parsedData: parsed,
                tokensUsed,
                processingTimeMs,
                confidence: (0, utils_1.clamp)(aggregatedConfidence / Math.max(context.plan.steps.length, 1), 0, 1),
                diagnostics,
                error
            };
        }
        const confidence = context.plan.steps.length
            ? (0, utils_1.clamp)(aggregatedConfidence / context.plan.steps.length, 0, 1)
            : 0;
        this.logger.debug?.('parserator-core:extraction-finished', {
            resolvedRequired,
            requiredCount,
            confidence,
            success
        });
        return {
            success: true,
            parsedData: parsed,
            tokensUsed,
            processingTimeMs,
            confidence,
            diagnostics
        };
    }
}
exports.RegexExtractor = RegexExtractor;
function computeStepConfidence(isRequired, resolverConfidence, value) {
    if (value === undefined) {
        return isRequired ? resolverConfidence : Math.max(resolverConfidence, 0.2);
    }
    const base = isRequired ? 0.7 : 0.5;
    return (0, utils_1.clamp)(Math.max(resolverConfidence, base), 0, 1);
}
//# sourceMappingURL=extractor.js.map