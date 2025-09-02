/**
 * Parse Service for Parserator
 * Main orchestration service that coordinates the two-stage Architect-Extractor workflow
 * Provides the primary parsing interface for the SaaS API
 */
import { IParseResult } from '../interfaces/search-plan.interface';
import { GeminiService } from './llm.service';
/**
 * Configuration for Parse operations
 */
export interface IParseConfig {
    /** Maximum input data length */
    maxInputLength: number;
    /** Maximum output schema complexity */
    maxSchemaFields: number;
    /** Overall timeout for parsing operations */
    timeoutMs: number;
    /** Whether to enable fallback strategies */
    enableFallbacks: boolean;
    /** Sample size for Architect analysis */
    architectSampleSize: number;
    /** Minimum confidence threshold for accepting results */
    minOverallConfidence: number;
}
/**
 * Input parameters for parsing operations
 */
export interface IParseRequest {
    /** Raw unstructured input data */
    inputData: string;
    /** Desired output schema structure */
    outputSchema: Record<string, any>;
    /** Optional user instructions for parsing */
    instructions?: string;
    /** Request ID for tracking */
    requestId?: string;
    /** User ID for billing/analytics */
    userId?: string;
}
/**
 * Error thrown when Parse service encounters issues
 */
export declare class ParseError extends Error {
    code: string;
    stage: 'validation' | 'architect' | 'extractor' | 'orchestration';
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, stage: 'validation' | 'architect' | 'extractor' | 'orchestration', details?: Record<string, unknown> | undefined);
}
/**
 * Main parsing service that orchestrates the two-stage workflow
 * Provides intelligent data parsing with cost optimization and high accuracy
 */
export declare class ParseService {
    private geminiService;
    private config;
    private logger;
    private architectService;
    private extractorService;
    private static readonly DEFAULT_CONFIG;
    constructor(geminiService: GeminiService, config?: Partial<IParseConfig>, logger?: Console);
    /**
     * Main parsing method that orchestrates the two-stage workflow
     */
    parse(request: IParseRequest): Promise<IParseResult>;
    /**
     * Execute the Architect stage
     */
    private executeArchitectStage;
    /**
     * Execute the Extractor stage
     */
    private executeExtractorStage;
    /**
     * Combine results from both stages into final result
     */
    private combineResults;
    /**
     * Create a failure result with comprehensive error information
     */
    private createFailureResult;
    /**
     * Create an optimized sample from input data for the Architect
     */
    private createOptimizedSample;
    /**
     * Validate parse request inputs
     */
    private validateParseRequest;
    /**
     * Generate unique operation ID for tracking
     */
    private generateOperationId;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: Record<string, boolean>;
        timestamp: string;
    }>;
    /**
     * Get current configuration
     */
    getConfig(): IParseConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<IParseConfig>): void;
}
//# sourceMappingURL=parse.service.d.ts.map