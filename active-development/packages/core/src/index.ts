import { v4 as uuidv4 } from 'uuid';

import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultLogger } from './logger';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import {
  ArchitectAgent,
  ArchitectResult,
  CoreLogger,
  ExtractorAgent,
  ParseDiagnostic,
  ParseError,
  ParseMetadata,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
  ParseratorCoreOptions
} from './types';
import {
  clamp,
  createEmptyPlan,
  createFailureResponse,
  toParseError
} from './utils';

export * from './types';
export { HeuristicArchitect, RegexExtractor, ResolverRegistry, createDefaultResolvers };

const DEFAULT_CONFIG: ParseratorCoreConfig = {
  maxInputLength: 120_000,
  maxSchemaFields: 64,
  minConfidence: 0.55,
  defaultStrategy: 'sequential',
  enableFieldFallbacks: true
};

const DEFAULT_LOGGER: CoreLogger = createDefaultLogger();

export class ParseratorCore {
  private readonly apiKey: string;
  private config: ParseratorCoreConfig;
  private logger: CoreLogger;
  private architect: ArchitectAgent;
  private extractor: ExtractorAgent;
  private resolverRegistry: ResolverRegistry;

  constructor(options: ParseratorCoreOptions) {
    if (!options?.apiKey || options.apiKey.trim().length === 0) {
      throw new Error('ParseratorCore requires a non-empty apiKey');
    }

    this.apiKey = options.apiKey;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.logger = options.logger ?? DEFAULT_LOGGER;

    const initialResolvers = options.resolvers ?? createDefaultResolvers(this.logger);
    this.resolverRegistry = new ResolverRegistry(initialResolvers, this.logger);

    this.architect = options.architect ?? new HeuristicArchitect(this.logger);

    const extractor = options.extractor ?? new RegexExtractor(this.logger, this.resolverRegistry);
    this.attachRegistryIfSupported(extractor);
    this.extractor = extractor;
  }

  updateConfig(partial: Partial<ParseratorCoreConfig>): void {
    this.config = { ...this.config, ...partial };
    this.logger.info?.('parserator-core:config-updated', { config: this.config });
  }

  getConfig(): ParseratorCoreConfig {
    return { ...this.config };
  }

  setArchitect(agent: ArchitectAgent): void {
    this.architect = agent;
  }

  setExtractor(agent: ExtractorAgent): void {
    this.attachRegistryIfSupported(agent);
    this.extractor = agent;
  }

  registerResolver(resolver: Parameters<ResolverRegistry['register']>[0], position: 'append' | 'prepend' = 'append'): void {
    this.resolverRegistry.register(resolver, position);
    this.logger.info?.('parserator-core:resolver-registered', {
      resolver: resolver.name,
      position
    });
  }

  replaceResolvers(resolvers: Parameters<ResolverRegistry['register']>[0][]): void {
    this.resolverRegistry.replaceAll(resolvers);
    this.logger.info?.('parserator-core:resolvers-replaced', {
      resolvers: resolvers.map(resolver => resolver.name)
    });
  }

  listResolvers(): string[] {
    return this.resolverRegistry.listResolvers();
  }

  async parse(request: ParseRequest): Promise<ParseResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      this.validateRequest(request);
    } catch (error) {
      const parseError = toParseError(error, 'validation');
      return createFailureResponse({
        error: parseError,
        plan: createEmptyPlan(request, this.config),
        requestId,
        diagnostics: [
          {
            field: '*',
            stage: 'validation',
            message: parseError.message,
            severity: 'error'
          }
        ]
      });
    }

    const architectResult = await this.architect.createPlan({
      inputData: request.inputData,
      outputSchema: request.outputSchema,
      instructions: request.instructions,
      options: request.options,
      config: this.config
    });

    if (!architectResult.success || !architectResult.searchPlan) {
      return this.handleArchitectFailure({
        request,
        architectResult,
        requestId,
        startTime
      });
    }

    const extractorResult = await this.extractor.execute({
      inputData: request.inputData,
      plan: architectResult.searchPlan,
      config: this.config
    });

    if (!extractorResult.success || !extractorResult.parsedData) {
      return this.handleExtractorFailure({
        requestId,
        request,
        architectResult,
        extractorResult,
        startTime
      });
    }

    const totalTokens = architectResult.tokensUsed + extractorResult.tokensUsed;
    const confidence = clamp(
      architectResult.confidence * 0.35 + extractorResult.confidence * 0.65,
      0,
      1
    );
    const threshold = request.options?.confidenceThreshold ?? this.config.minConfidence;

    const metadata: ParseMetadata = {
      architectPlan: architectResult.searchPlan,
      confidence,
      tokensUsed: totalTokens,
      processingTimeMs: Date.now() - startTime,
      architectTokens: architectResult.tokensUsed,
      extractorTokens: extractorResult.tokensUsed,
      requestId,
      timestamp: new Date().toISOString(),
      diagnostics: [...architectResult.diagnostics, ...extractorResult.diagnostics]
    };

    let error: ParseError | undefined;
    if (confidence < threshold) {
      const warning: ParseDiagnostic = {
        field: '*',
        stage: 'extractor',
        message: `Confidence ${confidence.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
        severity: 'warning'
      };
      metadata.diagnostics = [...metadata.diagnostics, warning];

      if (!this.config.enableFieldFallbacks) {
        error = {
          code: 'LOW_CONFIDENCE',
          message: warning.message,
          stage: 'extractor',
          details: { confidence, threshold }
        };
      }
    }

    return {
      success: !error,
      parsedData: extractorResult.parsedData,
      metadata,
      error
    };
  }

  private handleArchitectFailure(params: {
    request: ParseRequest;
    architectResult: ArchitectResult;
    requestId: string;
    startTime: number;
  }): ParseResponse {
    const { request, architectResult, requestId, startTime } = params;
    const fallbackDiagnostic: ParseDiagnostic = {
      field: '*',
      stage: 'architect',
      message:
        architectResult.error?.message || 'Architect was unable to generate a search plan',
      severity: 'error'
    };

    const diagnostics = architectResult.diagnostics.length
      ? architectResult.diagnostics
      : [fallbackDiagnostic];

    return createFailureResponse({
      error:
        architectResult.error ?? {
          code: 'ARCHITECT_FAILED',
          message: 'Architect was unable to generate a search plan',
          stage: 'architect'
        },
      plan: architectResult.searchPlan ?? createEmptyPlan(request, this.config),
      requestId,
      diagnostics,
      tokensUsed: architectResult.tokensUsed,
      processingTimeMs: Date.now() - startTime
    });
  }

  private handleExtractorFailure(params: {
    requestId: string;
    request: ParseRequest;
    architectResult: ArchitectResult;
    extractorResult: Awaited<ReturnType<ExtractorAgent['execute']>>;
    startTime: number;
  }): ParseResponse {
    const { requestId, architectResult, extractorResult, startTime, request } = params;

    const fallbackDiagnostic: ParseDiagnostic = {
      field: '*',
      stage: 'extractor',
      message:
        extractorResult.error?.message || 'Extractor failed to resolve required fields',
      severity: 'error'
    };

    const diagnostics = [
      ...architectResult.diagnostics,
      ...extractorResult.diagnostics,
      ...(extractorResult.success ? [] : [fallbackDiagnostic])
    ];

    return createFailureResponse({
      error:
        extractorResult.error ?? {
          code: 'EXTRACTOR_FAILED',
          message: 'Extractor failed to resolve required fields',
          stage: 'extractor'
        },
      plan: architectResult.searchPlan ?? createEmptyPlan(request, this.config),
      requestId,
      diagnostics,
      tokensUsed: architectResult.tokensUsed + extractorResult.tokensUsed,
      processingTimeMs: Date.now() - startTime
    });
  }

  private validateRequest(request: ParseRequest): void {
    if (!request.inputData || typeof request.inputData !== 'string') {
      throw new Error('inputData must be a non-empty string');
    }

    const trimmed = request.inputData.trim();
    if (trimmed.length === 0) {
      throw new Error('inputData cannot be empty or whitespace');
    }

    if (trimmed.length > this.config.maxInputLength) {
      throw new Error(
        `inputData length ${trimmed.length} exceeds maximum ${this.config.maxInputLength}`
      );
    }

    if (!request.outputSchema || typeof request.outputSchema !== 'object') {
      throw new Error('outputSchema must be an object describing the expected fields');
    }

    const fields = Object.keys(request.outputSchema);
    if (fields.length === 0) {
      throw new Error('outputSchema must contain at least one field');
    }

    if (fields.length > this.config.maxSchemaFields) {
      throw new Error(
        `outputSchema has ${fields.length} fields which exceeds the limit of ${this.config.maxSchemaFields}`
      );
    }

    if (request.instructions !== undefined && typeof request.instructions !== 'string') {
      throw new Error('instructions must be a string when provided');
    }
  }

  private attachRegistryIfSupported(agent: ExtractorAgent): void {
    if (typeof (agent as any)?.attachRegistry === 'function') {
      (agent as any).attachRegistry(this.resolverRegistry);
    }
  }
}
