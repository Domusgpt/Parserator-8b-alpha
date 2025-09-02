/**
 * Architect Service for Parserator
 * Implements the first stage of the Architect-Extractor pattern
 * Creates detailed SearchPlans from output schemas and data samples
 */
import { IArchitectResult } from '../interfaces/search-plan.interface';
import { GeminiService } from './llm.service';
/**
 * Configuration for Architect operations
 */
export interface IArchitectConfig {
    /** Maximum length of data sample to analyze */
    maxSampleLength: number;
    /** Confidence threshold for accepting generated plans */
    minConfidenceThreshold: number;
    /** Maximum number of fields to extract */
    maxFieldCount: number;
    /** Version of the architect prompt */
    promptVersion: string;
    /** Timeout for architect operations */
    timeoutMs: number;
}
/**
 * Error thrown when Architect service encounters issues
 */
export declare class ArchitectError extends Error {
    code: string;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
/**
 * The Architect: First stage of the two-stage parsing process
 * Analyzes output schema and data sample to create a detailed SearchPlan
 */
export declare class ArchitectService {
    private geminiService;
    private config;
    private logger;
    private static readonly DEFAULT_CONFIG;
    constructor(geminiService: GeminiService, config?: Partial<IArchitectConfig>, logger?: Console);
    /**
     * Generate a SearchPlan from output schema and data sample
     */
    generateSearchPlan(outputSchema: Record<string, any>, dataSample: string, userInstructions?: string, requestId?: string): Promise<IArchitectResult>;
    /**
     * Build the optimized prompt for the Architect LLM
     */
    private buildArchitectPrompt;
    /**
     * Parse and validate the Architect's JSON response
     */
    private parseArchitectResponse;
    /**
     * Validate a single SearchStep
     */
    private validateSearchStep;
    /**
     * Validate the complete SearchPlan against the output schema
     */
    private validateSearchPlan;
    /**
     * Create an optimized sample from the input data
     */
    private createOptimizedSample;
    /**
     * Validate input parameters
     */
    private validateInputs;
    /**
     * Create an empty SearchPlan for error cases
     */
    private createEmptySearchPlan;
    /**
     * Generate unique operation ID for tracking
     */
    private generateOperationId;
    /**
     * Get current configuration
     */
    getConfig(): IArchitectConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<IArchitectConfig>): void;
}
//# sourceMappingURL=architect.service.d.ts.map