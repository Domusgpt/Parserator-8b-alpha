/**
 * Extractor Service for Parserator
 * Implements the second stage of the Architect-Extractor pattern
 * Executes SearchPlans to extract structured data from unstructured input
 */
import { ISearchPlan, IExtractorResult } from '../interfaces/search-plan.interface';
import { GeminiService } from './llm.service';
/**
 * Configuration for Extractor operations
 */
export interface IExtractorConfig {
    /** Maximum input data length */
    maxInputLength: number;
    /** Minimum confidence threshold for accepting results */
    minConfidenceThreshold: number;
    /** Timeout for extractor operations */
    timeoutMs: number;
    /** Whether to use fallback strategies for failed extractions */
    useFallbacks: boolean;
    /** Maximum retries for individual field extraction */
    maxFieldRetries: number;
}
/**
 * Error thrown when Extractor service encounters issues
 */
export declare class ExtractorError extends Error {
    code: string;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
/**
 * The Extractor: Second stage of the two-stage parsing process
 * Executes SearchPlans to extract structured data from full input data
 */
export declare class ExtractorService {
    private geminiService;
    private config;
    private logger;
    private static readonly DEFAULT_CONFIG;
    constructor(geminiService: GeminiService, config?: Partial<IExtractorConfig>, logger?: Console);
    /**
     * Execute a SearchPlan to extract structured data
     */
    executeSearchPlan(inputData: string, searchPlan: ISearchPlan, requestId?: string): Promise<IExtractorResult>;
    /**
     * Build the optimized prompt for the Extractor LLM
     */
    private buildExtractorPrompt;
    /**
     * Parse and validate the Extractor's JSON response
     */
    private parseExtractorResponse;
    /**
     * Validate extracted data against expected types
     */
    private validateExtractedData;
    /**
     * Validate a single field against its expected type
     */
    private validateFieldType;
    /**
     * Calculate confidence scores for each extracted field
     */
    private calculateFieldConfidence;
    /**
     * Calculate overall confidence score
     */
    private calculateOverallConfidence;
    /**
     * Identify fields that failed extraction
     */
    private identifyFailedFields;
    /**
     * Validate input parameters
     */
    private validateInputs;
    /**
     * Generate unique operation ID for tracking
     */
    private generateOperationId;
    /**
     * Get current configuration
     */
    getConfig(): IExtractorConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<IExtractorConfig>): void;
}
//# sourceMappingURL=extractor.service.d.ts.map