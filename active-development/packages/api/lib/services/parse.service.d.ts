/**
 * Parse Service for Parserator
 * Orchestrates the lightweight @parserator/core pipeline for API requests
 * while preserving compatibility with existing SaaS interfaces.
 */
import { ParseResponse as CoreParseResponse, ParseOptions, ParseratorProfileOption, ParseratorLeanLLMPlanRewriteState, ParseratorLeanLLMFieldFallbackState } from '@parserator/core';
import { GeminiService, ILLMOptions } from './llm.service';
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
    /** Optional profile to seed the core pipeline */
    coreProfile?: ParseratorProfileOption;
    /** Optional lean LLM plan rewrite configuration */
    leanPlanRewrite?: ILeanPlanRewriteConfig;
    /** Optional lean LLM field fallback configuration */
    leanFieldFallback?: ILeanFieldFallbackConfig;
}
export interface ILeanPlanRewriteConfig {
    enabled?: boolean;
    minHeuristicConfidence?: number;
    concurrency?: number;
    cooldownMs?: number;
    requestOptions?: ILLMOptions;
}
export interface ILeanFieldFallbackConfig {
    enabled?: boolean;
    includeOptionalFields?: boolean;
    minConfidence?: number;
    concurrency?: number;
    requestOptions?: ILLMOptions;
}
export interface ILeanOrchestrationSnapshot {
    /** ISO timestamp when the snapshot was generated */
    generatedAt: string;
    /** Current lean plan rewrite state from the core */
    planRewriteState: ParseratorLeanLLMPlanRewriteState;
    /** Current lean field fallback state from the core */
    fieldFallbackState: ParseratorLeanLLMFieldFallbackState;
    /** Operational observations describing readiness for external launch toggles */
    readinessNotes: string[];
    /** Suggested next actions to move toward public launch */
    recommendedActions: string[];
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
    private leanPlanClient?;
    private leanFieldClient?;
    private static readonly DEFAULT_CONFIG;
    constructor(geminiService: GeminiService, config?: Partial<IParseConfig>, logger?: Console);
    /**
     * Main parsing method that delegates to the core pipeline
     */
    setCoreProfile(profile: ParseratorProfileOption): void;
    getCoreProfile(): string | undefined;
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
    getLeanPlanRewriteState(): ParseratorLeanLLMPlanRewriteState;
    getLeanFieldFallbackState(): ParseratorLeanLLMFieldFallbackState;
    getLeanOrchestrationSnapshot(): ILeanOrchestrationSnapshot;
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
    private buildLeanPlanRewriteOptions;
    private buildLeanFieldFallbackOptions;
    private configureLeanLLMFeatures;
}
//# sourceMappingURL=parse.service.d.ts.map