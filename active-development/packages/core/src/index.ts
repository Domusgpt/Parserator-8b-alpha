import { v4 as uuidv4 } from 'uuid';

import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultLogger } from './logger';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import { listParseratorProfiles, resolveProfile } from './profiles';
import { ParseratorSession } from './session';
import { createTelemetryHub, TelemetryHub } from './telemetry';
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
  ParseratorProfileOption,
  ParseratorSessionInit,
  ParseratorSessionSnapshot,
  ParseratorTelemetry,
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
export * from './profiles';
export { ParseratorSession } from './session';

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

  constructor(options: ParseratorCoreOptions) {
    if (!options?.apiKey || options.apiKey.trim().length === 0) {
      throw new Error('ParseratorCore requires a non-empty apiKey');
    }

    this.apiKey = options.apiKey;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.telemetry = createTelemetryHub(options.telemetry, this.logger);

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

  createSession(init: ParseratorSessionInit): ParseratorSession {
    return new ParseratorSession({
      architect: this.architect,
      extractor: this.extractor,
      config: () => this.config,
      logger: this.logger,
      telemetry: this.telemetry,
      profile: this.profileName,
      init
    });
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
      const response = createFailureResponse({
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
        ],
        stageBreakdown: {
          architect: { timeMs: 0, tokens: 0, confidence: 0 },
          extractor: { timeMs: 0, tokens: 0, confidence: 0 }
        }
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
      return response;
    }

    const architectResult = await this.architect.createPlan({
      inputData: request.inputData,
      outputSchema: request.outputSchema,
      instructions: request.instructions,
      options: request.options,
      config: this.config
    });

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
      diagnostics: [...architectResult.diagnostics, ...extractorResult.diagnostics],
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

    const response: ParseResponse = {
      success: !error,
      parsedData: extractorResult.parsedData,
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
    } else {
      this.telemetry.emit({
        type: 'parse:success',
        source: 'core',
        requestId,
        timestamp: metadata.timestamp,
        profile: this.profileName,
        metadata
      });
    }

    return response;
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
      stageBreakdown: {
        architect: {
          timeMs: architectResult.processingTimeMs,
          tokens: architectResult.tokensUsed,
          confidence: architectResult.confidence ?? 0
        },
        extractor: { timeMs: 0, tokens: 0, confidence: 0 }
      }
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

    return response;
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
  createTelemetryHub,
  TelemetryHub
};
