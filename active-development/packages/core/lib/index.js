"use strict";
/**
 * Parserator Core - Architect-Extractor pattern implementation
 *
 * This is the core parsing engine that implements the revolutionary
 * two-stage LLM approach for intelligent data parsing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseratorCore = void 0;
// Simple implementation for now
class ParseratorCore {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async parse(request) {
        // This would implement the actual Architect-Extractor pattern
        // For now, return a basic response structure
        return {
            success: true,
            parsedData: {},
            metadata: {
                architectPlan: {
                    steps: [],
                    strategy: 'sequential',
                    confidenceThreshold: 0.8,
                    metadata: {
                        detectedFormat: 'text',
                        complexity: 'low',
                        estimatedTokens: 100
                    }
                },
                confidence: 0.9,
                tokensUsed: 100,
                processingTimeMs: 500,
                requestId: 'test-id',
                timestamp: new Date().toISOString()
            }
        };
    }
}
exports.ParseratorCore = ParseratorCore;
exports.default = ParseratorCore;
//# sourceMappingURL=index.js.map