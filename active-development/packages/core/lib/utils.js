"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.createEmptyPlan = createEmptyPlan;
exports.clonePlan = clonePlan;
exports.createFailureResponse = createFailureResponse;
exports.toParseError = toParseError;
exports.isParseError = isParseError;
exports.stableStringify = stableStringify;
exports.createPlanCacheKey = createPlanCacheKey;
exports.validateParseRequest = validateParseRequest;
const heuristics_1 = require("./heuristics");
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function createEmptyPlan(request, config) {
    return {
        id: 'plan_empty',
        version: '1.0',
        steps: Object.keys(request.outputSchema).map(key => ({
            targetKey: key,
            description: `Pending extraction for ${(0, heuristics_1.humaniseKey)(key)}`,
            searchInstruction: 'No plan available.',
            validationType: 'string',
            isRequired: true
        })),
        strategy: config.defaultStrategy,
        confidenceThreshold: config.minConfidence,
        metadata: {
            detectedFormat: (0, heuristics_1.detectFormat)(request.inputData ?? ''),
            complexity: 'high',
            estimatedTokens: 0,
            origin: 'heuristic'
        }
    };
}
function clonePlan(plan, originOverride) {
    return {
        ...plan,
        steps: plan.steps.map(step => ({ ...step })),
        metadata: {
            ...plan.metadata,
            origin: originOverride ?? plan.metadata.origin
        }
    };
}
function createFailureResponse(options) {
    const { error, plan, requestId, diagnostics } = options;
    const metadata = {
        architectPlan: plan,
        confidence: 0,
        tokensUsed: options.tokensUsed ?? 0,
        processingTimeMs: options.processingTimeMs ?? 0,
        architectTokens: options.architectTokens ?? 0,
        extractorTokens: options.extractorTokens ?? 0,
        requestId,
        timestamp: new Date().toISOString(),
        diagnostics,
        stageBreakdown: options.stageBreakdown ?? {
            architect: {
                timeMs: options.processingTimeMs ?? 0,
                tokens: options.architectTokens ?? 0,
                confidence: 0
            },
            extractor: {
                timeMs: 0,
                tokens: options.extractorTokens ?? 0,
                confidence: 0
            }
        }
    };
    return {
        success: false,
        parsedData: {},
        metadata,
        error
    };
}
function toParseError(error, stage) {
    if (isParseError(error)) {
        return error;
    }
    return {
        code: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Unknown error',
        stage
    };
}
function isParseError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error &&
        'stage' in error);
}
function stableStringify(value) {
    return JSON.stringify(normalise(value));
}
function createPlanCacheKey(input) {
    return stableStringify({
        profile: input.profile ?? 'default',
        schema: stableStringify(input.outputSchema),
        instructions: input.instructions ?? '',
        options: input.options ? stableStringify(input.options) : undefined
    });
}
function normalise(value) {
    if (Array.isArray(value)) {
        return value.map(normalise);
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
            .map(([key, val]) => [key, normalise(val)])
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return entries.reduce((acc, [key, val]) => {
            acc[key] = val;
            return acc;
        }, {});
    }
    return value;
}
function validateParseRequest(request, config) {
    if (!request.inputData || typeof request.inputData !== 'string') {
        throw new Error('inputData must be a non-empty string');
    }
    const trimmed = request.inputData.trim();
    if (trimmed.length === 0) {
        throw new Error('inputData cannot be empty or whitespace');
    }
    if (trimmed.length > config.maxInputLength) {
        throw new Error(`inputData length ${trimmed.length} exceeds maximum ${config.maxInputLength}`);
    }
    if (!request.outputSchema || typeof request.outputSchema !== 'object') {
        throw new Error('outputSchema must be an object describing the expected fields');
    }
    const fields = Object.keys(request.outputSchema);
    if (fields.length === 0) {
        throw new Error('outputSchema must contain at least one field');
    }
    if (fields.length > config.maxSchemaFields) {
        throw new Error(`outputSchema has ${fields.length} fields which exceeds the limit of ${config.maxSchemaFields}`);
    }
    if (request.instructions !== undefined && typeof request.instructions !== 'string') {
        throw new Error('instructions must be a string when provided');
    }
}
//# sourceMappingURL=utils.js.map