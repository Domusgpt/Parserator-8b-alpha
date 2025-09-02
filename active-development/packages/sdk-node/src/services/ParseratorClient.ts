/**
 * Main Parserator SDK Client
 * Implements the Architect-Extractor pattern for intelligent data parsing
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { 
  ParseratorConfig, 
  ParseRequest, 
  ParseResponse, 
  BatchParseRequest, 
  BatchParseResponse,
  ParseError,
  ErrorCode,
  EventHandler,
  ParseEvent,
  RetryConfig,
  ProgressCallback
} from '../types';
import { validateConfig, validateParseRequest, getValidationErrorMessage } from '../types/validation';
import { ParseratorError } from '../errors';
import { retry } from '../utils/retry';
import { RateLimiter } from '../utils/rate-limiter';

export class ParseratorClient {
  private readonly axios: AxiosInstance;
  private readonly config: ParseratorConfig;
  private readonly rateLimiter: RateLimiter;
  private eventHandlers: EventHandler[] = [];

  constructor(config: ParseratorConfig) {
    // Validate configuration
    const { error } = validateConfig(config);
    if (error) {
      throw new ParseratorError(
        'INVALID_CONFIG' as ErrorCode,
        getValidationErrorMessage(error),
        { validationDetails: error.details }
      );
    }

    this.config = {
      baseUrl: 'https://app-5108296280.us-central1.run.app',
      timeout: 30000,
      retries: 3,
      debug: false,
      ...config
    };

    // Create axios instance with default configuration
    this.axios = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Parserator Node.js SDK v1.0.0'
      }
    });

    // Rate limiter to prevent overwhelming the API
    this.rateLimiter = new RateLimiter({ requestsPerSecond: 10 });

    // Setup request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Parse unstructured data using the Architect-Extractor pattern
   */
  async parse(request: ParseRequest): Promise<ParseResponse> {
    // Validate request
    const { error } = validateParseRequest(request);
    if (error) {
      throw new ParseratorError(
        'INVALID_INPUT' as ErrorCode,
        getValidationErrorMessage(error),
        { validationDetails: error.details }
      );
    }

    this.emitEvent({
      type: 'start',
      timestamp: new Date().toISOString(),
      data: { requestSize: request.inputData.length }
    });

    try {
      // Apply rate limiting
      await this.rateLimiter.acquire();

      // Merge with default options
      const finalRequest = {
        ...request,
        options: {
          ...this.config.defaultOptions,
          ...request.options
        }
      };

      // Make the API call with retry logic
      const response = await retry(
        () => this.axios.post<ParseResponse>('/v1/parse', finalRequest),
        this.getRetryConfig()
      );

      const result = response.data;

      this.emitEvent({
        type: 'complete',
        timestamp: new Date().toISOString(),
        data: {
          success: result.success,
          tokensUsed: result.metadata.tokensUsed,
          processingTime: result.metadata.processingTimeMs
        }
      });

      if (!result.success) {
        throw new ParseratorError(
          'PARSE_FAILED' as ErrorCode,
          result.error?.message || 'Parse operation failed',
          result.error?.details
        );
      }

      return result;

    } catch (error) {
      this.emitEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      if (error instanceof ParseratorError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        throw this.handleAxiosError(error);
      }

      throw new ParseratorError(
        'INTERNAL_ERROR' as ErrorCode,
        'An unexpected error occurred',
        { originalError: error }
      );
    }
  }

  /**
   * Parse multiple items in batch with concurrency control
   */
  async batchParse(
    request: BatchParseRequest,
    progressCallback?: ProgressCallback
  ): Promise<BatchParseResponse> {
    const { items, options = {} } = request;
    const { concurrency = 3, failFast = false, preserveOrder = true } = options;

    if (items.length === 0) {
      throw new ParseratorError(
        'INVALID_INPUT' as ErrorCode,
        'Batch request must contain at least one item'
      );
    }

    const results: (ParseResponse | ParseError)[] = new Array(items.length);
    const startTime = Date.now();
    let completed = 0;
    let successful = 0;
    let failed = 0;
    let totalTokensUsed = 0;

    // Create a semaphore for concurrency control
    const semaphore = new Array(concurrency).fill(null);
    let currentIndex = 0;

    const processItem = async (index: number): Promise<void> => {
      try {
        const result = await this.parse(items[index]);
        results[index] = result;
        successful++;
        totalTokensUsed += result.metadata.tokensUsed;
      } catch (error) {
        const parseError: ParseError = {
          code: error instanceof ParseratorError ? error.code : 'INTERNAL_ERROR' as ErrorCode,
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof ParseratorError ? error.details : undefined
        };
        
        results[index] = parseError;
        failed++;

        if (failFast) {
          throw error;
        }
      } finally {
        completed++;
        
        if (progressCallback) {
          const estimatedTimeRemaining = completed > 0 
            ? ((Date.now() - startTime) / completed) * (items.length - completed)
            : undefined;
            
          progressCallback({
            completed,
            total: items.length,
            currentItem: `Item ${index + 1}`,
            estimatedTimeRemaining
          });
        }
      }
    };

    // Process items with controlled concurrency
    const processNext = async (): Promise<void> => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        await processItem(index);
      }
    };

    try {
      // Start concurrent processing
      await Promise.all(semaphore.map(() => processNext()));

      return {
        results: preserveOrder ? results : results.filter(r => r !== undefined),
        summary: {
          total: items.length,
          successful,
          failed,
          totalTokensUsed,
          totalProcessingTimeMs: Date.now() - startTime
        }
      };
      
    } catch (error) {
      if (failFast) {
        throw error;
      }
      
      // This shouldn't happen since we catch errors in processItem
      throw new ParseratorError(
        'INTERNAL_ERROR' as ErrorCode,
        'Batch processing failed unexpectedly'
      );
    }
  }

  /**
   * Test API connectivity and authentication
   */
  async testConnection(): Promise<{
    success: boolean;
    latency: number;
    quotaRemaining?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.axios.get('/health');
      const latency = Date.now() - startTime;
      
      return {
        success: true,
        latency,
        quotaRemaining: response.headers['x-quota-remaining'] ? 
          parseInt(response.headers['x-quota-remaining']) : undefined
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get account usage statistics
   */
  async getUsage(): Promise<{
    requestsThisMonth: number;
    tokensUsedThisMonth: number;
    quotaLimit: number;
    quotaRemaining: number;
    billingPeriod: {
      start: string;
      end: string;
    };
  }> {
    try {
      const response = await this.axios.get('/v1/account/usage');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleAxiosError(error);
      }
      throw error;
    }
  }

  /**
   * Add event handler for monitoring parse operations
   */
  addEventListener(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(handler: EventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ParseratorConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Update axios instance if needed
    if (newConfig.apiKey) {
      this.axios.defaults.headers['Authorization'] = `Bearer ${newConfig.apiKey}`;
    }
    if (newConfig.timeout) {
      this.axios.defaults.timeout = newConfig.timeout;
    }
  }

  // Private methods

  private setupInterceptors(): void {
    // Request interceptor for debugging
    this.axios.interceptors.request.use(
      (config) => {
        if (this.config.debug) {
          console.log('Parserator API Request:', {
            url: config.url,
            method: config.method,
            headers: config.headers,
            dataSize: config.data ? JSON.stringify(config.data).length : 0
          });
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for debugging and error handling
    this.axios.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          console.log('Parserator API Response:', {
            status: response.status,
            headers: response.headers,
            dataSize: response.data ? JSON.stringify(response.data).length : 0
          });
        }
        return response;
      },
      (error) => {
        if (this.config.debug) {
          console.error('Parserator API Error:', {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data
          });
        }
        return Promise.reject(error);
      }
    );
  }

  private emitEvent(event: ParseEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        if (this.config.debug) {
          console.error('Error in event handler:', error);
        }
      }
    }
  }

  private handleAxiosError(error: AxiosError): ParseratorError {
    const response = error.response;
    
    if (!response) {
      return new ParseratorError(
        'NETWORK_ERROR' as ErrorCode,
        'Network error: Unable to reach Parserator API',
        { originalError: error.message }
      );
    }

    const status = response.status;
    const data = response.data as any;

    switch (status) {
      case 401:
        return new ParseratorError(
          'INVALID_API_KEY' as ErrorCode,
          'Invalid API key. Please check your credentials.',
          { status }
        );
      case 403:
        return new ParseratorError(
          'QUOTA_EXCEEDED' as ErrorCode,
          'API quota exceeded. Please upgrade your plan or wait for quota reset.',
          { status }
        );
      case 429:
        return new ParseratorError(
          'RATE_LIMIT_EXCEEDED' as ErrorCode,
          'Rate limit exceeded. Please slow down your requests.',
          { 
            status,
            retryAfter: response.headers['retry-after']
          }
        );
      case 400:
        return new ParseratorError(
          'INVALID_INPUT' as ErrorCode,
          data?.message || 'Invalid request data',
          { status, details: data }
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new ParseratorError(
          'SERVICE_UNAVAILABLE' as ErrorCode,
          'Parserator service is temporarily unavailable. Please try again later.',
          { status }
        );
      default:
        return new ParseratorError(
          'INTERNAL_ERROR' as ErrorCode,
          data?.message || 'An unexpected error occurred',
          { status, details: data }
        );
    }
  }

  private getRetryConfig(): RetryConfig {
    return {
      maxRetries: this.config.retries || 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    };
  }
}
