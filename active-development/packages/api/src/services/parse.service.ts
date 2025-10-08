/**
 * Parse Service for Parserator
 * Orchestrates the lightweight @parserator/core pipeline for API requests
 * while preserving compatibility with existing SaaS interfaces.
 */

import {
  ParseratorCore,
  ParseRequest as CoreParseRequest,
  ParseResponse as CoreParseResponse,
  ParseOptions,
  SearchPlan,
  CoreLogger,
  ParseDiagnostic
} from '@parserator/core';

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
export class ParseError extends Error {
  constructor(
    message: string,
    public code: string,
    public stage: 'validation' | 'architect' | 'extractor' | 'orchestration',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export type IParseResult = CoreParseResponse;

/**
 * Main parsing service that orchestrates the @parserator/core workflow
 */
export class ParseService {
  private config: IParseConfig;
  private logger: Console;
  private readonly core: ParseratorCore;

  // Default configuration optimised for production use
  private static readonly DEFAULT_CONFIG: IParseConfig = {
    maxInputLength: 100000, // 100KB limit
    maxSchemaFields: 50,
    timeoutMs: 60000, // 1 minute total timeout (not currently enforced by core)
    enableFallbacks: true,
    minOverallConfidence: 0.55,
    coreStrategy: 'sequential'
  };

  constructor(
    private readonly geminiService: GeminiService,
    config?: Partial<IParseConfig>,
    logger?: Console
  ) {
    this.config = { ...ParseService.DEFAULT_CONFIG, ...config };
    this.logger = logger || console;

    this.core = new ParseratorCore({
      apiKey: this.config.coreApiKey ?? 'api-internal',
      logger: this.createCoreLogger(),
      config: {
        maxInputLength: this.config.maxInputLength,
        maxSchemaFields: this.config.maxSchemaFields,
        minConfidence: this.config.minOverallConfidence,
        enableFieldFallbacks: this.config.enableFallbacks,
        defaultStrategy: this.config.coreStrategy ?? 'sequential'
      }
    });

    this.logger.info('ParseService initialised with @parserator/core', {
      maxInputLength: this.config.maxInputLength,
      maxSchemaFields: this.config.maxSchemaFields,
      minOverallConfidence: this.config.minOverallConfidence,
      coreStrategy: this.config.coreStrategy,
      service: 'parse'
    });
  }

  /**
   * Main parsing method that delegates to the core pipeline
   */
  async parse(request: IParseRequest): Promise<IParseResult> {
    const startTime = Date.now();
    const operationId = request.requestId || this.generateOperationId();

    this.logger.info('Starting parse operation', {
      requestId: operationId,
      userId: request.userId,
      inputLength: request.inputData?.length ?? 0,
      schemaFields: Object.keys(request.outputSchema || {}).length,
      hasInstructions: !!request.instructions,
      operation: 'parse'
    });

    try {
      this.validateParseRequest(request);

      const coreRequest: CoreParseRequest = {
        inputData: request.inputData,
        outputSchema: request.outputSchema,
        instructions: request.instructions,
        options: request.options ?? this.config.defaultOptions
      };

      const coreResult = await this.core.parse(coreRequest);
      const normalised = this.normaliseCoreResult(coreResult, operationId);

      this.logCoreOutcome(normalised, request, startTime);

      return normalised;
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      if (error instanceof ParseError) {
        this.logger.warn('Parse operation failed during validation', {
          requestId: operationId,
          userId: request.userId,
          code: error.code,
          stage: error.stage,
          processingTimeMs
        });

        return this.createFailureResult({
          request,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          },
          stage: error.stage,
          requestId: operationId,
          processingTimeMs,
          diagnostics: [
            {
              field: '*',
              stage: error.stage,
              message: error.message,
              severity: 'error'
            }
          ]
        });
      }

      this.logger.error('Parse operation encountered unexpected error', {
        requestId: operationId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs
      });

      return this.createFailureResult({
        request,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: `Unexpected error during parsing: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          details: { originalError: error }
        },
        stage: 'orchestration',
        requestId: operationId,
        processingTimeMs,
        diagnostics: [
          {
            field: '*',
            stage: 'orchestration',
            message: 'Unexpected error during parsing',
            severity: 'error'
          }
        ]
      });
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    const timestamp = new Date().toISOString();

    try {
      const geminiHealthy = await this.geminiService.testConnection();

      return {
        status: geminiHealthy ? 'healthy' : 'degraded',
        services: {
          core: true,
          gemini: geminiHealthy
        },
        timestamp
      };
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        status: 'degraded',
        services: {
          core: true,
          gemini: false
        },
        timestamp
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): IParseConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IParseConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.core.updateConfig({
      maxInputLength: this.config.maxInputLength,
      maxSchemaFields: this.config.maxSchemaFields,
      minConfidence: this.config.minOverallConfidence,
      enableFieldFallbacks: this.config.enableFallbacks,
      defaultStrategy: this.config.coreStrategy ?? 'sequential'
    });

    this.logger.info('ParseService configuration updated', {
      newConfig,
      service: 'parse'
    });
  }

  private createCoreLogger(): CoreLogger {
    return {
      debug: (...args: unknown[]) => this.logger.debug?.(...args),
      info: (...args: unknown[]) => this.logger.info?.(...args),
      warn: (...args: unknown[]) => this.logger.warn?.(...args),
      error: (...args: unknown[]) => this.logger.error?.(...args)
    };
  }

  private normaliseCoreResult(coreResult: CoreParseResponse, requestId: string): IParseResult {
    return {
      ...coreResult,
      metadata: {
        ...coreResult.metadata,
        requestId,
        diagnostics: [...coreResult.metadata.diagnostics],
        stageBreakdown: { ...coreResult.metadata.stageBreakdown }
      }
    };
  }

  private logCoreOutcome(result: IParseResult, request: IParseRequest, startTime: number): void {
    const baseLog = {
      requestId: result.metadata.requestId,
      userId: request.userId,
      confidence: result.metadata.confidence,
      tokensUsed: result.metadata.tokensUsed,
      processingTimeMs: result.metadata.processingTimeMs,
      fieldsExtracted: Object.keys(result.parsedData || {}).length,
      diagnostics: result.metadata.diagnostics.length,
      durationMs: Date.now() - startTime,
      operation: 'parse'
    };

    if (result.success) {
      this.logger.info('Parse operation completed successfully', baseLog);
    } else {
      this.logger.warn('Parse operation completed with failure status', {
        ...baseLog,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
        stage: result.error?.stage
      });
    }
  }

  private createFailureResult(params: {
    request: IParseRequest;
    error: { code: string; message: string; details?: Record<string, unknown> };
    stage: 'validation' | 'architect' | 'extractor' | 'orchestration';
    requestId: string;
    processingTimeMs: number;
    diagnostics?: ParseDiagnostic[];
  }): IParseResult {
    const { request, error, stage, requestId, processingTimeMs, diagnostics = [] } = params;

    const placeholderPlan = this.createPlaceholderPlan(request);

    return {
      success: false,
      parsedData: {},
      metadata: {
        architectPlan: placeholderPlan,
        confidence: 0,
        tokensUsed: 0,
        processingTimeMs,
        architectTokens: 0,
        extractorTokens: 0,
        requestId,
        timestamp: new Date().toISOString(),
        diagnostics,
        stageBreakdown: {
          architect: { timeMs: stage === 'architect' ? processingTimeMs : 0, tokens: 0, confidence: 0 },
          extractor: { timeMs: stage === 'extractor' ? processingTimeMs : 0, tokens: 0, confidence: 0 }
        }
      },
      error: {
        code: error.code,
        message: error.message,
        stage,
        details: { requestId, ...error.details }
      }
    };
  }

  private createPlaceholderPlan(request: IParseRequest): SearchPlan {
    const schemaKeys = Object.keys(request.outputSchema || {});

    return {
      id: 'plan_unavailable',
      version: '1.0',
      steps: schemaKeys.map(key => ({
        targetKey: key,
        description: `Pending extraction for ${key}`,
        searchInstruction: 'No plan generated due to upstream validation error.',
        validationType: 'string',
        isRequired: true
      })),
      strategy: this.config.coreStrategy ?? 'sequential',
      confidenceThreshold: this.config.minOverallConfidence,
      metadata: {
        detectedFormat: 'unknown',
        complexity: schemaKeys.length > 16 ? 'high' : schemaKeys.length > 6 ? 'medium' : 'low',
        estimatedTokens: schemaKeys.length * 128,
        origin: 'heuristic'
      }
    };
  }

  /**
   * Validate parse request inputs
   */
  private validateParseRequest(request: IParseRequest): void {
    // Validate input data
    if (!request.inputData || typeof request.inputData !== 'string') {
      throw new ParseError(
        'Input data must be a non-empty string',
        'INVALID_INPUT_DATA',
        'validation'
      );
    }

    if (request.inputData.trim().length === 0) {
      throw new ParseError(
        'Input data cannot be empty or only whitespace',
        'EMPTY_INPUT_DATA',
        'validation'
      );
    }

    if (request.inputData.length > this.config.maxInputLength) {
      throw new ParseError(
        `Input data length ${request.inputData.length} exceeds maximum ${this.config.maxInputLength}`,
        'INPUT_TOO_LARGE',
        'validation',
        { inputLength: request.inputData.length, maxLength: this.config.maxInputLength }
      );
    }

    // Validate output schema
    if (!request.outputSchema || typeof request.outputSchema !== 'object') {
      throw new ParseError(
        'Output schema must be a non-null object',
        'INVALID_OUTPUT_SCHEMA',
        'validation'
      );
    }

    const schemaKeys = Object.keys(request.outputSchema);
    if (schemaKeys.length === 0) {
      throw new ParseError(
        'Output schema cannot be empty',
        'EMPTY_OUTPUT_SCHEMA',
        'validation'
      );
    }

    if (schemaKeys.length > this.config.maxSchemaFields) {
      throw new ParseError(
        `Output schema has ${schemaKeys.length} fields, exceeding limit of ${this.config.maxSchemaFields}`,
        'SCHEMA_TOO_LARGE',
        'validation',
        { fieldCount: schemaKeys.length, limit: this.config.maxSchemaFields }
      );
    }

    // Validate instructions if provided
    if (request.instructions !== undefined && typeof request.instructions !== 'string') {
      throw new ParseError(
        'Instructions must be a string if provided',
        'INVALID_INSTRUCTIONS',
        'validation'
      );
    }
  }

  /**
   * Generate unique operation ID for tracking
   */
  private generateOperationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `parse_${timestamp}_${random}`;
  }
}
