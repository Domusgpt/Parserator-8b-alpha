/**
 * Gemini LLM Service for Parserator
 * Provides robust integration with Google's Gemini 1.5 Flash for the two-stage parsing process
 */

import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

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
export class LLMError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * Service for interacting with Google's Gemini 1.5 Flash model
 * Handles authentication, retries, error handling, and token optimization
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private defaultConfig: GenerationConfig;
  private logger: Console;

  // Default configuration optimized for Parserator
  private static readonly DEFAULT_OPTIONS: Required<Omit<ILLMOptions, 'requestId'>> = {
    maxTokens: 4096,
    temperature: 0.1,
    topP: 0.8,
    topK: 40,
    stopSequences: [],
    timeoutMs: 30000,
    model: 'gemini-1.5-flash'
  };

  constructor(
    private apiKey: string,
    logger?: Console
  ) {
    if (!apiKey) {
      throw new LLMError('Gemini API key is required', 'MISSING_API_KEY');
    }

    this.logger = logger || console;
    this.genAI = new GoogleGenerativeAI(apiKey);
    
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
  async callGemini(
    prompt: string, 
    options: ILLMOptions = {}
  ): Promise<ILLMResponse> {
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
  private async callWithRetry(
    model: GenerativeModel,
    prompt: string,
    config: Required<Omit<ILLMOptions, 'requestId'>>,
    requestId: string,
    startTime: number,
    maxRetries: number = 3
  ): Promise<ILLMResponse> {
    let attempt = 0;
    let lastError: Error | undefined;

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
        
      } catch (error) {
        attempt++;
        lastError = error as Error;
        
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
    throw new LLMError(
      `Gemini call failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      'LLM_CALL_FAILED',
      undefined,
      {
        requestId,
        attempts: maxRetries,
        responseTimeMs: responseTime,
        originalError: lastError?.message || 'Unknown error',
        promptLength: prompt.length
      }
    );
  }

  /**
   * Execute a single LLM call
   */
  private async executeLLMCall(
    model: GenerativeModel,
    prompt: string,
    config: Required<Omit<ILLMOptions, 'requestId'>>,
    requestId: string
  ): Promise<Omit<ILLMResponse, 'responseTimeMs'>> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new LLMError(
          `Request timed out after ${config.timeoutMs}ms`,
          'REQUEST_TIMEOUT',
          408,
          { requestId, timeoutMs: config.timeoutMs }
        ));
      }, config.timeoutMs);
    });

    // Create generation config
    const generationConfig: GenerationConfig = {
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
        throw new LLMError(
          'No response received from Gemini',
          'EMPTY_RESPONSE',
          500,
          { requestId }
        );
      }

      const response = result.response;
      const content = response.text();

      if (!content || content.trim().length === 0) {
        throw new LLMError(
          'Empty content received from Gemini',
          'EMPTY_CONTENT',
          500,
          { requestId }
        );
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

    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }

      // Handle Google AI specific errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('api key')) {
          throw new LLMError(
            'Invalid or missing Gemini API key',
            'INVALID_API_KEY',
            401,
            { requestId, originalError: error.message }
          );
        }
        
        if (message.includes('quota') || message.includes('rate limit')) {
          throw new LLMError(
            'Gemini API quota exceeded or rate limited',
            'QUOTA_EXCEEDED',
            429,
            { requestId, originalError: error.message }
          );
        }
        
        if (message.includes('safety') || message.includes('blocked')) {
          throw new LLMError(
            'Content blocked by Gemini safety filters',
            'CONTENT_BLOCKED',
            400,
            { requestId, originalError: error.message }
          );
        }
      }

      throw new LLMError(
        `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        500,
        { 
          requestId, 
          originalError: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }

  /**
   * Validate prompt input
   */
  private validatePrompt(prompt: string): void {
    if (!prompt || typeof prompt !== 'string') {
      throw new LLMError(
        'Prompt must be a non-empty string',
        'INVALID_PROMPT',
        400
      );
    }

    if (prompt.length > 1000000) { // 1MB limit
      throw new LLMError(
        'Prompt exceeds maximum length of 1MB',
        'PROMPT_TOO_LONG',
        400,
        { promptLength: prompt.length }
      );
    }

    if (prompt.trim().length === 0) {
      throw new LLMError(
        'Prompt cannot be empty or only whitespace',
        'EMPTY_PROMPT',
        400
      );
    }
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
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
  private extractTokenUsage(response: any): number {
    try {
      // Gemini provides usage metadata in the response
      const usage = response.usageMetadata;
      if (usage) {
        return (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);
      }
      
      // Fallback to estimation if no usage data
      const content = response.text() || '';
      return this.estimateTokens(content);
    } catch (error) {
      this.logger.warn('Failed to extract token usage, using estimation', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return this.estimateTokens(response.text() || '');
    }
  }

  /**
   * Extract finish reason from Gemini response
   */
  private extractFinishReason(response: any): string {
    try {
      return response.candidates?.[0]?.finishReason || 'STOP';
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
  }

  /**
   * Delay helper for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test the Gemini connection with a simple prompt
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callGemini(
        'Test connection. Please respond with "OK".',
        { maxTokens: 10, timeoutMs: 10000 }
      );
      
      return response.content.toUpperCase().includes('OK');
    } catch (error) {
      this.logger.error('Gemini connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get current model configuration
   */
  getModelInfo(): { model: string; config: GenerationConfig } {
    return {
      model: GeminiService.DEFAULT_OPTIONS.model,
      config: this.defaultConfig
    };
  }
}