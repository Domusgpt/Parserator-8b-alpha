/**
 * Parse Service for Parserator
 * Main orchestration service that coordinates the two-stage Architect-Extractor workflow
 * Provides the primary parsing interface for the SaaS API
 */

import {
  IParseResult,
  ISearchPlan,
  IArchitectResult,
  IExtractorResult,
  ISystemContext,
  SystemContextType
} from '../interfaces/search-plan.interface';
import { GeminiService } from './llm.service';
import { ArchitectService, ArchitectError } from './architect.service';
import { ExtractorService, ExtractorError } from './extractor.service';
import { SystemContextDetector, SYSTEM_CONTEXT_DEFINITIONS } from './system-context-detector';

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

  /** Optional hint for the downstream system context */
  systemContextHint?: SystemContextType;

  /** Additional domain-specific keywords to bias context detection */
  domainHints?: string[];

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

/**
 * Main parsing service that orchestrates the two-stage workflow
 * Provides intelligent data parsing with cost optimization and high accuracy
 */
export class ParseService {
  private config: IParseConfig;
  private logger: Console;
  private architectService: ArchitectService;
  private extractorService: ExtractorService;
  private contextDetector: SystemContextDetector;

  // Default configuration optimized for production use
  private static readonly DEFAULT_CONFIG: IParseConfig = {
    maxInputLength: 100000, // 100KB limit
    maxSchemaFields: 50,
    timeoutMs: 60000, // 1 minute total timeout
    enableFallbacks: true,
    architectSampleSize: 1000,
    minOverallConfidence: 0.5
  };

  constructor(
    private geminiService: GeminiService,
    config?: Partial<IParseConfig>,
    logger?: Console
  ) {
    this.config = { ...ParseService.DEFAULT_CONFIG, ...config };
    this.logger = logger || console;

    // Initialize sub-services
    this.architectService = new ArchitectService(
      this.geminiService,
      {
        maxSampleLength: this.config.architectSampleSize,
        maxFieldCount: this.config.maxSchemaFields,
        timeoutMs: Math.floor(this.config.timeoutMs * 0.4) // 40% of total time
      },
      this.logger
    );

    this.extractorService = new ExtractorService(
      this.geminiService,
      {
        maxInputLength: this.config.maxInputLength,
        timeoutMs: Math.floor(this.config.timeoutMs * 0.6) // 60% of total time
      },
      this.logger
    );

    this.contextDetector = new SystemContextDetector({ logger: this.logger });

    this.logger.info('ParseService initialized', {
      maxInputLength: this.config.maxInputLength,
      maxSchemaFields: this.config.maxSchemaFields,
      architectSampleSize: this.config.architectSampleSize,
      service: 'parse'
    });
  }

  /**
   * Main parsing method that orchestrates the two-stage workflow
   */
  async parse(request: IParseRequest): Promise<IParseResult> {
    const startTime = Date.now();
    const operationId = request.requestId || this.generateOperationId();
    let systemContext = this.contextDetector.createDefaultContext();
    let dataSample = '';

    this.logger.info('Starting parse operation', {
      requestId: operationId,
      userId: request.userId,
      inputLength: request.inputData.length,
      schemaFields: Object.keys(request.outputSchema).length,
      hasInstructions: !!request.instructions,
      operation: 'parse'
    });

    try {
      // Validate inputs
      this.validateParseRequest(request);

      // Prepare data sample once for downstream stages
      dataSample = this.createOptimizedSample(request.inputData);
      systemContext = this.detectSystemContext(request, dataSample);

      this.logger.info('Detected system context for parse request', {
        requestId: operationId,
        systemContext: systemContext.type,
        confidence: systemContext.confidence,
        signals: systemContext.signals.slice(0, 5),
        metrics: systemContext.metrics,
        alternatives: systemContext.alternatives?.slice(0, 3).map(option => ({
          type: option.type,
          confidence: option.confidence
        }))
      });

      // Stage 1: Generate SearchPlan with the Architect
      const architectResult = await this.executeArchitectStage(
        request.outputSchema,
        dataSample,
        request.instructions,
        operationId,
        systemContext
      );

      if (!architectResult.success) {
        return this.createFailureResult(
          architectResult.error!,
          'architect',
          operationId,
          Date.now() - startTime,
          architectResult.tokensUsed,
          architectResult.searchPlan,
          systemContext
        );
      }

      // Prefer any refined context returned by the Architect
      if (architectResult.searchPlan.metadata.systemContext) {
        systemContext = architectResult.searchPlan.metadata.systemContext;
      } else {
        architectResult.searchPlan.metadata.systemContext = systemContext;
      }

      // Stage 2: Execute SearchPlan with the Extractor
      const extractorResult = await this.executeExtractorStage(
        request.inputData,
        architectResult.searchPlan,
        operationId,
        systemContext
      );

      if (!extractorResult.success) {
        return this.createFailureResult(
          extractorResult.error!,
          'extractor',
          operationId,
          Date.now() - startTime,
          architectResult.tokensUsed + extractorResult.tokensUsed,
          architectResult.searchPlan,
          systemContext
        );
      }

      // Combine results and validate overall quality
      const result = this.combineResults(
        architectResult,
        extractorResult,
        Date.now() - startTime,
        operationId,
        systemContext
      );

      // Apply fallback strategies if confidence is too low
      if (this.config.enableFallbacks && result.metadata.confidence < this.config.minOverallConfidence) {
        this.logger.warn('Low confidence result, applying fallbacks', {
          requestId: operationId,
          confidence: result.metadata.confidence,
          threshold: this.config.minOverallConfidence
        });
        
        // Note: Fallback implementation would go here
        // For now, we proceed with the low-confidence result
      }

      this.logger.info('Parse operation completed successfully', {
        requestId: operationId,
        userId: request.userId,
        confidence: result.metadata.confidence,
        tokensUsed: result.metadata.tokensUsed,
        processingTimeMs: result.metadata.processingTimeMs,
        fieldsExtracted: Object.keys(result.parsedData).length,
        operation: 'parse'
      });

      return result;

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      
      this.logger.error('Parse operation failed', {
        requestId: operationId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
        operation: 'parse'
      });

      if (error instanceof ParseError) {
        if (error.stage === 'validation') {
          systemContext = this.contextDetector.createDefaultContext({
            metrics: {
              ...systemContext.metrics,
              lowConfidenceFallback: true,
              domainHintsProvided: request.domainHints?.length ?? 0,
              explicitHintProvided:
                !!request.systemContextHint && request.systemContextHint !== 'generic',
              explicitHintMatchedFinalContext:
                !!request.systemContextHint && request.systemContextHint === 'generic'
            }
          });
        }

        return this.createFailureResult(
          {
            code: error.code,
            message: error.message,
            details: error.details
          },
          error.stage,
          operationId,
          processingTimeMs,
          0,
          undefined,
          systemContext
        );
      }

      // Unexpected error
      return this.createFailureResult(
        {
          code: 'UNEXPECTED_ERROR',
          message: `Unexpected error during parsing: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { originalError: error }
        },
        'orchestration',
        operationId,
        processingTimeMs,
        0,
        undefined,
        systemContext
      );
    }
  }

  /**
   * Execute the Architect stage
   */
  private async executeArchitectStage(
    outputSchema: Record<string, any>,
    dataSample: string,
    instructions: string | undefined,
    requestId: string,
    systemContext: ISystemContext
  ): Promise<IArchitectResult> {
    this.logger.info('Executing Architect stage', {
      requestId,
      systemContext: systemContext.type,
      stage: 'architect',
      operation: 'executeArchitectStage'
    });

    try {
      const result = await this.architectService.generateSearchPlan(
        outputSchema,
        dataSample,
        instructions,
        requestId,
        systemContext
      );

      this.logger.info('Architect stage completed', {
        requestId,
        success: result.success,
        confidence: result.success ? result.searchPlan.architectConfidence : 0,
        tokensUsed: result.tokensUsed,
        stage: 'architect'
      });

      return result;

    } catch (error) {
      this.logger.error('Architect stage failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'architect'
      });

      throw error;
    }
  }

  /**
   * Execute the Extractor stage
   */
  private async executeExtractorStage(
    inputData: string,
    searchPlan: ISearchPlan,
    requestId: string,
    systemContext: ISystemContext
  ): Promise<IExtractorResult> {
    this.logger.info('Executing Extractor stage', {
      requestId,
      stepsToExecute: searchPlan.steps.length,
      planComplexity: searchPlan.estimatedComplexity,
      systemContext: systemContext.type,
      stage: 'extractor',
      operation: 'executeExtractorStage'
    });

    try {
      const result = await this.extractorService.executeSearchPlan(
        inputData,
        searchPlan,
        requestId,
        systemContext
      );

      this.logger.info('Extractor stage completed', {
        requestId,
        success: result.success,
        confidence: result.success ? result.overallConfidence : 0,
        tokensUsed: result.tokensUsed,
        failedFields: result.failedFields.length,
        stage: 'extractor'
      });

      return result;

    } catch (error) {
      this.logger.error('Extractor stage failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'extractor'
      });

      throw error;
    }
  }

  /**
   * Combine results from both stages into final result
   */
  private combineResults(
    architectResult: IArchitectResult,
    extractorResult: IExtractorResult,
    totalProcessingTimeMs: number,
    requestId: string,
    systemContext: ISystemContext
  ): IParseResult {
    const totalTokens = architectResult.tokensUsed + extractorResult.tokensUsed;

    // Calculate weighted confidence score
    const architectWeight = 0.3;
    const extractorWeight = 0.7;
    const overallConfidence = (
      architectResult.searchPlan.architectConfidence * architectWeight +
      extractorResult.overallConfidence * extractorWeight
    );

    return {
      success: true,
      parsedData: extractorResult.parsedData,
      metadata: {
        architectPlan: architectResult.searchPlan,
        confidence: overallConfidence,
        systemContext,
        tokensUsed: totalTokens,
        processingTimeMs: totalProcessingTimeMs,
        architectTokens: architectResult.tokensUsed,
        extractorTokens: extractorResult.tokensUsed,
        stageBreakdown: {
          architect: {
            timeMs: architectResult.processingTimeMs,
            tokens: architectResult.tokensUsed,
            confidence: architectResult.searchPlan.architectConfidence
          },
          extractor: {
            timeMs: extractorResult.processingTimeMs,
            tokens: extractorResult.tokensUsed,
            confidence: extractorResult.overallConfidence
          }
        }
      }
    };
  }

  /**
   * Create a failure result with comprehensive error information
   */
  private createFailureResult(
    error: { code: string; message: string; details?: any },
    stage: 'architect' | 'extractor' | 'validation' | 'orchestration',
    requestId: string,
    processingTimeMs: number,
    tokensUsed: number = 0,
    architectPlan?: ISearchPlan,
    systemContext: ISystemContext = this.contextDetector.createDefaultContext()
  ): IParseResult {
    return {
      success: false,
      parsedData: {},
      metadata: {
        architectPlan: architectPlan || {
          steps: [],
          totalSteps: 0,
          estimatedComplexity: 'high',
          architectConfidence: 0.0,
          estimatedExtractorTokens: 0,
          metadata: {
            createdAt: new Date().toISOString(),
            architectVersion: 'unknown',
            sampleLength: 0,
            systemContext
          }
        },
        confidence: 0.0,
        systemContext,
        tokensUsed,
        processingTimeMs,
        architectTokens: stage === 'architect' ? tokensUsed : 0,
        extractorTokens: stage === 'extractor' ? tokensUsed : 0,
        stageBreakdown: {
          architect: {
            timeMs: stage === 'architect' ? processingTimeMs : 0,
            tokens: stage === 'architect' ? tokensUsed : 0,
            confidence: 0.0
          },
          extractor: {
            timeMs: stage === 'extractor' ? processingTimeMs : 0,
            tokens: stage === 'extractor' ? tokensUsed : 0,
            confidence: 0.0
          }
        }
      },
      error: {
        code: error.code,
        message: error.message,
        stage,
        details: {
          requestId,
          ...error.details
        }
      }
    };
  }

  /**
   * Detect downstream system context using schema, hints, and sample data
   */
  private detectSystemContext(request: IParseRequest, dataSample: string): ISystemContext {
    const schemaFields = this.extractSchemaFieldNames(request.outputSchema);

    return this.contextDetector.detect({
      schemaFields,
      instructions: request.instructions,
      sample: dataSample,
      domainHints: request.domainHints,
      systemContextHint: request.systemContextHint
    });
  }

  /**
   * Recursively extract schema field names for context analysis
   */
  private extractSchemaFieldNames(schema: Record<string, any>, prefix = ''): string[] {
    const fields: string[] = [];

    Object.entries(schema).forEach(([key, value]) => {
      const normalizedKey = prefix ? `${prefix}.${key}` : key;
      fields.push(normalizedKey);

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        fields.push(...this.extractSchemaFieldNames(value as Record<string, any>, normalizedKey));
      }
    });

    return fields;
  }

  /**
   * Create an optimized sample from input data for the Architect
   */
  private createOptimizedSample(inputData: string): string {
    if (inputData.length <= this.config.architectSampleSize) {
      return inputData;
    }

    // Try to get a representative sample from the beginning
    const sample = inputData.substring(0, this.config.architectSampleSize);
    
    // Try to break at natural boundaries to avoid cutting words/sentences
    const lastPeriod = sample.lastIndexOf('.');
    const lastNewline = sample.lastIndexOf('\n');
    const lastSpace = sample.lastIndexOf(' ');
    const lastComma = sample.lastIndexOf(',');
    
    // Choose the best breaking point
    const breakPoints = [lastPeriod, lastNewline, lastComma, lastSpace].filter(pos => pos > 0);
    const bestBreakPoint = Math.max(...breakPoints);
    
    // Use the break point if it's not too far from the end (>70% of sample)
    if (bestBreakPoint > this.config.architectSampleSize * 0.7) {
      return sample.substring(0, bestBreakPoint + 1);
    }
    
    return sample;
  }

  /**
   * Validate parse request inputs
   */
  private validateParseRequest(request: IParseRequest): void {
    // Validate input data
    if (request.inputData === undefined || request.inputData === null) {
      throw new ParseError(
        'Input data must be provided',
        'INVALID_INPUT_DATA',
        'validation'
      );
    }

    if (typeof request.inputData !== 'string') {
      throw new ParseError(
        'Input data must be a string',
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

    if (request.systemContextHint && !(request.systemContextHint in SYSTEM_CONTEXT_DEFINITIONS)) {
      throw new ParseError(
        `Unknown system context hint: ${request.systemContextHint}`,
        'INVALID_CONTEXT_HINT',
        'validation'
      );
    }

    if (request.domainHints) {
      if (!Array.isArray(request.domainHints)) {
        throw new ParseError(
          'Domain hints must be provided as an array of strings',
          'INVALID_DOMAIN_HINTS',
          'validation'
        );
      }

      if (request.domainHints.length > 10) {
        throw new ParseError(
          'Provide no more than 10 domain hints',
          'TOO_MANY_DOMAIN_HINTS',
          'validation'
        );
      }

      request.domainHints.forEach((hint, index) => {
        if (typeof hint !== 'string' || hint.trim().length === 0) {
          throw new ParseError(
            `Domain hint at position ${index} must be a non-empty string`,
            'INVALID_DOMAIN_HINT',
            'validation'
          );
        }

        if (hint.length > 64) {
          throw new ParseError(
            `Domain hint at position ${index} exceeds maximum length of 64 characters`,
            'DOMAIN_HINT_TOO_LONG',
            'validation'
          );
        }
      });
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

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    try {
      const geminiHealthy = await this.geminiService.testConnection();
      
      return {
        status: geminiHealthy ? 'healthy' : 'unhealthy',
        services: {
          gemini: geminiHealthy,
          architect: true, // Service is operational if initialized
          extractor: true  // Service is operational if initialized
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        status: 'unhealthy',
        services: {
          gemini: false,
          architect: false,
          extractor: false
        },
        timestamp: new Date().toISOString()
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
    
    // Update sub-service configurations
    this.architectService.updateConfig({
      maxSampleLength: this.config.architectSampleSize,
      maxFieldCount: this.config.maxSchemaFields,
      timeoutMs: Math.floor(this.config.timeoutMs * 0.4)
    });

    this.extractorService.updateConfig({
      maxInputLength: this.config.maxInputLength,
      timeoutMs: Math.floor(this.config.timeoutMs * 0.6)
    });

    this.logger.info('ParseService configuration updated', {
      newConfig,
      service: 'parse'
    });
  }
}