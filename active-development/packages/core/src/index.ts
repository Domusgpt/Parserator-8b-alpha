import { v4 as uuidv4 } from 'uuid';

import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultLogger } from './logger';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import { listParseratorProfiles, resolveProfile } from './profiles';
import { ParseratorSession } from './session';
import { createTelemetryHub, TelemetryHub } from './telemetry';
import { createInMemoryPlanCache } from './cache';
import { createDefaultPreprocessors, executePreprocessors } from './preprocessors';
import { createDefaultPostprocessors, executePostprocessors } from './postprocessors';
import {
  ArchitectAgent,
  ArchitectResult,
  BatchParseOptions,
  CoreLogger,
  ExtractorAgent,
  ParseratorPreprocessor,
  ParseratorPostprocessor,
  ParseratorPlanCache,
  ParseratorPlanCacheEntry,
  ParseratorPlanCacheEvent,
  ParseDiagnostic,
  ParseError,
  ParseMetadata,
  ParseOptions,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
  ParseratorCoreOptions,
  ParseratorProfileOption,
  ParseratorSessionFromResponseOptions,
  ParseratorSessionInit,
  ParseratorSessionSnapshot,
  ParseratorTelemetry,
  ParseratorInterceptor,
  ParseratorInterceptorContext,
  ParseratorInterceptorSuccessContext,
  ParseratorInterceptorFailureContext,
  StageMetrics,
  SearchPlan,
  SessionParseOverrides
} from './types';
import {
  clamp,
  clonePlan,
  createEmptyPlan,
  createFailureResponse,
  createPlanCacheKey,
  stableStringify,
  toParseError,
  validateParseRequest
} from './utils';

export * from './types';
export * from './profiles';
export { ParseratorSession } from './session';
export { createDefaultPreprocessors } from './preprocessors';
export { createDefaultPostprocessors } from './postprocessors';

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
  private profileName?: string;
  private profileOverrides: Partial<ParseratorCoreConfig> = {};
  private configOverrides: Partial<ParseratorCoreConfig> = {};
  private telemetry: ParseratorTelemetry;
  private planCache?: ParseratorPlanCache;
  private readonly interceptors = new Set<ParseratorInterceptor>();
  private readonly preprocessors: ParseratorPreprocessor[] = [];
  private readonly postprocessors: ParseratorPostprocessor[] = [];

  constructor(options: ParseratorCoreOptions) {
    if (!options?.apiKey || options.apiKey.trim().length === 0) {
      throw new Error('ParseratorCore requires a non-empty apiKey');
    }

    this.apiKey = options.apiKey;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.telemetry = createTelemetryHub(options.telemetry, this.logger);

    if (options.interceptors) {
      const interceptors = Array.isArray(options.interceptors)
        ? options.interceptors
        : [options.interceptors];
      interceptors.forEach(interceptor => this.use(interceptor));
    }

    this.planCache = options.planCache === null ? undefined : options.planCache ?? createInMemoryPlanCache();

    const preprocessorInput =
      options.preprocessors === null
        ? []
        : options.preprocessors ?? createDefaultPreprocessors(this.logger);
    const preprocessors = Array.isArray(preprocessorInput)
      ? preprocessorInput
      : [preprocessorInput];
    preprocessors.forEach(preprocessor => this.usePreprocessor(preprocessor));

    const postprocessorInput =
      options.postprocessors === null
        ? []
        : options.postprocessors ?? createDefaultPostprocessors(this.logger);
    const postprocessors = Array.isArray(postprocessorInput)
      ? postprocessorInput
      : [postprocessorInput];
    postprocessors.forEach(postprocessor => this.usePostprocessor(postprocessor));

    const resolvedProfile = resolveProfile(options.profile ?? 'lean-agent', {
      logger: this.logger
    });

    if (resolvedProfile) {
      this.profileName = resolvedProfile.profile.name;
      this.profileOverrides = { ...(resolvedProfile.config ?? {}) };
    }

    this.configOverrides = { ...(options.config ?? {}) };
    this.config = this.composeConfig();

    const initialResolvers =
      options.resolvers ?? resolvedProfile?.resolvers ?? createDefaultResolvers(this.logger);
    this.resolverRegistry = new ResolverRegistry(initialResolvers, this.logger);

    this.architect = options.architect ?? resolvedProfile?.architect ?? new HeuristicArchitect(this.logger);

    const extractor =
      options.extractor ?? resolvedProfile?.extractor ?? new RegexExtractor(this.logger, this.resolverRegistry);
    this.attachRegistryIfSupported(extractor);
    this.extractor = extractor;

    this.logger.info?.('parserator-core:initialised', {
      profile: this.profileName,
      config: this.config
    });
  }

  updateConfig(partial: Partial<ParseratorCoreConfig>): void {
    this.configOverrides = { ...this.configOverrides, ...partial };
    this.config = this.composeConfig();
    this.logger.info?.('parserator-core:config-updated', { config: this.config });
  }

  getConfig(): ParseratorCoreConfig {
    return { ...this.config };
  }

  getProfile(): string | undefined {
    return this.profileName;
  }

  applyProfile(profile: ParseratorProfileOption): void {
    const resolvedProfile = resolveProfile(profile, { logger: this.logger });
    if (!resolvedProfile) {
      throw new Error(`Unknown Parserator profile: ${String((profile as any)?.name ?? profile)}`);
    }

    this.profileName = resolvedProfile.profile.name;
    this.profileOverrides = { ...(resolvedProfile.config ?? {}) };
    if (resolvedProfile.resolvers) {
      this.resolverRegistry.replaceAll(resolvedProfile.resolvers);
    }

    if (resolvedProfile.architect) {
      this.architect = resolvedProfile.architect;
    }

    if (resolvedProfile.extractor) {
      this.attachRegistryIfSupported(resolvedProfile.extractor);
      this.extractor = resolvedProfile.extractor;
    }

    this.config = this.composeConfig();

    this.logger.info?.('parserator-core:profile-applied', {
      profile: this.profileName,
      config: this.config
    });
  }

  static profiles() {
    return listParseratorProfiles();
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

  use(interceptor: ParseratorInterceptor): () => void {
    this.interceptors.add(interceptor);
    return () => this.interceptors.delete(interceptor);
  }

  listInterceptors(): ParseratorInterceptor[] {
    return this.getInterceptors();
  }

  usePreprocessor(preprocessor: ParseratorPreprocessor): () => void {
    this.preprocessors.push(preprocessor);
    return () => {
      const index = this.preprocessors.indexOf(preprocessor);
      if (index >= 0) {
        this.preprocessors.splice(index, 1);
      }
    };
  }

  listPreprocessors(): ParseratorPreprocessor[] {
    return this.getPreprocessors();
  }

  clearPreprocessors(): void {
    this.preprocessors.length = 0;
  }

  usePostprocessor(postprocessor: ParseratorPostprocessor): () => void {
    this.postprocessors.push(postprocessor);
    return () => {
      const index = this.postprocessors.indexOf(postprocessor);
      if (index >= 0) {
        this.postprocessors.splice(index, 1);
      }
    };
  }

  listPostprocessors(): ParseratorPostprocessor[] {
    return this.getPostprocessors();
  }

  clearPostprocessors(): void {
    this.postprocessors.length = 0;
  }

  createSession(init: ParseratorSessionInit): ParseratorSession {
    const planCacheKey = this.planCache
      ? createPlanCacheKey({
          outputSchema: init.outputSchema,
          instructions: init.instructions,
          options: init.options,
          profile: this.profileName
        })
      : undefined;

    return new ParseratorSession({
      architect: this.architect,
      extractor: this.extractor,
      config: () => this.config,
      logger: this.logger,
      telemetry: this.telemetry,
      interceptors: () => this.getInterceptors(),
      preprocessors: () => this.getPreprocessors(),
      postprocessors: () => this.getPostprocessors(),
      profile: this.profileName,
      planCache: this.planCache,
      planCacheKey,
      init
    });
  }

  createSessionFromResponse(options: ParseratorSessionFromResponseOptions): ParseratorSession {
    if (!options?.request?.outputSchema) {
      throw new Error('ParseratorCore.createSessionFromResponse requires a request with an outputSchema');
    }

    const metadata = options.response?.metadata;
    if (!metadata?.architectPlan) {
      throw new Error('ParseratorCore.createSessionFromResponse requires response metadata with an architectPlan');
    }

    const overrides = options.overrides ?? {};
    const baseOptions = options.request.options;
    const overrideOptions = overrides.options;
    const mergedOptions =
      baseOptions && overrideOptions
        ? ({ ...baseOptions, ...overrideOptions } as ParseOptions)
        : overrideOptions ?? baseOptions;

    const sessionInit: ParseratorSessionInit = {
      outputSchema: overrides.outputSchema ?? options.request.outputSchema,
      instructions:
        overrides.instructions ?? options.request.instructions ?? undefined,
      options: mergedOptions,
      seedInput: overrides.seedInput ?? options.request.inputData,
      plan: overrides.plan ?? metadata.architectPlan,
      planConfidence: overrides.planConfidence ?? metadata.confidence,
      planDiagnostics: overrides.planDiagnostics ?? metadata.diagnostics ?? [],
      sessionId: overrides.sessionId,
      autoRefresh: overrides.autoRefresh
    };

    this.logger.info?.('parserator-core:session-created-from-response', {
      sessionId: sessionInit.sessionId,
      planVersion: sessionInit.plan?.version,
      diagnostics: sessionInit.planDiagnostics?.length ?? 0
    });

    return this.createSession(sessionInit);
  }

  async getPlanCacheEntry(request: ParseRequest): Promise<ParseratorPlanCacheEntry | undefined> {
    const planCacheKey = this.getPlanCacheKey(request);
    if (!planCacheKey || !this.planCache) {
      return undefined;
    }

    try {
      const entry = await this.planCache.get(planCacheKey);
      if (!entry) {
        return undefined;
      }

      return this.cloneCacheEntry(entry);
    } catch (error) {
      this.logger.warn?.('parserator-core:plan-cache-introspect-failed', {
        error: error instanceof Error ? error.message : error,
        profile: this.profileName,
        key: planCacheKey,
        operation: 'get'
      });
      return undefined;
    }
  }

  async deletePlanCacheEntry(request: ParseRequest): Promise<boolean> {
    const planCacheKey = this.getPlanCacheKey(request);
    if (!planCacheKey || !this.planCache || typeof this.planCache.delete !== 'function') {
      this.logger.warn?.('parserator-core:plan-cache-delete-unsupported', {
        profile: this.profileName,
        key: planCacheKey
      });
      return false;
    }

    try {
      await this.planCache.delete(planCacheKey);
      this.logger.info?.('parserator-core:plan-cache-delete', {
        profile: this.profileName,
        key: planCacheKey
      });
      this.emitPlanCacheEvent({
        action: 'delete',
        key: planCacheKey,
        reason: 'management'
      });
      return true;
    } catch (error) {
      this.logger.warn?.('parserator-core:plan-cache-delete-failed', {
        error: error instanceof Error ? error.message : error,
        profile: this.profileName,
        key: planCacheKey
      });
      this.emitPlanCacheEvent({
        action: 'delete',
        key: planCacheKey,
        reason: 'management',
        error
      });
      return false;
    }
  }

  async clearPlanCache(profile?: string): Promise<boolean> {
    if (!this.planCache || typeof this.planCache.clear !== 'function') {
      this.logger.warn?.('parserator-core:plan-cache-clear-unsupported', {
        profile: profile ?? this.profileName ?? 'all'
      });
      return false;
    }

    const targetProfile = profile ?? this.profileName;

    try {
      await Promise.resolve(this.planCache.clear(targetProfile));
      this.logger.info?.('parserator-core:plan-cache-cleared', {
        profile: targetProfile ?? 'all'
      });
      this.emitPlanCacheEvent({
        action: 'clear',
        scope: targetProfile ?? 'all',
        reason: 'management'
      });
      return true;
    } catch (error) {
      this.logger.warn?.('parserator-core:plan-cache-clear-failed', {
        error: error instanceof Error ? error.message : error,
        profile: targetProfile ?? 'all'
      });
      this.emitPlanCacheEvent({
        action: 'clear',
        scope: targetProfile ?? 'all',
        reason: 'management',
        error
      });
      return false;
    }
  }

  private composeConfig(): ParseratorCoreConfig {
    return {
      ...DEFAULT_CONFIG,
      ...this.profileOverrides,
      ...this.configOverrides
    };
  }

  async parse(request: ParseRequest): Promise<ParseResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    const preprocessOutcome = await this.runPreprocessors({ request, requestId });
    request = preprocessOutcome.request;
    const preprocessDiagnostics = preprocessOutcome.diagnostics;
    const preprocessMetrics = preprocessOutcome.metrics;
    const hasPreprocessStage =
      (preprocessMetrics.runs ?? 0) > 0 || preprocessDiagnostics.length > 0;

    await this.runBeforeInterceptors({
      request,
      requestId,
      profile: this.profileName,
      source: 'core'
    });

    this.telemetry.emit({
      type: 'parse:start',
      source: 'core',
      requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      inputLength: request.inputData.length,
      schemaFieldCount: Object.keys(request.outputSchema ?? {}).length,
      options: request.options
    });

    try {
      validateParseRequest(request, this.config);
    } catch (error) {
      const parseError = toParseError(error, 'validation');
      const diagnostics: ParseDiagnostic[] = [
        ...preprocessDiagnostics,
        {
          field: '*',
          stage: 'validation',
          message: parseError.message,
          severity: 'error'
        }
      ];
      const stageBreakdown: ParseMetadata['stageBreakdown'] = {
        architect: { timeMs: 0, tokens: 0, confidence: 0 },
        extractor: { timeMs: 0, tokens: 0, confidence: 0 }
      };
      if (hasPreprocessStage) {
        stageBreakdown.preprocess = preprocessMetrics;
      }

      const response = createFailureResponse({
        error: parseError,
        plan: createEmptyPlan(request, this.config),
        requestId,
        diagnostics,
        stageBreakdown
      });
      this.telemetry.emit({
        type: 'parse:failure',
        source: 'core',
        requestId,
        timestamp: new Date().toISOString(),
        profile: this.profileName,
        stage: 'validation',
        error: response.error!,
        diagnostics: response.metadata.diagnostics,
        metadata: response.metadata
      });
      await this.runFailureInterceptors({
        request,
        requestId,
        profile: this.profileName,
        source: 'core',
        plan: response.metadata.architectPlan,
        response,
        error: response.error!
      });
      return response;
    }

    const planCacheKey = this.getPlanCacheKey(request);
    let cachedEntry: ParseratorPlanCacheEntry | undefined;

    if (planCacheKey && this.planCache) {
      try {
        cachedEntry = await this.planCache.get(planCacheKey);
        if (cachedEntry) {
          this.logger.info?.('parserator-core:plan-cache-hit', {
            profile: this.profileName,
            key: planCacheKey
          });
          this.emitPlanCacheEvent({
            action: 'hit',
            key: planCacheKey,
            planId: cachedEntry.plan.id,
            confidence: cachedEntry.confidence,
            tokensUsed: cachedEntry.tokensUsed,
            processingTimeMs: cachedEntry.processingTimeMs,
            requestId,
            reason: 'parse'
          });
        } else {
          this.emitPlanCacheEvent({
            action: 'miss',
            key: planCacheKey,
            requestId,
            reason: 'parse'
          });
        }
      } catch (error) {
        this.logger.warn?.('parserator-core:plan-cache-get-failed', {
          error: error instanceof Error ? error.message : error,
          profile: this.profileName
        });
        this.emitPlanCacheEvent({
          action: 'miss',
          key: planCacheKey,
          requestId,
          reason: 'parse',
          error
        });
      }
    }

    let architectResult: ArchitectResult;
    let planTokens = 0;
    let planProcessingTime = 0;
    let planConfidence = this.config.minConfidence;
    let planDiagnostics: ParseDiagnostic[] = [];

    if (cachedEntry?.plan) {
      planTokens = cachedEntry.tokensUsed;
      planProcessingTime = cachedEntry.processingTimeMs;
      planConfidence = clamp(cachedEntry.confidence ?? this.config.minConfidence, 0, 1);
      planDiagnostics = [...cachedEntry.diagnostics];

      architectResult = {
        success: true,
        searchPlan: clonePlan(cachedEntry.plan, 'cached'),
        tokensUsed: 0,
        processingTimeMs: 0,
        confidence: planConfidence,
        diagnostics: [...cachedEntry.diagnostics]
      };

      this.telemetry.emit({
        type: 'parse:stage',
        source: 'core',
        requestId,
        timestamp: new Date().toISOString(),
        profile: this.profileName,
        stage: 'architect',
        metrics: {
          timeMs: 0,
          tokens: 0,
          confidence: planConfidence
        },
        diagnostics: planDiagnostics
      });
    } else {
      architectResult = await this.architect.createPlan({
        inputData: request.inputData,
        outputSchema: request.outputSchema,
        instructions: request.instructions,
        options: request.options,
        config: this.config
      });

      planTokens = architectResult.tokensUsed;
      planProcessingTime = architectResult.processingTimeMs;
      planConfidence = clamp(architectResult.confidence, 0, 1);
      planDiagnostics = [...architectResult.diagnostics];

      this.telemetry.emit({
        type: 'parse:stage',
        source: 'core',
        requestId,
        timestamp: new Date().toISOString(),
        profile: this.profileName,
        stage: 'architect',
        metrics: {
          timeMs: architectResult.processingTimeMs,
          tokens: architectResult.tokensUsed,
          confidence: architectResult.confidence
        },
        diagnostics: architectResult.diagnostics
      });

      if (!architectResult.success || !architectResult.searchPlan) {
        return await this.handleArchitectFailure({
          request,
          architectResult,
          requestId,
          startTime,
          preprocessDiagnostics,
          preprocessMetrics,
          hasPreprocessStage
        });
      }

      if (planCacheKey && this.planCache) {
        const entry: ParseratorPlanCacheEntry = {
          plan: clonePlan(architectResult.searchPlan!, architectResult.searchPlan!.metadata.origin),
          confidence: planConfidence,
          diagnostics: [...planDiagnostics],
          tokensUsed: planTokens,
          processingTimeMs: planProcessingTime,
          updatedAt: new Date().toISOString(),
          profile: this.profileName
        };

        try {
          await this.planCache.set(planCacheKey, entry);
          this.logger.info?.('parserator-core:plan-cache-set', {
            profile: this.profileName,
            key: planCacheKey
          });
          this.emitPlanCacheEvent({
            action: 'store',
            key: planCacheKey,
            planId: entry.plan.id,
            confidence: entry.confidence,
            tokensUsed: entry.tokensUsed,
            processingTimeMs: entry.processingTimeMs,
            requestId,
            reason: 'parse'
          });
        } catch (error) {
          this.logger.warn?.('parserator-core:plan-cache-set-failed', {
            error: error instanceof Error ? error.message : error,
            profile: this.profileName
          });
          this.emitPlanCacheEvent({
            action: 'store',
            key: planCacheKey,
            planId: entry.plan.id,
            requestId,
            reason: 'parse',
            error
          });
        }
      }
    }

    const activePlan = architectResult.searchPlan!;

    const extractorResult = await this.extractor.execute({
      inputData: request.inputData,
      plan: activePlan,
      config: this.config
    });

    this.telemetry.emit({
      type: 'parse:stage',
      source: 'core',
      requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      stage: 'extractor',
      metrics: {
        timeMs: extractorResult.processingTimeMs,
        tokens: extractorResult.tokensUsed,
        confidence: extractorResult.confidence
      },
      diagnostics: extractorResult.diagnostics
    });

    if (!extractorResult.success || !extractorResult.parsedData) {
      return await this.handleExtractorFailure({
        requestId,
        request,
        architectResult,
        extractorResult,
        startTime,
        preprocessDiagnostics,
        preprocessMetrics,
        hasPreprocessStage
      });
    }

    const totalTokens = architectResult.tokensUsed + extractorResult.tokensUsed;
    const baseConfidence = clamp(
      architectResult.confidence * 0.35 + extractorResult.confidence * 0.65,
      0,
      1
    );

    let metadata: ParseMetadata = {
      architectPlan: clonePlan(activePlan, activePlan.metadata.origin),
      confidence: baseConfidence,
      tokensUsed: totalTokens,
      processingTimeMs: Date.now() - startTime,
      architectTokens: architectResult.tokensUsed,
      extractorTokens: extractorResult.tokensUsed,
      requestId,
      timestamp: new Date().toISOString(),
      diagnostics: [
        ...preprocessDiagnostics,
        ...architectResult.diagnostics,
        ...extractorResult.diagnostics
      ],
      stageBreakdown: {
        architect: {
          timeMs: architectResult.processingTimeMs,
          tokens: architectResult.tokensUsed,
          confidence: architectResult.confidence
        },
        extractor: {
          timeMs: extractorResult.processingTimeMs,
          tokens: extractorResult.tokensUsed,
          confidence: extractorResult.confidence
        }
      }
    };

    if (hasPreprocessStage) {
      metadata.stageBreakdown.preprocess = preprocessMetrics;
    }

    const postprocessOutcome = await this.runPostprocessors({
      request,
      requestId,
      parsedData: extractorResult.parsedData,
      metadata
    });
    const postprocessDiagnostics = postprocessOutcome.diagnostics;
    const postprocessMetrics = postprocessOutcome.metrics;
    const hasPostprocessStage =
      (postprocessMetrics.runs ?? 0) > 0 || postprocessDiagnostics.length > 0;

    metadata = postprocessOutcome.metadata;
    if (hasPreprocessStage && !metadata.stageBreakdown.preprocess) {
      metadata.stageBreakdown.preprocess = preprocessMetrics;
    }
    if (hasPostprocessStage) {
      metadata.stageBreakdown.postprocess = postprocessMetrics;
    }

    const finalParsedData = postprocessOutcome.parsedData;
    const threshold = request.options?.confidenceThreshold ?? this.config.minConfidence;

    let error: ParseError | undefined;
    if (metadata.confidence < threshold) {
      const failingStage: ParseDiagnostic['stage'] =
        metadata.confidence < baseConfidence ? 'postprocess' : 'extractor';
      const warning: ParseDiagnostic = {
        field: '*',
        stage: failingStage,
        message: `Confidence ${metadata.confidence
          .toFixed(2)} below threshold ${threshold.toFixed(2)}`,
        severity: 'warning'
      };
      metadata = {
        ...metadata,
        diagnostics: [...metadata.diagnostics, warning]
      };

      if (!this.config.enableFieldFallbacks) {
        error = {
          code: 'LOW_CONFIDENCE',
          message: warning.message,
          stage: failingStage,
          details: { confidence: metadata.confidence, threshold }
        };
      }
    }

    const response: ParseResponse = {
      success: !error,
      parsedData: finalParsedData,
      metadata,
      error
    };

    if (error) {
      this.telemetry.emit({
        type: 'parse:failure',
        source: 'core',
        requestId,
        timestamp: metadata.timestamp,
        profile: this.profileName,
        stage: error.stage,
        error,
        diagnostics: metadata.diagnostics,
        metadata
      });
      await this.runFailureInterceptors({
        request,
        requestId,
        profile: this.profileName,
        source: 'core',
        plan: metadata.architectPlan,
        response,
        error
      });
    } else {
      this.telemetry.emit({
        type: 'parse:success',
        source: 'core',
        requestId,
        timestamp: metadata.timestamp,
        profile: this.profileName,
        metadata
      });
      await this.runAfterInterceptors({
        request,
        requestId,
        profile: this.profileName,
        source: 'core',
        plan: metadata.architectPlan,
        response
      });
    }

    return response;
  }

  async parseMany(
    requests: ParseRequest[],
    options: BatchParseOptions = {}
  ): Promise<ParseResponse[]> {
    if (!Array.isArray(requests) || requests.length === 0) {
      return [];
    }

    const reusePlan = options.reusePlan ?? true;
    if (!reusePlan || requests.length === 1) {
      const responses: ParseResponse[] = [];
      for (const request of requests) {
        responses.push(await this.parse(request));
      }
      return responses;
    }

    const [first, ...rest] = requests;
    const schemaKey = stableStringify(first.outputSchema);
    const instructionsKey = first.instructions ?? '';

    for (const request of rest) {
      if (stableStringify(request.outputSchema) !== schemaKey) {
        throw new Error(
          'All batch requests must share the same outputSchema when reusePlan is enabled'
        );
      }

      if ((request.instructions ?? '') !== instructionsKey) {
        throw new Error(
          'All batch requests must share the same instructions when reusePlan is enabled'
        );
      }
    }

    const session = this.createSession({
      outputSchema: first.outputSchema,
      instructions: first.instructions,
      options: first.options,
      seedInput: options.seedInput ?? first.inputData
    });

    const responses: ParseResponse[] = [];
    for (const [index, request] of requests.entries()) {
      const overrides: SessionParseOverrides = {};

      if (index === 0 && options.seedInput) {
        overrides.seedInput = options.seedInput;
      }

      if (request.options && index !== 0) {
        overrides.options = request.options;
      }

      const response = await session.parse(request.inputData, overrides);
      responses.push(response);
    }

    return responses;
  }

  private getInterceptors(): ParseratorInterceptor[] {
    return Array.from(this.interceptors);
  }

  private getPreprocessors(): ParseratorPreprocessor[] {
    return [...this.preprocessors];
  }

  private getPostprocessors(): ParseratorPostprocessor[] {
    return [...this.postprocessors];
  }

  private getPlanCacheKey(request: ParseRequest): string | undefined {
    if (!this.planCache) {
      return undefined;
    }

    try {
      return createPlanCacheKey({
        outputSchema: request.outputSchema,
        instructions: request.instructions,
        options: request.options,
        profile: this.profileName
      });
    } catch (error) {
      this.logger.warn?.('parserator-core:plan-cache-key-failed', {
        error: error instanceof Error ? error.message : error,
        profile: this.profileName
      });
      return undefined;
    }
  }

  private cloneCacheEntry(entry: ParseratorPlanCacheEntry): ParseratorPlanCacheEntry {
    return {
      ...entry,
      plan: clonePlan(entry.plan, entry.plan.metadata.origin),
      diagnostics: [...entry.diagnostics]
    };
  }

  private emitPlanCacheEvent(event: {
    action: ParseratorPlanCacheEvent['action'];
    key?: string;
    scope?: string;
    planId?: string;
    confidence?: number;
    tokensUsed?: number;
    processingTimeMs?: number;
    requestId?: string;
    reason?: string;
    error?: unknown;
  }): void {
    const requestId = event.requestId ?? uuidv4();
    const errorMessage =
      event.error === undefined
        ? undefined
        : event.error instanceof Error
        ? event.error.message
        : typeof event.error === 'string'
        ? event.error
        : String(event.error);

    this.telemetry.emit({
      type: 'plan:cache',
      source: 'core',
      requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      action: event.action,
      key: event.key,
      scope: event.scope,
      planId: event.planId,
      confidence: event.confidence,
      tokensUsed: event.tokensUsed,
      processingTimeMs: event.processingTimeMs,
      reason: event.reason,
      error: errorMessage
    });
  }

  private async runBeforeInterceptors(context: ParseratorInterceptorContext): Promise<void> {
    for (const interceptor of this.interceptors) {
      if (!interceptor.beforeParse) {
        continue;
      }
      try {
        await interceptor.beforeParse(context);
      } catch (error) {
        this.logger.warn?.('parserator-core:interceptor-before-error', {
          error: error instanceof Error ? error.message : error,
          requestId: context.requestId
        });
      }
    }
  }

  private async runPreprocessors(params: {
    request: ParseRequest;
    requestId: string;
  }): Promise<{ request: ParseRequest; diagnostics: ParseDiagnostic[]; metrics: StageMetrics }>
  {
    const preprocessors = this.getPreprocessors();
    const result = await executePreprocessors(preprocessors, {
      request: params.request,
      config: this.config,
      profile: this.profileName,
      logger: this.logger,
      shared: new Map()
    });

    if ((result.metrics.runs ?? 0) > 0 || result.diagnostics.length) {
      this.telemetry.emit({
        type: 'parse:stage',
        source: 'core',
        requestId: params.requestId,
        timestamp: new Date().toISOString(),
        profile: this.profileName,
        stage: 'preprocess',
        metrics: result.metrics,
        diagnostics: result.diagnostics
      });
    }

    return result;
  }

  private async runPostprocessors(params: {
    request: ParseRequest;
    requestId: string;
    parsedData: Record<string, unknown>;
    metadata: ParseMetadata;
  }): Promise<{
    parsedData: Record<string, unknown>;
    metadata: ParseMetadata;
    diagnostics: ParseDiagnostic[];
    metrics: StageMetrics;
  }> {
    const postprocessors = this.getPostprocessors();
    const result = await executePostprocessors(postprocessors, {
      request: params.request,
      parsedData: params.parsedData,
      metadata: params.metadata,
      config: this.config,
      profile: this.profileName,
      logger: this.logger,
      shared: new Map()
    });

    if ((result.metrics.runs ?? 0) > 0 || result.diagnostics.length) {
      this.telemetry.emit({
        type: 'parse:stage',
        source: 'core',
        requestId: params.requestId,
        timestamp: new Date().toISOString(),
        profile: this.profileName,
        stage: 'postprocess',
        metrics: result.metrics,
        diagnostics: result.diagnostics
      });
    }

    return result;
  }

  private async runAfterInterceptors(context: ParseratorInterceptorSuccessContext): Promise<void> {
    for (const interceptor of this.interceptors) {
      if (!interceptor.afterParse) {
        continue;
      }
      try {
        await interceptor.afterParse(context);
      } catch (error) {
        this.logger.warn?.('parserator-core:interceptor-after-error', {
          error: error instanceof Error ? error.message : error,
          requestId: context.requestId
        });
      }
    }
  }

  private async runFailureInterceptors(context: ParseratorInterceptorFailureContext): Promise<void> {
    for (const interceptor of this.interceptors) {
      if (!interceptor.onFailure) {
        continue;
      }
      try {
        await interceptor.onFailure(context);
      } catch (error) {
        this.logger.warn?.('parserator-core:interceptor-failure-error', {
          error: error instanceof Error ? error.message : error,
          requestId: context.requestId
        });
      }
    }
  }

  private async handleArchitectFailure(params: {
    request: ParseRequest;
    architectResult: ArchitectResult;
    requestId: string;
    startTime: number;
    preprocessDiagnostics: ParseDiagnostic[];
    preprocessMetrics: StageMetrics;
    hasPreprocessStage: boolean;
  }): Promise<ParseResponse> {
    const {
      request,
      architectResult,
      requestId,
      startTime,
      preprocessDiagnostics,
      preprocessMetrics,
      hasPreprocessStage
    } = params;
    const fallbackDiagnostic: ParseDiagnostic = {
      field: '*',
      stage: 'architect',
      message:
        architectResult.error?.message || 'Architect was unable to generate a search plan',
      severity: 'error'
    };

    const diagnostics: ParseDiagnostic[] = [
      ...preprocessDiagnostics,
      ...(architectResult.diagnostics.length ? architectResult.diagnostics : [fallbackDiagnostic])
    ];

    const stageBreakdown: ParseMetadata['stageBreakdown'] = {
      architect: {
        timeMs: architectResult.processingTimeMs,
        tokens: architectResult.tokensUsed,
        confidence: architectResult.confidence ?? 0
      },
      extractor: { timeMs: 0, tokens: 0, confidence: 0 }
    };
    if (hasPreprocessStage) {
      stageBreakdown.preprocess = preprocessMetrics;
    }

    const response = createFailureResponse({
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
      architectTokens: architectResult.tokensUsed,
      stageBreakdown
    });

    this.telemetry.emit({
      type: 'parse:failure',
      source: 'core',
      requestId,
      timestamp: response.metadata.timestamp,
      profile: this.profileName,
      stage: response.error!.stage,
      error: response.error!,
      diagnostics: response.metadata.diagnostics,
      metadata: response.metadata
    });

    await this.runFailureInterceptors({
      request,
      requestId,
      profile: this.profileName,
      source: 'core',
      plan: response.metadata.architectPlan,
      response,
      error: response.error!
    });

    return response;
  }

  private async handleExtractorFailure(params: {
    requestId: string;
    request: ParseRequest;
    architectResult: ArchitectResult;
    extractorResult: Awaited<ReturnType<ExtractorAgent['execute']>>;
    startTime: number;
    preprocessDiagnostics: ParseDiagnostic[];
    preprocessMetrics: StageMetrics;
    hasPreprocessStage: boolean;
  }): Promise<ParseResponse> {
    const {
      requestId,
      architectResult,
      extractorResult,
      startTime,
      request,
      preprocessDiagnostics,
      preprocessMetrics,
      hasPreprocessStage
    } = params;

    const fallbackDiagnostic: ParseDiagnostic = {
      field: '*',
      stage: 'extractor',
      message:
        extractorResult.error?.message || 'Extractor failed to resolve required fields',
      severity: 'error'
    };

    const diagnostics: ParseDiagnostic[] = [
      ...preprocessDiagnostics,
      ...architectResult.diagnostics,
      ...extractorResult.diagnostics,
      ...(extractorResult.success ? [] : [fallbackDiagnostic])
    ];

    const stageBreakdown: ParseMetadata['stageBreakdown'] = {
      architect: {
        timeMs: architectResult.processingTimeMs,
        tokens: architectResult.tokensUsed,
        confidence: architectResult.confidence
      },
      extractor: {
        timeMs: extractorResult.processingTimeMs,
        tokens: extractorResult.tokensUsed,
        confidence: extractorResult.confidence
      }
    };
    if (hasPreprocessStage) {
      stageBreakdown.preprocess = preprocessMetrics;
    }

    const response = createFailureResponse({
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
      extractorTokens: extractorResult.tokensUsed,
      stageBreakdown
    });

    this.telemetry.emit({
      type: 'parse:failure',
      source: 'core',
      requestId,
      timestamp: response.metadata.timestamp,
      profile: this.profileName,
      stage: response.error!.stage,
      error: response.error!,
      diagnostics: response.metadata.diagnostics,
      metadata: response.metadata
    });

    await this.runFailureInterceptors({
      request,
      requestId,
      profile: this.profileName,
      source: 'core',
      plan: response.metadata.architectPlan,
      response,
      error: response.error!
    });

    return response;
  }

  private attachRegistryIfSupported(agent: ExtractorAgent): void {
    if (typeof (agent as any)?.attachRegistry === 'function') {
      (agent as any).attachRegistry(this.resolverRegistry);
    }
  }
}

export {
  HeuristicArchitect,
  RegexExtractor,
  ResolverRegistry,
  createDefaultResolvers,
  createInMemoryPlanCache,
  createTelemetryHub,
  TelemetryHub
};
