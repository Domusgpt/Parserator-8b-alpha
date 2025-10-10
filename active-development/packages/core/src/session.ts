import { v4 as uuidv4 } from 'uuid';

import {
  ArchitectAgent,
  CoreLogger,
  ExtractorAgent,
  ParseDiagnostic,
  ParseError,
  ParseMetadata,
  ParseOptions,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
  ParseratorPlanRefreshResult,
  ParseratorPlanState,
  ParseratorSessionInit,
  ParseratorSessionSnapshot,
  ParseratorTelemetry,
  ParseratorInterceptor,
  ParseratorInterceptorContext,
  ParseratorInterceptorSuccessContext,
  ParseratorInterceptorFailureContext,
  ParseratorPreprocessor,
  ParseratorPostprocessor,
  SearchPlan,
  SessionParseOverrides,
  RefreshPlanOptions,
  ParseratorPlanAutoRefreshConfig,
  ParseratorAutoRefreshState,
  ParseratorAutoRefreshReason,
  ParseratorPlanCache,
  ParseratorPlanCacheEvent,
  StageMetrics
} from './types';
import {
  clamp,
  createEmptyPlan,
  createFailureResponse,
  clonePlan,
  createPlanCacheKey,
  toParseError,
  validateParseRequest
} from './utils';
import { executePreprocessors } from './preprocessors';
import { executePostprocessors } from './postprocessors';

interface ParseratorSessionDependencies {
  architect: ArchitectAgent;
  extractor: ExtractorAgent;
  config: () => ParseratorCoreConfig;
  logger: CoreLogger;
  telemetry: ParseratorTelemetry;
  interceptors: () => ParseratorInterceptor[];
  preprocessors: () => ParseratorPreprocessor[];
  postprocessors: () => ParseratorPostprocessor[];
  profile?: string;
  planCache?: ParseratorPlanCache;
  planCacheKey?: string;
  init: ParseratorSessionInit;
}

interface NormalizedAutoRefreshConfig {
  minConfidence?: number;
  maxParses?: number;
  minIntervalMs?: number;
  lowConfidenceGrace: number;
}

export class ParseratorSession {
  readonly id: string;
  readonly createdAt: string;

  private plan?: SearchPlan;
  private planDiagnostics: ParseDiagnostic[] = [];
  private planConfidence: number;
  private planTokens = 0;
  private planProcessingTime = 0;
  private totalArchitectTokens = 0;
  private totalExtractorTokens = 0;
  private parseCount = 0;
  private lastRequestId?: string;
  private lastConfidence?: number;
  private lastDiagnostics: ParseDiagnostic[] = [];
  private lastResponse?: ParseResponse;
  private defaultSeedInput?: string;
  private telemetry: ParseratorTelemetry;
  private profileName?: string;
  private planCache?: ParseratorPlanCache;
  private planCacheKey?: string;
  private planUpdatedAt?: string;
  private lastSeedInput?: string;
  private autoRefreshConfig?: ParseratorPlanAutoRefreshConfig;
  private autoRefresh?: NormalizedAutoRefreshConfig;
  private parsesSinceRefresh = 0;
  private lowConfidenceRuns = 0;
  private lastAutoRefreshAt?: number;
  private lastAutoRefreshAttemptAt?: number;
  private lastAutoRefreshReason?: ParseratorAutoRefreshReason;
  private autoRefreshPending = false;

  constructor(private readonly deps: ParseratorSessionDependencies) {
    this.id = deps.init.sessionId ?? uuidv4();
    this.createdAt = new Date().toISOString();
    this.planConfidence = clamp(deps.init.planConfidence ?? 0.8, 0, 1);
    this.defaultSeedInput = deps.init.seedInput;
    this.telemetry = deps.telemetry;
    this.profileName = deps.profile;
    this.lastSeedInput = deps.init.seedInput;
    this.autoRefreshConfig = deps.init.autoRefresh ? { ...deps.init.autoRefresh } : undefined;
    this.autoRefresh = this.normaliseAutoRefresh(this.autoRefreshConfig);
    this.deps.init.autoRefresh = this.autoRefreshConfig;
    this.planCache = deps.planCache;
    this.planCacheKey = deps.planCacheKey ?? this.resolvePlanCacheKey(deps.init);

    if (deps.init.plan) {
      this.plan = clonePlan(deps.init.plan, 'cached');
      this.planDiagnostics = [...(deps.init.planDiagnostics ?? [])];
      this.planTokens = 0;
      this.totalArchitectTokens = 0;
      this.planUpdatedAt = new Date().toISOString();
      this.deps.logger.info?.('parserator-core:session-plan-attached', {
        sessionId: this.id,
        planId: this.plan.id,
        strategy: this.plan.strategy
      });
      this.queuePlanCachePersist('init');
    }

    if (this.autoRefresh) {
      this.resetAutoRefreshState();
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

    let request: ParseRequest = {
      inputData,
      outputSchema: this.deps.init.outputSchema,
      instructions: overrides.instructions ?? this.deps.init.instructions,
      options
    };

    const requestId = uuidv4();
    const startTime = Date.now();
    const validationConfig = this.getConfig();

    const preprocessOutcome = await this.executePreprocessorsForRequest({
      request,
      requestId,
      config: validationConfig
    });
    request = preprocessOutcome.request;
    const preprocessDiagnostics = preprocessOutcome.diagnostics;
    const preprocessMetrics = preprocessOutcome.metrics;
    const hasPreprocessStage =
      (preprocessMetrics.runs ?? 0) > 0 || preprocessDiagnostics.length > 0;

    await this.runBeforeInterceptors({
      request,
      requestId,
      profile: this.profileName,
      source: 'session',
      sessionId: this.id
    });

    this.telemetry.emit({
      type: 'parse:start',
      source: 'session',
      requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      sessionId: this.id,
      inputLength: request.inputData.length,
      schemaFieldCount: Object.keys(request.outputSchema ?? {}).length,
      options: request.options
    });

    try {
      validateParseRequest(request, validationConfig);
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
      return await this.captureFailure(
        createFailureResponse({
          error: parseError,
          plan: this.plan ?? createEmptyPlan(request, validationConfig),
          requestId,
          diagnostics,
          stageBreakdown
        }),
        request
      );
    }

    const seedInput = overrides.seedInput ?? this.defaultSeedInput ?? request.inputData;
    const planFailure = await this.ensurePlan({
      request,
      requestId,
      seedInput,
      reason: 'ensure'
    });

    if (planFailure) {
      if (hasPreprocessStage) {
        planFailure.metadata.stageBreakdown.preprocess = preprocessMetrics;
      }
      if (preprocessDiagnostics.length) {
        planFailure.metadata.diagnostics = [
          ...preprocessDiagnostics,
          ...planFailure.metadata.diagnostics
        ];
      }
      return await this.captureFailure(planFailure, request);
    }

    const runtimeConfig = this.getConfig();
    const plan = this.plan!;
    const planOrigin = plan.metadata.origin;
    const shouldChargePlan = this.parseCount === 0 && planOrigin !== 'cached';
    const architectTokensForCall = shouldChargePlan ? this.planTokens : 0;
    const architectTimeForCall = shouldChargePlan ? this.planProcessingTime : 0;
    const extractorResult = await this.deps.extractor.execute({
      inputData: request.inputData,
      plan,
      config: runtimeConfig
    });

    const combinedDiagnostics = [
      ...preprocessDiagnostics,
      ...this.planDiagnostics,
      ...extractorResult.diagnostics
    ];

    this.telemetry.emit({
      type: 'parse:stage',
      source: 'session',
      requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      sessionId: this.id,
      stage: 'extractor',
      metrics: {
        timeMs: extractorResult.processingTimeMs,
        tokens: extractorResult.tokensUsed,
        confidence: extractorResult.confidence
      },
      diagnostics: extractorResult.diagnostics
    });

    if (!extractorResult.success || !extractorResult.parsedData) {
      const totalTokens = architectTokensForCall + extractorResult.tokensUsed;
      this.totalExtractorTokens += extractorResult.tokensUsed;
      const stageBreakdown: ParseMetadata['stageBreakdown'] = {
        architect: {
          timeMs: architectTimeForCall,
          tokens: architectTokensForCall,
          confidence: this.planConfidence
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
      return await this.captureFailure(
        createFailureResponse({
          error:
            extractorResult.error ?? {
              code: 'EXTRACTOR_FAILED',
              message: 'Extractor failed to resolve required fields',
              stage: 'extractor'
            },
          plan: clonePlan(plan, shouldChargePlan ? planOrigin : 'cached'),
          requestId,
          diagnostics: combinedDiagnostics,
          tokensUsed: totalTokens,
          processingTimeMs: Date.now() - startTime,
          architectTokens: architectTokensForCall,
          extractorTokens: extractorResult.tokensUsed,
          stageBreakdown,
          fallbacks: extractorResult.fallbackUsage
        }),
        request
      );
    }

    const planConfidence = this.planConfidence;
    const baseConfidence = clamp(planConfidence * 0.35 + extractorResult.confidence * 0.65, 0, 1);
    const totalTokens = architectTokensForCall + extractorResult.tokensUsed;

    let metadata: ParseMetadata = {
      architectPlan: clonePlan(plan, shouldChargePlan ? planOrigin : 'cached'),
      confidence: baseConfidence,
      tokensUsed: totalTokens,
      processingTimeMs: Date.now() - startTime,
      architectTokens: architectTokensForCall,
      extractorTokens: extractorResult.tokensUsed,
      requestId,
      timestamp: new Date().toISOString(),
      diagnostics: combinedDiagnostics,
      stageBreakdown: {
        architect: {
          timeMs: architectTimeForCall,
          tokens: architectTokensForCall,
          confidence: planConfidence
        },
        extractor: {
          timeMs: extractorResult.processingTimeMs,
          tokens: extractorResult.tokensUsed,
          confidence: extractorResult.confidence
        }
      },
      fallbacks: extractorResult.fallbackUsage
    };
    if (hasPreprocessStage) {
      metadata.stageBreakdown.preprocess = preprocessMetrics;
    }

    const postprocessOutcome = await this.executePostprocessorsForResponse({
      request,
      requestId,
      config: runtimeConfig,
      parsedData: extractorResult.parsedData,
      metadata
    });
    const postprocessMetrics = postprocessOutcome.metrics;
    const postprocessDiagnostics = postprocessOutcome.diagnostics;
    const hasPostprocessStage =
      (postprocessMetrics.runs ?? 0) > 0 || postprocessDiagnostics.length > 0;

    metadata = postprocessOutcome.metadata;
    if (!metadata.fallbacks && extractorResult.fallbackUsage) {
      metadata.fallbacks = extractorResult.fallbackUsage;
    }
    if (hasPreprocessStage && !metadata.stageBreakdown.preprocess) {
      metadata.stageBreakdown.preprocess = preprocessMetrics;
    }
    if (hasPostprocessStage) {
      metadata.stageBreakdown.postprocess = postprocessMetrics;
    }

    const finalParsedData = postprocessOutcome.parsedData;
    const threshold = request.options?.confidenceThreshold ?? runtimeConfig.minConfidence;

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

      if (!runtimeConfig.enableFieldFallbacks) {
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

    this.totalExtractorTokens += extractorResult.tokensUsed;
    this.totalArchitectTokens += architectTokensForCall;
    this.parseCount += 1;
    this.lastResponse = response;
    this.lastDiagnostics = metadata.diagnostics;
    this.lastConfidence = metadata.confidence;
    this.lastRequestId = requestId;

    this.telemetry.emit({
      type: 'parse:success',
      source: 'session',
      requestId,
      timestamp: response.metadata.timestamp,
      profile: this.profileName,
      sessionId: this.id,
      metadata: response.metadata
    });

    if (error) {
      await this.runFailureInterceptors({
        request,
        requestId,
        profile: this.profileName,
        source: 'session',
        sessionId: this.id,
        plan: response.metadata.architectPlan,
        response,
        error
      });
    } else {
      await this.runAfterInterceptors({
        request,
        requestId,
        profile: this.profileName,
        source: 'session',
        sessionId: this.id,
        plan: response.metadata.architectPlan,
        response
      });
    }

    await this.handleAutoRefreshPostParse({
      request,
      response,
      confidence: metadata.confidence,
      threshold,
      overrides
    });

    return response;
  }

  snapshot(): ParseratorSessionSnapshot {
    const planState = this.getPlanState();
    return {
      id: this.id,
      createdAt: this.createdAt,
      planReady: planState.ready,
      planVersion: planState.version,
      planStrategy: planState.strategy,
      planUpdatedAt: planState.updatedAt,
      planSeedInput: planState.seedInput,
      planConfidence: planState.confidence,
      planDiagnostics: [...planState.diagnostics],
      parseCount: this.parseCount,
      tokensUsed: {
        architect: this.totalArchitectTokens,
        extractor: this.totalExtractorTokens,
        total: this.totalArchitectTokens + this.totalExtractorTokens
      },
      lastRequestId: this.lastRequestId,
      lastConfidence: this.lastConfidence,
      lastDiagnostics: [...this.lastDiagnostics],
      autoRefresh: this.getAutoRefreshState()
    };
  }

  exportInit(overrides: Partial<ParseratorSessionInit> = {}): ParseratorSessionInit {
    const baseOptions = this.deps.init.options;
    const overrideOptions = overrides.options;
    const mergedOptions =
      baseOptions && overrideOptions
        ? ({ ...baseOptions, ...overrideOptions } as ParseOptions)
        : overrideOptions ?? baseOptions;

    return {
      outputSchema: overrides.outputSchema ?? this.deps.init.outputSchema,
      instructions: overrides.instructions ?? this.deps.init.instructions,
      options: mergedOptions,
      seedInput: overrides.seedInput ?? this.defaultSeedInput,
      plan: overrides.plan ?? (this.plan ? clonePlan(this.plan, 'cached') : undefined),
      planConfidence: overrides.planConfidence ?? this.planConfidence,
      planDiagnostics: overrides.planDiagnostics ?? [...this.planDiagnostics],
      sessionId: overrides.sessionId ?? this.id,
      autoRefresh:
        overrides.autoRefresh ??
        (this.autoRefreshConfig ? { ...this.autoRefreshConfig } : undefined)
    };
  }

  private getInterceptors(): ParseratorInterceptor[] {
    try {
      return this.deps.interceptors?.() ?? [];
    } catch (error) {
      this.deps.logger.warn?.('parserator-core:session-interceptor-resolution-failed', {
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  private getPreprocessors(): ParseratorPreprocessor[] {
    try {
      return this.deps.preprocessors?.() ?? [];
    } catch (error) {
      this.deps.logger.warn?.('parserator-core:session-preprocessor-resolution-failed', {
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  private getPostprocessors(): ParseratorPostprocessor[] {
    try {
      return this.deps.postprocessors?.() ?? [];
    } catch (error) {
      this.deps.logger.warn?.('parserator-core:session-postprocessor-resolution-failed', {
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  private resolvePlanCacheKey(
    basis?: Pick<ParseratorSessionInit, 'outputSchema' | 'instructions' | 'options'>
  ): string | undefined {
    if (!this.planCache) {
      return undefined;
    }

    const reference = basis ?? this.deps.init;

    try {
      return createPlanCacheKey({
        outputSchema: reference.outputSchema,
        instructions: reference.instructions,
        options: reference.options,
        profile: this.profileName
      });
    } catch (error) {
      this.deps.logger.warn?.('parserator-core:session-plan-cache-key-failed', {
        error: error instanceof Error ? error.message : error,
        sessionId: this.id
      });
      return undefined;
    }
  }

  private emitPlanCacheEvent(event: {
    action: ParseratorPlanCacheEvent['action'];
    requestId?: string;
    reason: string;
    key?: string;
    scope?: string;
    planId?: string;
    confidence?: number;
    tokensUsed?: number;
    processingTimeMs?: number;
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
      source: 'session',
      requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      sessionId: this.id,
      action: event.action,
      key: event.key ?? this.planCacheKey,
      scope: event.scope,
      planId: event.planId ?? this.plan?.id,
      confidence: event.confidence,
      tokensUsed: event.tokensUsed,
      processingTimeMs: event.processingTimeMs,
      reason: event.reason,
      error: errorMessage
    });
  }

  private queuePlanCachePersist(reason: string, context: { requestId?: string } = {}): void {
    if (!this.planCache || !this.planCacheKey || !this.plan) {
      return;
    }

    const entry = {
      plan: clonePlan(this.plan, this.plan.metadata.origin),
      confidence: this.planConfidence,
      diagnostics: [...this.planDiagnostics],
      tokensUsed: this.planTokens,
      processingTimeMs: this.planProcessingTime,
      updatedAt: this.planUpdatedAt ?? new Date().toISOString(),
      profile: this.profileName
    };

    Promise.resolve(this.planCache.set(this.planCacheKey, entry))
      .then(() => {
        this.emitPlanCacheEvent({
          action: 'store',
          requestId: context.requestId,
          reason,
          key: this.planCacheKey!,
          planId: entry.plan.id,
          confidence: entry.confidence,
          tokensUsed: entry.tokensUsed,
          processingTimeMs: entry.processingTimeMs
        });
      })
      .catch(error => {
        this.deps.logger.warn?.('parserator-core:session-plan-cache-set-failed', {
          error: error instanceof Error ? error.message : error,
          sessionId: this.id,
          reason
        });
        this.emitPlanCacheEvent({
          action: 'store',
          requestId: context.requestId,
          reason,
          key: this.planCacheKey!,
          planId: entry.plan.id,
          error
        });
      });
  }

  private async runBeforeInterceptors(context: ParseratorInterceptorContext): Promise<void> {
    for (const interceptor of this.getInterceptors()) {
      if (!interceptor.beforeParse) {
        continue;
      }
      try {
        await interceptor.beforeParse(context);
      } catch (error) {
        this.deps.logger.warn?.('parserator-core:session-interceptor-before-error', {
          error: error instanceof Error ? error.message : error,
          requestId: context.requestId,
          sessionId: this.id
        });
      }
    }
  }

  private async executePreprocessorsForRequest(params: {
    request: ParseRequest;
    requestId: string;
    config: ParseratorCoreConfig;
  }): Promise<{ request: ParseRequest; diagnostics: ParseDiagnostic[]; metrics: StageMetrics }>
  {
    const preprocessors = this.getPreprocessors();
    const result = await executePreprocessors(preprocessors, {
      request: params.request,
      config: params.config,
      profile: this.profileName,
      logger: this.deps.logger,
      shared: new Map()
    });

    if ((result.metrics.runs ?? 0) > 0 || result.diagnostics.length) {
      this.telemetry.emit({
        type: 'parse:stage',
        source: 'session',
        requestId: params.requestId,
        timestamp: new Date().toISOString(),
        profile: this.profileName,
        sessionId: this.id,
        stage: 'preprocess',
        metrics: result.metrics,
        diagnostics: result.diagnostics
      });
    }

    return result;
  }

  private async executePostprocessorsForResponse(params: {
    request: ParseRequest;
    requestId: string;
    config: ParseratorCoreConfig;
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
      config: params.config,
      profile: this.profileName,
      logger: this.deps.logger,
      shared: new Map()
    });

    if ((result.metrics.runs ?? 0) > 0 || result.diagnostics.length) {
      this.telemetry.emit({
        type: 'parse:stage',
        source: 'session',
        requestId: params.requestId,
        timestamp: new Date().toISOString(),
        profile: this.profileName,
        sessionId: this.id,
        stage: 'postprocess',
        metrics: result.metrics,
        diagnostics: result.diagnostics
      });
    }

    return result;
  }

  private async runAfterInterceptors(context: ParseratorInterceptorSuccessContext): Promise<void> {
    for (const interceptor of this.getInterceptors()) {
      if (!interceptor.afterParse) {
        continue;
      }
      try {
        await interceptor.afterParse(context);
      } catch (error) {
        this.deps.logger.warn?.('parserator-core:session-interceptor-after-error', {
          error: error instanceof Error ? error.message : error,
          requestId: context.requestId,
          sessionId: this.id
        });
      }
    }
  }

  private async runFailureInterceptors(context: ParseratorInterceptorFailureContext): Promise<void> {
    for (const interceptor of this.getInterceptors()) {
      if (!interceptor.onFailure) {
        continue;
      }
      try {
        await interceptor.onFailure(context);
      } catch (error) {
        this.deps.logger.warn?.('parserator-core:session-interceptor-failure-error', {
          error: error instanceof Error ? error.message : error,
          requestId: context.requestId,
          sessionId: this.id
        });
      }
    }
  }

  private async handleAutoRefreshPostParse(params: {
    request: ParseRequest;
    response: ParseResponse;
    confidence: number;
    threshold: number;
    overrides: SessionParseOverrides;
  }): Promise<void> {
    if (!this.autoRefresh || !this.plan) {
      return;
    }

    this.parsesSinceRefresh += 1;

    let trigger: ParseratorAutoRefreshReason | undefined;

    if (this.autoRefresh.minConfidence !== undefined) {
      if (params.confidence < this.autoRefresh.minConfidence) {
        this.lowConfidenceRuns += 1;
      } else {
        this.lowConfidenceRuns = 0;
      }

      if (
        params.confidence < this.autoRefresh.minConfidence &&
        this.lowConfidenceRuns > this.autoRefresh.lowConfidenceGrace
      ) {
        trigger = 'confidence';
      }
    } else {
      this.lowConfidenceRuns = 0;
    }

    if (
      !trigger &&
      this.autoRefresh.maxParses !== undefined &&
      this.parsesSinceRefresh >= this.autoRefresh.maxParses
    ) {
      trigger = 'usage';
    }

    if (!trigger) {
      return;
    }

    await this.triggerAutoRefresh({
      reason: trigger,
      request: params.request,
      overrides: params.overrides,
      response: params.response,
      confidence: params.confidence,
      threshold: params.threshold
    });
  }

  getAutoRefreshState(): ParseratorAutoRefreshState | undefined {
    if (!this.autoRefresh) {
      return undefined;
    }

    const now = Date.now();

    return {
      config: this.getAutoRefreshConfigSnapshot(),
      parsesSinceRefresh: this.parsesSinceRefresh,
      lowConfidenceRuns: this.lowConfidenceRuns,
      lastTriggeredAt: this.lastAutoRefreshAt
        ? new Date(this.lastAutoRefreshAt).toISOString()
        : undefined,
      lastAttemptAt: this.lastAutoRefreshAttemptAt
        ? new Date(this.lastAutoRefreshAttemptAt).toISOString()
        : undefined,
      lastReason: this.lastAutoRefreshReason,
      coolingDown: this.isAutoRefreshCoolingDown(now),
      pending: this.autoRefreshPending
    };
  }

  private getConfig(): ParseratorCoreConfig {
    return this.deps.config();
  }

  private getAutoRefreshConfigSnapshot(): ParseratorPlanAutoRefreshConfig {
    const config: ParseratorPlanAutoRefreshConfig = {
      ...(this.autoRefreshConfig ?? {})
    };

    if (this.autoRefresh?.minConfidence !== undefined) {
      config.minConfidence = this.autoRefresh.minConfidence;
    }

    if (this.autoRefresh?.maxParses !== undefined) {
      config.maxParses = this.autoRefresh.maxParses;
    }

    if (this.autoRefresh?.minIntervalMs !== undefined) {
      config.minIntervalMs = this.autoRefresh.minIntervalMs;
    }

    config.lowConfidenceGrace =
      this.autoRefresh?.lowConfidenceGrace ?? config.lowConfidenceGrace;

    return config;
  }

  private isAutoRefreshCoolingDown(now: number = Date.now()): boolean {
    if (!this.autoRefresh?.minIntervalMs || !this.lastAutoRefreshAt) {
      return false;
    }

    return now - this.lastAutoRefreshAt < this.autoRefresh.minIntervalMs;
  }

  private async triggerAutoRefresh(params: {
    reason: ParseratorAutoRefreshReason;
    request: ParseRequest;
    overrides: SessionParseOverrides;
    response: ParseResponse;
    confidence: number;
    threshold: number;
  }): Promise<void> {
    if (!this.autoRefresh || this.autoRefreshPending) {
      return;
    }

    if (this.isAutoRefreshCoolingDown()) {
      this.deps.logger.info?.('parserator-core:session-auto-refresh-skipped', {
        sessionId: this.id,
        reason: params.reason,
        cooldownMs: this.autoRefresh.minIntervalMs,
        lastTriggeredAt: this.lastAutoRefreshAt
          ? new Date(this.lastAutoRefreshAt).toISOString()
          : undefined
      });
      return;
    }

    const seedInput =
      params.reason === 'usage'
        ? this.defaultSeedInput ?? this.lastSeedInput ?? params.request.inputData
        : params.overrides.seedInput ?? params.request.inputData;

    this.autoRefreshPending = true;
    this.lastAutoRefreshAttemptAt = Date.now();

    try {
      this.deps.logger.info?.('parserator-core:session-auto-refresh-triggered', {
        sessionId: this.id,
        reason: params.reason,
        confidence: params.confidence,
        threshold: params.threshold,
        minConfidence: this.autoRefresh.minConfidence,
        parsesSinceRefresh: this.parsesSinceRefresh,
        maxParses: this.autoRefresh.maxParses,
        seedProvided: Boolean(seedInput)
      });

      const result = await this.refreshPlan({
        force: true,
        seedInput,
        instructions: params.request.instructions ?? this.deps.init.instructions,
        options: params.request.options,
        includePlan: false
      });

      if (!result.success) {
        this.deps.logger.warn?.('parserator-core:session-auto-refresh-failed', {
          sessionId: this.id,
          reason: params.reason,
          error: result.failure?.error?.message ?? 'unknown',
          requestId: params.response.metadata.requestId
        });
        return;
      }

      if (!result.skipped) {
        this.lastAutoRefreshAt = Date.now();
        this.lastAutoRefreshReason = params.reason;
      }
    } catch (error) {
      this.deps.logger.warn?.('parserator-core:session-auto-refresh-error', {
        sessionId: this.id,
        reason: params.reason,
        error: error instanceof Error ? error.message : error
      });
    } finally {
      this.autoRefreshPending = false;
    }
  }

  private resetAutoRefreshState(): void {
    this.parsesSinceRefresh = 0;
    this.lowConfidenceRuns = 0;
  }

  private normaliseAutoRefresh(
    config?: ParseratorPlanAutoRefreshConfig
  ): NormalizedAutoRefreshConfig | undefined {
    if (!config) {
      return undefined;
    }

    const minConfidence =
      typeof config.minConfidence === 'number'
        ? clamp(config.minConfidence, 0, 1)
        : undefined;
    const maxParses =
      typeof config.maxParses === 'number' && config.maxParses > 0
        ? Math.floor(config.maxParses)
        : undefined;
    const minIntervalMs =
      typeof config.minIntervalMs === 'number' && config.minIntervalMs > 0
        ? config.minIntervalMs
        : undefined;
    const lowConfidenceGrace =
      typeof config.lowConfidenceGrace === 'number' && config.lowConfidenceGrace > 0
        ? Math.floor(config.lowConfidenceGrace)
        : 0;

    const normalized: NormalizedAutoRefreshConfig = {
      minConfidence,
      maxParses,
      minIntervalMs,
      lowConfidenceGrace
    };

    if (normalized.minConfidence === undefined && normalized.maxParses === undefined) {
      normalized.minConfidence = clamp(this.getConfig().minConfidence, 0, 1);
    }

    return normalized;
  }

  private async ensurePlan(params: {
    request: ParseRequest;
    requestId: string;
    seedInput: string;
    reason: 'ensure' | 'refresh';
  }): Promise<ParseResponse | undefined> {
    if (this.plan && params.reason === 'ensure') {
      return undefined;
    }

    const seedInput = params.seedInput ?? params.request.inputData;
    const config = this.getConfig();
    const planRequest: ParseRequest = {
      inputData: seedInput,
      outputSchema: this.deps.init.outputSchema,
      instructions: params.request.instructions ?? this.deps.init.instructions,
      options: params.request.options
    };

    this.planCacheKey = this.resolvePlanCacheKey({
      outputSchema: planRequest.outputSchema,
      instructions: planRequest.instructions,
      options: planRequest.options
    });

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

    if (params.reason === 'ensure' && this.planCache && this.planCacheKey) {
      try {
        const cached = await this.planCache.get(this.planCacheKey);
        if (cached?.plan) {
          this.emitPlanCacheEvent({
            action: 'hit',
            requestId: params.requestId,
            reason: params.reason,
            key: this.planCacheKey,
            planId: cached.plan.id,
            confidence: cached.confidence,
            tokensUsed: cached.tokensUsed,
            processingTimeMs: cached.processingTimeMs
          });
          this.plan = clonePlan(cached.plan, 'cached');
          this.planDiagnostics = [...cached.diagnostics];
          this.planConfidence = clamp(cached.confidence ?? this.planConfidence, 0, 1);
          this.planTokens = cached.tokensUsed;
          this.planProcessingTime = cached.processingTimeMs;
          this.planUpdatedAt = new Date().toISOString();
          this.lastSeedInput = planRequest.inputData;
          if (!this.defaultSeedInput) {
            this.defaultSeedInput = planRequest.inputData;
          }
          this.resetAutoRefreshState();

          this.telemetry.emit({
            type: 'plan:ready',
            source: 'session',
            requestId: params.requestId,
            timestamp: new Date().toISOString(),
            profile: this.profileName,
            sessionId: this.id,
            plan: clonePlan(this.plan!),
            diagnostics: [...this.planDiagnostics],
            tokensUsed: this.planTokens,
            processingTimeMs: this.planProcessingTime,
            confidence: this.planConfidence
          });

          this.deps.logger.info?.('parserator-core:session-plan-cache-hit', {
            sessionId: this.id,
            planId: this.plan.id,
            strategy: this.plan.strategy
          });

          this.queuePlanCachePersist('reuse', { requestId: params.requestId });

          return undefined;
        }
        this.emitPlanCacheEvent({
          action: 'miss',
          requestId: params.requestId,
          reason: params.reason,
          key: this.planCacheKey
        });
      } catch (error) {
        this.deps.logger.warn?.('parserator-core:session-plan-cache-get-failed', {
          error: error instanceof Error ? error.message : error,
          sessionId: this.id
        });
        this.emitPlanCacheEvent({
          action: 'miss',
          requestId: params.requestId,
          reason: params.reason,
          key: this.planCacheKey,
          error
        });
      }
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

    this.telemetry.emit({
      type: 'parse:stage',
      source: 'session',
      requestId: params.requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      sessionId: this.id,
      stage: 'architect',
      metrics: {
        timeMs: architectResult.processingTimeMs,
        tokens: architectResult.tokensUsed,
        confidence: architectResult.confidence
      },
      diagnostics: architectResult.diagnostics
    });

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
      this.planProcessingTime = architectResult.processingTimeMs;

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
        architectTokens: architectResult.tokensUsed,
        stageBreakdown: {
          architect: {
            timeMs: architectResult.processingTimeMs,
            tokens: architectResult.tokensUsed,
            confidence: architectResult.confidence ?? 0
          },
          extractor: { timeMs: 0, tokens: 0, confidence: 0 }
        }
      });
    }

    this.planConfidence = clamp(architectResult.confidence ?? this.planConfidence, 0, 1);
    this.planTokens = architectResult.tokensUsed;
    this.planProcessingTime = architectResult.processingTimeMs;
    this.plan = clonePlan(architectResult.searchPlan);
    this.planUpdatedAt = new Date().toISOString();
    this.lastSeedInput = planRequest.inputData;
    if (!this.defaultSeedInput) {
      this.defaultSeedInput = planRequest.inputData;
    }
    this.resetAutoRefreshState();
    this.deps.logger.info?.('parserator-core:session-plan-created', {
      sessionId: this.id,
      planId: this.plan.id,
      strategy: this.plan.strategy,
      reason: params.reason
    });

    this.telemetry.emit({
      type: 'plan:ready',
      source: 'session',
      requestId: params.requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      sessionId: this.id,
      plan: clonePlan(this.plan!),
      diagnostics: [...this.planDiagnostics],
      tokensUsed: this.planTokens,
      processingTimeMs: this.planProcessingTime,
      confidence: this.planConfidence
    });

    this.queuePlanCachePersist(params.reason, { requestId: params.requestId });

    return undefined;
  }

  getPlanState(options: { includePlan?: boolean } = {}): ParseratorPlanState {
    const includePlan = options.includePlan ?? false;
    return {
      ready: Boolean(this.plan),
      plan: includePlan && this.plan ? clonePlan(this.plan, this.plan.metadata.origin) : undefined,
      version: this.plan?.version,
      strategy: this.plan?.strategy,
      confidence: this.plan ? this.planConfidence : 0,
      diagnostics: [...this.planDiagnostics],
      tokensUsed: this.plan ? this.planTokens : 0,
      processingTimeMs: this.plan ? this.planProcessingTime : 0,
      origin: this.plan?.metadata.origin,
      updatedAt: this.planUpdatedAt,
      seedInput: this.lastSeedInput
    };
  }

  async refreshPlan(options: RefreshPlanOptions = {}): Promise<ParseratorPlanRefreshResult> {
    if (
      this.plan &&
      !options.force &&
      options.seedInput === undefined &&
      options.instructions === undefined &&
      options.options === undefined
    ) {
      return {
        success: true,
        skipped: true,
        state: this.getPlanState({ includePlan: options.includePlan })
      };
    }

    const seedInput =
      options.seedInput ?? this.lastSeedInput ?? this.defaultSeedInput;

    if (!seedInput) {
      throw new Error(
        'ParseratorSession.refreshPlan requires a seedInput when no previous calibration sample is available'
      );
    }

    const requestId = uuidv4();
    const baseOptions = this.deps.init.options ?? {};
    const overrideOptions = options.options ?? {};
    const mergedOptions: ParseOptions = { ...baseOptions, ...overrideOptions } as ParseOptions;
    const planOptions = Object.keys(mergedOptions).length ? mergedOptions : undefined;
    const instructions = options.instructions ?? this.deps.init.instructions;

    const planRequest: ParseRequest = {
      inputData: seedInput,
      outputSchema: this.deps.init.outputSchema,
      instructions,
      options: planOptions
    };

    const previousPlan = this.plan ? clonePlan(this.plan, this.plan.metadata.origin) : undefined;
    const previousDiagnostics = [...this.planDiagnostics];
    const previousConfidence = this.planConfidence;
    const previousTokens = this.planTokens;
    const previousProcessing = this.planProcessingTime;
    const previousUpdatedAt = this.planUpdatedAt;
    const previousSeed = this.lastSeedInput;
    const previousInstructions = this.deps.init.instructions;
    const previousOptions = this.deps.init.options;
    const previousDefaultSeed = this.defaultSeedInput;

    const failure = await this.ensurePlan({
      request: planRequest,
      requestId,
      seedInput,
      reason: 'refresh'
    });

    if (failure) {
      this.plan = previousPlan ? clonePlan(previousPlan, previousPlan.metadata.origin) : undefined;
      this.planDiagnostics = previousDiagnostics;
      this.planConfidence = previousConfidence;
      this.planTokens = previousTokens;
      this.planProcessingTime = previousProcessing;
      this.planUpdatedAt = previousUpdatedAt;
      this.lastSeedInput = previousSeed;
      this.deps.init.instructions = previousInstructions;
      this.deps.init.options = previousOptions;
      this.defaultSeedInput = previousDefaultSeed;
      this.planCacheKey = this.resolvePlanCacheKey({
        outputSchema: this.deps.init.outputSchema,
        instructions: this.deps.init.instructions,
        options: this.deps.init.options
      });
      return {
        success: false,
        failure,
        state: this.getPlanState({ includePlan: options.includePlan })
      };
    }

    this.deps.init.instructions = instructions;
    this.deps.init.options = planOptions;
    this.defaultSeedInput = seedInput;
    this.lastSeedInput = seedInput;
    this.planCacheKey = this.resolvePlanCacheKey({
      outputSchema: this.deps.init.outputSchema,
      instructions: this.deps.init.instructions,
      options: this.deps.init.options
    });

    this.deps.logger.info?.('parserator-core:session-plan-refreshed', {
      sessionId: this.id,
      planId: this.plan?.id,
      strategy: this.plan?.strategy,
      tokensUsed: this.planTokens,
      diagnostics: this.planDiagnostics.length
    });

    return {
      success: true,
      state: this.getPlanState({ includePlan: options.includePlan })
    };
  }

  private async captureFailure(response: ParseResponse, request: ParseRequest): Promise<ParseResponse> {
    this.lastResponse = response;
    this.lastDiagnostics = response.metadata.diagnostics;
    this.lastConfidence = response.metadata.confidence;
    this.lastRequestId = response.metadata.requestId;

    const error =
      response.error ?? ({
        code: 'UNKNOWN_FAILURE',
        message: 'Unknown parse failure',
        stage: 'orchestration'
      } as ParseError);

    this.telemetry.emit({
      type: 'parse:failure',
      source: 'session',
      requestId: response.metadata.requestId,
      timestamp: new Date().toISOString(),
      profile: this.profileName,
      sessionId: this.id,
      stage: error.stage,
      error,
      diagnostics: response.metadata.diagnostics,
      metadata: response.metadata
    });

    await this.runFailureInterceptors({
      request,
      requestId: response.metadata.requestId,
      profile: this.profileName,
      source: 'session',
      sessionId: this.id,
      plan: response.metadata.architectPlan,
      response,
      error
    });

    return response;
  }
}
