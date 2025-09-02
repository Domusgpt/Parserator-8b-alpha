/**
 * Parserator Core - Architect-Extractor pattern implementation
 *
 * This is the core parsing engine that implements the revolutionary
 * two-stage LLM approach for intelligent data parsing.
 */
export interface SearchStep {
    targetKey: string;
    description: string;
    searchInstruction: string;
    validationType: ValidationType;
    isRequired: boolean;
}
export interface SearchPlan {
    steps: SearchStep[];
    strategy: 'sequential' | 'parallel' | 'adaptive';
    confidenceThreshold: number;
    metadata: {
        detectedFormat: string;
        complexity: 'low' | 'medium' | 'high';
        estimatedTokens: number;
    };
}
export type ValidationType = 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'date' | 'iso_date' | 'url' | 'string_array' | 'number_array' | 'object' | 'custom';
export interface ParseRequest {
    inputData: string;
    outputSchema: Record<string, any>;
    instructions?: string;
    options?: ParseOptions;
}
export interface ParseOptions {
    timeout?: number;
    retries?: number;
    validateOutput?: boolean;
    includeMetadata?: boolean;
    confidenceThreshold?: number;
}
export interface ParseResponse {
    success: boolean;
    parsedData: Record<string, any>;
    metadata: ParseMetadata;
    error?: ParseError;
}
export interface ParseMetadata {
    architectPlan: SearchPlan;
    confidence: number;
    tokensUsed: number;
    processingTimeMs: number;
    requestId: string;
    timestamp: string;
}
export interface ParseError {
    code: string;
    message: string;
    details?: Record<string, any>;
    suggestion?: string;
}
export declare class ParseratorCore {
    private apiKey;
    constructor(apiKey: string);
    parse(request: ParseRequest): Promise<ParseResponse>;
}
export default ParseratorCore;
//# sourceMappingURL=index.d.ts.map