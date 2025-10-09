"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParseRequest = exports.stableStringify = exports.isParseError = exports.toParseError = exports.createFailureResponse = exports.createEmptyPlan = exports.clamp = void 0;
const heuristics_1 = require("./heuristics");
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
exports.clamp = clamp;
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
exports.createEmptyPlan = createEmptyPlan;
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
exports.createFailureResponse = createFailureResponse;
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
exports.toParseError = toParseError;
function isParseError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error &&
        'stage' in error);
}
exports.isParseError = isParseError;
function stableStringify(value) {
    return JSON.stringify(normalise(value));
}
exports.stableStringify = stableStringify;
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
exports.validateParseRequest = validateParseRequest;
//# sourceMappingURL=utils.js.map