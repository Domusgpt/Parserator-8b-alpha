"use strict";
/**
 * Gemini LLM Service for Parserator
 * Provides robust integration with Google's Gemini 1.5 Flash for the two-stage parsing process
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = exports.LLMError = void 0;
const generative_ai_1 = require("@google/generative-ai");
/**
 * Error thrown when LLM service encounters an issue
 */
class LLMError extends Error {
    constructor(message, code, statusCode, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'LLMError';
    }
}
exports.LLMError = LLMError;
/**
 * Service for interacting with Google's Gemini 1.5 Flash model
 * Handles authentication, retries, error handling, and token optimization
 */
class GeminiService {
    constructor(apiKey, logger) {
        this.apiKey = apiKey;
        if (!apiKey) {
            throw new LLMError('Gemini API key is required', 'MISSING_API_KEY');
        }
        this.logger = logger || console;
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // Initialize with default model
        this.model = this.genAI.getGenerativeModel({
            model: GeminiService.DEFAULT_OPTIONS.model
        });
        this.defaultConfig = {
            maxOutputTokens: GeminiService.DEFAULT_OPTIONS.maxTokens,
            temperature: GeminiService.DEFAULT_OPTIONS.temperature,
            topP: GeminiService.DEFAULT_OPTIONS.topP,
            topK: GeminiService.DEFAULT_OPTIONS.topK,
            stopSequences: GeminiService.DEFAULT_OPTIONS.stopSequences
        };
        this.logger.info('GeminiService initialized', {
            model: GeminiService.DEFAULT_OPTIONS.model,
            service: 'gemini'
        });
    }
    /**
     * Call Gemini with robust error handling and retry logic
     */
    async callGemini(prompt, options = {}) {
        const startTime = Date.now();
        const requestId = options.requestId || this.generateRequestId();
        const config = { ...GeminiService.DEFAULT_OPTIONS, ...options };
        this.logger.info('Starting Gemini request', {
            requestId,
            promptLength: prompt.length,
            model: config.model,
            operation: 'callGemini'
        });
        // Validate inputs
        this.validatePrompt(prompt);
        // Get appropriate model if different from default
        const model = config.model !== GeminiService.DEFAULT_OPTIONS.model
            ? this.genAI.getGenerativeModel({ model: config.model })
            : this.model;
        return this.callWithRetry(model, prompt, config, requestId, startTime);
    }
    /**
     * Execute LLM call with exponential backoff retry logic
     */
    async callWithRetry(model, prompt, config, requestId, startTime, maxRetries = 3) {
        let attempt = 0;
        let lastError;
        while (attempt < maxRetries) {
            try {
                const response = await this.executeLLMCall(model, prompt, config, requestId);
                const responseTime = Date.now() - startTime;
                this.logger.info('Gemini request successful', {
                    requestId,
                    attempt: attempt + 1,
                    responseTimeMs: responseTime,
                    tokensUsed: response.tokensUsed,
                    operation: 'callGemini'
                });
                return {
                    ...response,
                    responseTimeMs: responseTime
                };
            }
            catch (error) {
                attempt++;
                lastError = error;
                this.logger.error('Gemini request failed', {
                    requestId,
                    attempt,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    operation: 'callGemini'
                });
                // Don't retry certain error types
                if (this.isNonRetryableError(error)) {
                    break;
                }
                // If we have more attempts, wait with exponential backoff
                if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    await this.delay(delayMs);
                }
            }
        }
        // All retries failed
        const responseTime = Date.now() - startTime;
        throw new LLMError(`Gemini call failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`, 'LLM_CALL_FAILED', undefined, {
            requestId,
            attempts: maxRetries,
            responseTimeMs: responseTime,
            originalError: lastError?.message || 'Unknown error',
            promptLength: prompt.length
        });
    }
    /**
     * Execute a single LLM call
     */
    async executeLLMCall(model, prompt, config, requestId) {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new LLMError(`Request timed out after ${config.timeoutMs}ms`, 'REQUEST_TIMEOUT', 408, { requestId, timeoutMs: config.timeoutMs }));
            }, config.timeoutMs);
        });
        // Create generation config
        const generationConfig = {
            maxOutputTokens: config.maxTokens,
            temperature: config.temperature,
            topP: config.topP,
            topK: config.topK,
            stopSequences: config.stopSequences.length > 0 ? config.stopSequences : undefined
        };
        try {
            // Race between API call and timeout
            const result = await Promise.race([
                model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig
                }),
                timeoutPromise
            ]);
            // Validate response
            if (!result.response) {
                throw new LLMError('No response received from Gemini', 'EMPTY_RESPONSE', 500, { requestId });
            }
            const response = result.response;
            const content = response.text();
            if (!content || content.trim().length === 0) {
                throw new LLMError('Empty content received from Gemini', 'EMPTY_CONTENT', 500, { requestId });
            }
            // Extract token usage and other metadata
            const tokensUsed = this.extractTokenUsage(response);
            const finishReason = this.extractFinishReason(response);
            const safetyRatings = response.candidates?.[0]?.safetyRatings || [];
            return {
                content,
                tokensUsed,
                model: config.model,
                finishReason,
                safetyRatings,
                metadata: {
                    requestId,
                    promptTokens: this.estimateTokens(prompt),
                    completionTokens: this.estimateTokens(content)
                }
            };
        }
        catch (error) {
            if (error instanceof LLMError) {
                throw error;
            }
            // Handle Google AI specific errors
            if (error instanceof Error) {
                const message = error.message.toLowerCase();
                if (message.includes('api key')) {
                    throw new LLMError('Invalid or missing Gemini API key', 'INVALID_API_KEY', 401, { requestId, originalError: error.message });
                }
                if (message.includes('quota') || message.includes('rate limit')) {
                    throw new LLMError('Gemini API quota exceeded or rate limited', 'QUOTA_EXCEEDED', 429, { requestId, originalError: error.message });
                }
                if (message.includes('safety') || message.includes('blocked')) {
                    throw new LLMError('Content blocked by Gemini safety filters', 'CONTENT_BLOCKED', 400, { requestId, originalError: error.message });
                }
            }
            throw new LLMError(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'API_ERROR', 500, {
                requestId,
                originalError: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Validate prompt input
     */
    validatePrompt(prompt) {
        if (!prompt || typeof prompt !== 'string') {
            throw new LLMError('Prompt must be a non-empty string', 'INVALID_PROMPT', 400);
        }
        if (prompt.length > 1000000) { // 1MB limit
            throw new LLMError('Prompt exceeds maximum length of 1MB', 'PROMPT_TOO_LONG', 400, { promptLength: prompt.length });
        }
        if (prompt.trim().length === 0) {
            throw new LLMError('Prompt cannot be empty or only whitespace', 'EMPTY_PROMPT', 400);
        }
    }
    /**
     * Check if an error should not be retried
     */
    isNonRetryableError(error) {
        if (error instanceof LLMError) {
            const nonRetryableCodes = [
                'INVALID_API_KEY',
                'INVALID_PROMPT',
                'PROMPT_TOO_LONG',
                'EMPTY_PROMPT',
                'CONTENT_BLOCKED'
            ];
            return nonRetryableCodes.includes(error.code);
        }
        return false;
    }
    /**
     * Extract token usage from Gemini response
     */
    extractTokenUsage(response) {
        try {
            // Gemini provides usage metadata in the response
            const usage = response.usageMetadata;
            if (usage) {
                return (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);
            }
            // Fallback to estimation if no usage data
            const content = response.text() || '';
            return this.estimateTokens(content);
        }
        catch (error) {
            this.logger.warn('Failed to extract token usage, using estimation', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return this.estimateTokens(response.text() || '');
        }
    }
    /**
     * Extract finish reason from Gemini response
     */
    extractFinishReason(response) {
        try {
            return response.candidates?.[0]?.finishReason || 'STOP';
        }
        catch (error) {
            return 'UNKNOWN';
        }
    }
    /**
     * Estimate token count for text (rough approximation)
     */
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    }
    /**
     * Generate unique request ID for tracking
     */
    generateRequestId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `req_${timestamp}_${random}`;
    }
    /**
     * Delay helper for exponential backoff
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Test the Gemini connection with a simple prompt
     */
    async testConnection() {
        try {
            const response = await this.callGemini('Test connection. Please respond with "OK".', { maxTokens: 10, timeoutMs: 10000 });
            return response.content.toUpperCase().includes('OK');
        }
        catch (error) {
            this.logger.error('Gemini connection test failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    /**
     * Get current model configuration
     */
    getModelInfo() {
        return {
            model: GeminiService.DEFAULT_OPTIONS.model,
            config: this.defaultConfig
        };
    }
}
exports.GeminiService = GeminiService;
// Default configuration optimized for Parserator
GeminiService.DEFAULT_OPTIONS = {
    maxTokens: 4096,
    temperature: 0.1,
    topP: 0.8,
    topK: 40,
    stopSequences: [],
    timeoutMs: 30000,
    model: 'gemini-1.5-flash'
};
//# sourceMappingURL=llm.service.js.map