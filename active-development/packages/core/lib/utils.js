"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.createEmptyPlan = createEmptyPlan;
exports.createFailureResponse = createFailureResponse;
exports.toParseError = toParseError;
exports.isParseError = isParseError;
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
function createFailureResponse(options) {
    const { error, plan, requestId, diagnostics } = options;
    const metadata = {
        architectPlan: plan,
        confidence: 0,
        tokensUsed: options.tokensUsed ?? 0,
        processingTimeMs: options.processingTimeMs ?? 0,
        architectTokens: 0,
        extractorTokens: 0,
        requestId,
        timestamp: new Date().toISOString(),
        diagnostics
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
//# sourceMappingURL=utils.js.map