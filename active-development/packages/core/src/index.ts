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
  ParseOptions,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
  ParseratorCoreOptions,
  ParseratorSessionInit,
  ParseratorSessionSnapshot,
  SearchPlan,
  SessionParseOverrides
} from './types';
import {
  clamp,
  createEmptyPlan,
  createFailureResponse,
  toParseError,
  validateParseRequest
} from './utils';

export * from './types';

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

  createSession(init: ParseratorSessionInit): ParseratorSession {
    return new ParseratorSession({
      architect: this.architect,
      extractor: this.extractor,
      config: () => this.config,
      logger: this.logger,
      init
    });
  }

  async parse(request: ParseRequest): Promise<ParseResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      validateParseRequest(request, this.config);
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
      processingTimeMs: Date.now() - startTime,
      architectTokens: architectResult.tokensUsed
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
      processingTimeMs: Date.now() - startTime,
      architectTokens: architectResult.tokensUsed,
      extractorTokens: extractorResult.tokensUsed
    });
  }

  private attachRegistryIfSupported(agent: ExtractorAgent): void {
    if (typeof (agent as any)?.attachRegistry === 'function') {
      (agent as any).attachRegistry(this.resolverRegistry);
    }
  }
}

interface ParseratorSessionDependencies {
  architect: ArchitectAgent;
  extractor: ExtractorAgent;
  config: () => ParseratorCoreConfig;
  logger: CoreLogger;
  init: ParseratorSessionInit;
}

export class ParseratorSession {
  readonly id: string;
  readonly createdAt: string;

  private plan?: SearchPlan;
  private planDiagnostics: ParseDiagnostic[] = [];
  private planConfidence: number;
  private planTokens = 0;
  private totalArchitectTokens = 0;
  private totalExtractorTokens = 0;
  private parseCount = 0;
  private lastRequestId?: string;
  private lastConfidence?: number;
  private lastDiagnostics: ParseDiagnostic[] = [];
  private lastResponse?: ParseResponse;
  private defaultSeedInput?: string;

  constructor(private readonly deps: ParseratorSessionDependencies) {
    this.id = deps.init.sessionId ?? uuidv4();
    this.createdAt = new Date().toISOString();
    this.planConfidence = clamp(deps.init.planConfidence ?? 0.8, 0, 1);
    this.defaultSeedInput = deps.init.seedInput;

    if (deps.init.plan) {
      this.plan = this.clonePlan(deps.init.plan, 'cached');
      this.planDiagnostics = [...(deps.init.planDiagnostics ?? [])];
      this.planTokens = 0;
      this.totalArchitectTokens = 0;
      this.deps.logger.info?.('parserator-core:session-plan-attached', {
        sessionId: this.id,
        planId: this.plan.id,
        strategy: this.plan.strategy
      });
    }
  }

  async parse(inputData: string, overrides: SessionParseOverrides = {}): Promise<ParseResponse> {
    const baseOptions = this.deps.init.options ?? {};
    const overrideOptions = overrides.options ?? {};
    const mergedOptions: ParseOptions = {
      ...baseOptions,
      ...overrideOptions
    } as ParseOptions;
    const options = Object.keys(mergedOptions).length ? mergedOptions : undefined;

    const request: ParseRequest = {
      inputData,
      outputSchema: this.deps.init.outputSchema,
      instructions: overrides.instructions ?? this.deps.init.instructions,
      options
    };

    const requestId = uuidv4();
    const startTime = Date.now();
    const validationConfig = this.getConfig();

    try {
      validateParseRequest(request, validationConfig);
    } catch (error) {
      const parseError = toParseError(error, 'validation');
      return this.captureFailure(
        createFailureResponse({
          error: parseError,
          plan: this.plan ?? createEmptyPlan(request, validationConfig),
          requestId,
          diagnostics: [
            {
              field: '*',
              stage: 'validation',
              message: parseError.message,
              severity: 'error'
            }
          ]
        })
      );
    }

    const seedInput = overrides.seedInput ?? this.defaultSeedInput ?? request.inputData;
    const planFailure = await this.ensurePlan({ request, requestId, seedInput });

    if (planFailure) {
      return this.captureFailure(planFailure);
    }

    const runtimeConfig = this.getConfig();
    const plan = this.plan!;
    const architectTokensForCall = this.parseCount === 0 ? this.planTokens : 0;
    const extractorResult = await this.deps.extractor.execute({
      inputData: request.inputData,
      plan,
      config: runtimeConfig
    });

    const combinedDiagnostics = [...this.planDiagnostics, ...extractorResult.diagnostics];

    if (!extractorResult.success || !extractorResult.parsedData) {
      const totalTokens = architectTokensForCall + extractorResult.tokensUsed;
      this.totalExtractorTokens += extractorResult.tokensUsed;
      return this.captureFailure(
        createFailureResponse({
          error:
            extractorResult.error ?? {
              code: 'EXTRACTOR_FAILED',
              message: 'Extractor failed to resolve required fields',
              stage: 'extractor'
            },
          plan: this.clonePlan(plan, this.parseCount === 0 ? plan.metadata.origin : 'cached'),
          requestId,
          diagnostics: combinedDiagnostics,
          tokensUsed: totalTokens,
          processingTimeMs: Date.now() - startTime,
          architectTokens: architectTokensForCall,
          extractorTokens: extractorResult.tokensUsed
        })
      );
    }

    const planConfidence = this.planConfidence;
    const confidence = clamp(planConfidence * 0.35 + extractorResult.confidence * 0.65, 0, 1);
    const threshold = request.options?.confidenceThreshold ?? runtimeConfig.minConfidence;

    let error: ParseError | undefined;
    let diagnostics = combinedDiagnostics;

    if (confidence < threshold) {
      const warning: ParseDiagnostic = {
        field: '*',
        stage: 'extractor',
        message: `Confidence ${confidence.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
        severity: 'warning'
      };
      diagnostics = [...diagnostics, warning];

      if (!runtimeConfig.enableFieldFallbacks) {
        error = {
          code: 'LOW_CONFIDENCE',
          message: warning.message,
          stage: 'extractor',
          details: { confidence, threshold }
        };
      }
    }

    const totalTokens = architectTokensForCall + extractorResult.tokensUsed;

    const response: ParseResponse = {
      success: !error,
      parsedData: extractorResult.parsedData,
      metadata: {
        architectPlan: this.clonePlan(
          plan,
          this.parseCount === 0 ? plan.metadata.origin : 'cached'
        ),
        confidence,
        tokensUsed: totalTokens,
        processingTimeMs: Date.now() - startTime,
        architectTokens: architectTokensForCall,
        extractorTokens: extractorResult.tokensUsed,
        requestId,
        timestamp: new Date().toISOString(),
        diagnostics
      },
      error
    };

    this.parseCount += 1;
    this.totalExtractorTokens += extractorResult.tokensUsed;
    this.lastRequestId = requestId;
    this.lastConfidence = confidence;
    this.lastDiagnostics = diagnostics;
    this.lastResponse = response;

    return response;
  }

  getPlan(): SearchPlan | undefined {
    return this.plan ? this.clonePlan(this.plan) : undefined;
  }

  snapshot(): ParseratorSessionSnapshot {
    return {
      id: this.id,
      createdAt: this.createdAt,
      planReady: Boolean(this.plan),
      planVersion: this.plan?.version,
      planConfidence: this.planConfidence,
      parseCount: this.parseCount,
      tokensUsed: {
        architect: this.totalArchitectTokens,
        extractor: this.totalExtractorTokens,
        total: this.totalArchitectTokens + this.totalExtractorTokens
      },
      lastRequestId: this.lastRequestId,
      lastConfidence: this.lastConfidence,
      lastDiagnostics: [...this.lastDiagnostics]
    };
  }

  private getConfig(): ParseratorCoreConfig {
    return this.deps.config();
  }

  private async ensurePlan(params: {
    request: ParseRequest;
    requestId: string;
    seedInput: string;
  }): Promise<ParseResponse | undefined> {
    if (this.plan) {
      return undefined;
    }

    const seedInput = params.seedInput ?? params.request.inputData;
    const config = this.getConfig();
    const planRequest: ParseRequest = {
      inputData: seedInput,
      outputSchema: this.deps.init.outputSchema,
      instructions: this.deps.init.instructions,
      options: params.request.options
    };

    try {
      validateParseRequest(planRequest, config);
    } catch (error) {
      const parseError = toParseError(error, 'validation');
      return createFailureResponse({
        error: parseError,
        plan: createEmptyPlan(planRequest, config),
        requestId: params.requestId,
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

    const architectResult = await this.deps.architect.createPlan({
      inputData: planRequest.inputData,
      outputSchema: planRequest.outputSchema,
      instructions: planRequest.instructions,
      options: planRequest.options,
      config
    });

    this.planDiagnostics = architectResult.diagnostics;
    this.totalArchitectTokens += architectResult.tokensUsed;

    if (!architectResult.success || !architectResult.searchPlan) {
      const diagnostics: ParseDiagnostic[] = architectResult.diagnostics.length
        ? architectResult.diagnostics
        : [
            {
              field: '*',
              stage: 'architect',
              message:
                architectResult.error?.message ??
                'Architect was unable to generate a search plan',
              severity: 'error'
            }
          ];

      this.planTokens = 0;

      return createFailureResponse({
        error:
          architectResult.error ?? {
            code: 'ARCHITECT_FAILED',
            message: 'Architect was unable to generate a search plan',
            stage: 'architect'
          },
        plan: architectResult.searchPlan ?? createEmptyPlan(planRequest, config),
        requestId: params.requestId,
        diagnostics,
        tokensUsed: architectResult.tokensUsed,
        processingTimeMs: architectResult.processingTimeMs,
        architectTokens: architectResult.tokensUsed
      });
    }

    this.planConfidence = clamp(architectResult.confidence ?? this.planConfidence, 0, 1);
    this.planTokens = architectResult.tokensUsed;
    this.plan = this.clonePlan(architectResult.searchPlan);
    this.deps.logger.info?.('parserator-core:session-plan-created', {
      sessionId: this.id,
      planId: this.plan.id,
      strategy: this.plan.strategy
    });

    return undefined;
  }

  private clonePlan(
    plan: SearchPlan,
    originOverride?: SearchPlan['metadata']['origin']
  ): SearchPlan {
    return {
      ...plan,
      steps: plan.steps.map(step => ({ ...step })),
      metadata: {
        ...plan.metadata,
        origin: originOverride ?? plan.metadata.origin
      }
    };
  }

  private captureFailure(response: ParseResponse): ParseResponse {
    this.lastResponse = response;
    this.lastDiagnostics = response.metadata.diagnostics;
    this.lastConfidence = response.metadata.confidence;
    this.lastRequestId = response.metadata.requestId;
    return response;
  }
}

export { HeuristicArchitect, RegexExtractor, ResolverRegistry, createDefaultResolvers };
