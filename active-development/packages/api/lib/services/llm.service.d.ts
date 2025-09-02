/**
 * Gemini LLM Service for Parserator
 * Provides robust integration with Google's Gemini 1.5 Flash for the two-stage parsing process
 */
import { GenerationConfig } from '@google/generative-ai';
/**
 * Configuration options for LLM calls
 */
export interface ILLMOptions {
    /** Maximum number of tokens to generate */
    maxTokens?: number;
    /** Temperature for response generation (0.0 to 1.0) */
    temperature?: number;
    /** Top-p sampling parameter */
    topP?: number;
    /** Top-k sampling parameter */
    topK?: number;
    /** Stop sequences to halt generation */
    stopSequences?: string[];
    /** Timeout in milliseconds for the request */
    timeoutMs?: number;
    /** Model variant to use */
    model?: string;
    /** Request ID for tracking and debugging */
    requestId?: string;
}
/**
 * Response from Gemini LLM service
 */
export interface ILLMResponse {
    /** Generated content from the model */
    content: string;
    /** Number of tokens used in the request */
    tokensUsed: number;
    /** Model that generated the response */
    model: string;
    /** Reason the generation finished */
    finishReason: string;
    /** Response time in milliseconds */
    responseTimeMs: number;
    /** Safety ratings from the model */
    safetyRatings?: any[];
    /** Raw response metadata */
    metadata?: Record<string, any>;
}
/**
 * Error thrown when LLM service encounters an issue
 */
export declare class LLMError extends Error {
    code: string;
    statusCode?: number | undefined;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, statusCode?: number | undefined, details?: Record<string, unknown> | undefined);
}
/**
 * Service for interacting with Google's Gemini 1.5 Flash model
 * Handles authentication, retries, error handling, and token optimization
 */
export declare class GeminiService {
    private apiKey;
    private genAI;
    private model;
    private defaultConfig;
    private logger;
    private static readonly DEFAULT_OPTIONS;
    constructor(apiKey: string, logger?: Console);
    /**
     * Call Gemini with robust error handling and retry logic
     */
    callGemini(prompt: string, options?: ILLMOptions): Promise<ILLMResponse>;
    /**
     * Execute LLM call with exponential backoff retry logic
     */
    private callWithRetry;
    /**
     * Execute a single LLM call
     */
    private executeLLMCall;
    /**
     * Validate prompt input
     */
    private validatePrompt;
    /**
     * Check if an error should not be retried
     */
    private isNonRetryableError;
    /**
     * Extract token usage from Gemini response
     */
    private extractTokenUsage;
    /**
     * Extract finish reason from Gemini response
     */
    private extractFinishReason;
    /**
     * Estimate token count for text (rough approximation)
     */
    private estimateTokens;
    /**
     * Generate unique request ID for tracking
     */
    private generateRequestId;
    /**
     * Delay helper for exponential backoff
     */
    private delay;
    /**
     * Test the Gemini connection with a simple prompt
     */
    testConnection(): Promise<boolean>;
    /**
     * Get current model configuration
     */
    getModelInfo(): {
        model: string;
        config: GenerationConfig;
    };
}
//# sourceMappingURL=llm.service.d.ts.map