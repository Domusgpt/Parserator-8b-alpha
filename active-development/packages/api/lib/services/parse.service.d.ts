/**
 * Parse Service for Parserator
 * Orchestrates the lightweight @parserator/core pipeline for API requests
 * while preserving compatibility with existing SaaS interfaces.
 */
import { ParseResponse as CoreParseResponse, ParseOptions } from '@parserator/core';
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
    /** Whether to enable low-confidence warnings (historical fallback flag) */
    enableFallbacks: boolean;
    /** Minimum confidence threshold for accepting results */
    minOverallConfidence: number;
    /** Optional default ParseOptions passed to the core */
    defaultOptions?: ParseOptions;
    /** Optional strategy override for the core planner */
    coreStrategy?: 'sequential' | 'parallel' | 'adaptive';
    /** API key forwarded to the core (not used by heuristics but required) */
    coreApiKey?: string;
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
    /** Optional overrides forwarded to the core */
    options?: ParseOptions;
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
export type IParseResult = CoreParseResponse;
/**
 * Main parsing service that orchestrates the @parserator/core workflow
 */
export declare class ParseService {
    private readonly geminiService;
    private config;
    private logger;
    private readonly core;
    private static readonly DEFAULT_CONFIG;
    constructor(geminiService: GeminiService, config?: Partial<IParseConfig>, logger?: Console);
    /**
     * Main parsing method that delegates to the core pipeline
     */
    parse(request: IParseRequest): Promise<IParseResult>;
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
    private createCoreLogger;
    private normaliseCoreResult;
    private logCoreOutcome;
    private createFailureResult;
    private createPlaceholderPlan;
    /**
     * Validate parse request inputs
     */
    private validateParseRequest;
    /**
     * Generate unique operation ID for tracking
     */
    private generateOperationId;
}
//# sourceMappingURL=parse.service.d.ts.map