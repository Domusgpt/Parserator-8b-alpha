"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryHub = exports.createTelemetryHub = exports.createInMemoryPlanCache = exports.createDefaultResolvers = exports.ResolverRegistry = exports.LeanLLMResolver = exports.RegexExtractor = exports.HeuristicArchitect = exports.ParseratorCore = exports.createDefaultPostprocessors = exports.createDefaultPreprocessors = exports.ParseratorSession = void 0;
const uuid_1 = require("uuid");
const architect_1 = require("./architect");
Object.defineProperty(exports, "HeuristicArchitect", { enumerable: true, get: function () { return architect_1.HeuristicArchitect; } });
const extractor_1 = require("./extractor");
Object.defineProperty(exports, "RegexExtractor", { enumerable: true, get: function () { return extractor_1.RegexExtractor; } });
const logger_1 = require("./logger");
const resolvers_1 = require("./resolvers");
Object.defineProperty(exports, "createDefaultResolvers", { enumerable: true, get: function () { return resolvers_1.createDefaultResolvers; } });
Object.defineProperty(exports, "LeanLLMResolver", { enumerable: true, get: function () { return resolvers_1.LeanLLMResolver; } });
Object.defineProperty(exports, "ResolverRegistry", { enumerable: true, get: function () { return resolvers_1.ResolverRegistry; } });
const profiles_1 = require("./profiles");
const session_1 = require("./session");
const telemetry_1 = require("./telemetry");
Object.defineProperty(exports, "createTelemetryHub", { enumerable: true, get: function () { return telemetry_1.createTelemetryHub; } });
Object.defineProperty(exports, "TelemetryHub", { enumerable: true, get: function () { return telemetry_1.TelemetryHub; } });
const cache_1 = require("./cache");
Object.defineProperty(exports, "createInMemoryPlanCache", { enumerable: true, get: function () { return cache_1.createInMemoryPlanCache; } });
const preprocessors_1 = require("./preprocessors");
const postprocessors_1 = require("./postprocessors");
const utils_1 = require("./utils");
__exportStar(require("./types"), exports);
__exportStar(require("./profiles"), exports);
var session_2 = require("./session");
Object.defineProperty(exports, "ParseratorSession", { enumerable: true, get: function () { return session_2.ParseratorSession; } });
var preprocessors_2 = require("./preprocessors");
Object.defineProperty(exports, "createDefaultPreprocessors", { enumerable: true, get: function () { return preprocessors_2.createDefaultPreprocessors; } });
var postprocessors_2 = require("./postprocessors");
Object.defineProperty(exports, "createDefaultPostprocessors", { enumerable: true, get: function () { return postprocessors_2.createDefaultPostprocessors; } });
const DEFAULT_CONFIG = {
    maxInputLength: 120000,
    maxSchemaFields: 64,
    minConfidence: 0.55,
    defaultStrategy: 'sequential',
    enableFieldFallbacks: true
};
const DEFAULT_LOGGER = (0, logger_1.createDefaultLogger)();
class ParseratorCore {
    constructor(options) {
        this.profileOverrides = {};
        this.configOverrides = {};
        this.interceptors = new Set();
        this.preprocessors = [];
        this.postprocessors = [];
        if (!options?.apiKey || options.apiKey.trim().length === 0) {
            throw new Error('ParseratorCore requires a non-empty apiKey');
        }
        this.apiKey = options.apiKey;
        this.logger = options.logger ?? DEFAULT_LOGGER;
        this.telemetry = (0, telemetry_1.createTelemetryHub)(options.telemetry, this.logger);
        if (options.interceptors) {
            const interceptors = Array.isArray(options.interceptors)
                ? options.interceptors
                : [options.interceptors];
            interceptors.forEach(interceptor => this.use(interceptor));
        }
        this.planCache = options.planCache === null ? undefined : options.planCache ?? (0, cache_1.createInMemoryPlanCache)();
        const preprocessorInput = options.preprocessors === null
            ? []
            : options.preprocessors ?? (0, preprocessors_1.createDefaultPreprocessors)(this.logger);
        const preprocessors = Array.isArray(preprocessorInput)
            ? preprocessorInput
            : [preprocessorInput];
        preprocessors.forEach(preprocessor => this.usePreprocessor(preprocessor));
        const postprocessorInput = options.postprocessors === null
            ? []
            : options.postprocessors ?? (0, postprocessors_1.createDefaultPostprocessors)(this.logger);
        const postprocessors = Array.isArray(postprocessorInput)
            ? postprocessorInput
            : [postprocessorInput];
        postprocessors.forEach(postprocessor => this.usePostprocessor(postprocessor));
        const resolvedProfile = (0, profiles_1.resolveProfile)(options.profile ?? 'lean-agent', {
            logger: this.logger
        });
        if (resolvedProfile) {
            this.profileName = resolvedProfile.profile.name;
            this.profileOverrides = { ...(resolvedProfile.config ?? {}) };
        }
        this.configOverrides = { ...(options.config ?? {}) };
        this.config = this.composeConfig();
        const initialResolvers = options.resolvers ?? resolvedProfile?.resolvers ?? (0, resolvers_1.createDefaultResolvers)(this.logger);
        this.resolverRegistry = new resolvers_1.ResolverRegistry(initialResolvers, this.logger);
        if (options.llmFallback) {
            const { position, ...fallbackConfig } = options.llmFallback;
            const resolver = new resolvers_1.LeanLLMResolver({
                ...fallbackConfig,
                logger: this.logger
            });
            const placement = position ?? 'append';
            this.resolverRegistry.register(resolver, placement);
            this.logger.info?.('parserator-core:lean-llm-fallback-registered', {
                resolver: resolver.name,
                position: placement
            });
        }
        this.architect = options.architect ?? resolvedProfile?.architect ?? new architect_1.HeuristicArchitect(this.logger);
        const extractor = options.extractor ?? resolvedProfile?.extractor ?? new extractor_1.RegexExtractor(this.logger, this.resolverRegistry);
        this.attachRegistryIfSupported(extractor);
        this.extractor = extractor;
        this.logger.info?.('parserator-core:initialised', {
            profile: this.profileName,
            config: this.config
        });
    }
    updateConfig(partial) {
        this.configOverrides = { ...this.configOverrides, ...partial };
        this.config = this.composeConfig();
        this.logger.info?.('parserator-core:config-updated', { config: this.config });
    }
    getConfig() {
        return { ...this.config };
    }
    getProfile() {
        return this.profileName;
    }
    applyProfile(profile) {
        const resolvedProfile = (0, profiles_1.resolveProfile)(profile, { logger: this.logger });
        if (!resolvedProfile) {
            throw new Error(`Unknown Parserator profile: ${String(profile?.name ?? profile)}`);
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
        return (0, profiles_1.listParseratorProfiles)();
    }
    setArchitect(agent) {
        this.architect = agent;
    }
    setExtractor(agent) {
        this.attachRegistryIfSupported(agent);
        this.extractor = agent;
    }
    registerResolver(resolver, position = 'append') {
        this.resolverRegistry.register(resolver, position);
        this.logger.info?.('parserator-core:resolver-registered', {
            resolver: resolver.name,
            position
        });
    }
    replaceResolvers(resolvers) {
        this.resolverRegistry.replaceAll(resolvers);
        this.logger.info?.('parserator-core:resolvers-replaced', {
            resolvers: resolvers.map(resolver => resolver.name)
        });
    }
    listResolvers() {
        return this.resolverRegistry.listResolvers();
    }
    use(interceptor) {
        this.interceptors.add(interceptor);
        return () => this.interceptors.delete(interceptor);
    }
    listInterceptors() {
        return this.getInterceptors();
    }
    usePreprocessor(preprocessor) {
        this.preprocessors.push(preprocessor);
        return () => {
            const index = this.preprocessors.indexOf(preprocessor);
            if (index >= 0) {
                this.preprocessors.splice(index, 1);
            }
        };
    }
    listPreprocessors() {
        return this.getPreprocessors();
    }
    clearPreprocessors() {
        this.preprocessors.length = 0;
    }
    usePostprocessor(postprocessor) {
        this.postprocessors.push(postprocessor);
        return () => {
            const index = this.postprocessors.indexOf(postprocessor);
            if (index >= 0) {
                this.postprocessors.splice(index, 1);
            }
        };
    }
    listPostprocessors() {
        return this.getPostprocessors();
    }
    clearPostprocessors() {
        this.postprocessors.length = 0;
    }
    createSession(init) {
        const planCacheKey = this.planCache
            ? (0, utils_1.createPlanCacheKey)({
                outputSchema: init.outputSchema,
                instructions: init.instructions,
                options: init.options,
                profile: this.profileName
            })
            : undefined;
        return new session_1.ParseratorSession({
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
    createSessionFromResponse(options) {
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
        const mergedOptions = baseOptions && overrideOptions
            ? { ...baseOptions, ...overrideOptions }
            : overrideOptions ?? baseOptions;
        const sessionInit = {
            outputSchema: overrides.outputSchema ?? options.request.outputSchema,
            instructions: overrides.instructions ?? options.request.instructions ?? undefined,
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
    async getPlanCacheEntry(request) {
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
        }
        catch (error) {
            this.logger.warn?.('parserator-core:plan-cache-introspect-failed', {
                error: error instanceof Error ? error.message : error,
                profile: this.profileName,
                key: planCacheKey,
                operation: 'get'
            });
            return undefined;
        }
    }
    async deletePlanCacheEntry(request) {
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
        }
        catch (error) {
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
    async clearPlanCache(profile) {
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
        }
        catch (error) {
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
    composeConfig() {
        return {
            ...DEFAULT_CONFIG,
            ...this.profileOverrides,
            ...this.configOverrides
        };
    }
    async parse(request) {
        const requestId = (0, uuid_1.v4)();
        const startTime = Date.now();
        const preprocessOutcome = await this.runPreprocessors({ request, requestId });
        request = preprocessOutcome.request;
        const preprocessDiagnostics = preprocessOutcome.diagnostics;
        const preprocessMetrics = preprocessOutcome.metrics;
        const hasPreprocessStage = (preprocessMetrics.runs ?? 0) > 0 || preprocessDiagnostics.length > 0;
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
            (0, utils_1.validateParseRequest)(request, this.config);
        }
        catch (error) {
            const parseError = (0, utils_1.toParseError)(error, 'validation');
            const diagnostics = [
                ...preprocessDiagnostics,
                {
                    field: '*',
                    stage: 'validation',
                    message: parseError.message,
                    severity: 'error'
                }
            ];
            const stageBreakdown = {
                architect: { timeMs: 0, tokens: 0, confidence: 0 },
                extractor: { timeMs: 0, tokens: 0, confidence: 0 }
            };
            if (hasPreprocessStage) {
                stageBreakdown.preprocess = preprocessMetrics;
            }
            const response = (0, utils_1.createFailureResponse)({
                error: parseError,
                plan: (0, utils_1.createEmptyPlan)(request, this.config),
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
                error: response.error,
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
                error: response.error
            });
            return response;
        }
        const planCacheKey = this.getPlanCacheKey(request);
        let cachedEntry;
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
                }
                else {
                    this.emitPlanCacheEvent({
                        action: 'miss',
                        key: planCacheKey,
                        requestId,
                        reason: 'parse'
                    });
                }
            }
            catch (error) {
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
        let architectResult;
        let planTokens = 0;
        let planProcessingTime = 0;
        let planConfidence = this.config.minConfidence;
        let planDiagnostics = [];
        if (cachedEntry?.plan) {
            planTokens = cachedEntry.tokensUsed;
            planProcessingTime = cachedEntry.processingTimeMs;
            planConfidence = (0, utils_1.clamp)(cachedEntry.confidence ?? this.config.minConfidence, 0, 1);
            planDiagnostics = [...cachedEntry.diagnostics];
            architectResult = {
                success: true,
                searchPlan: (0, utils_1.clonePlan)(cachedEntry.plan, 'cached'),
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
        }
        else {
            architectResult = await this.architect.createPlan({
                inputData: request.inputData,
                outputSchema: request.outputSchema,
                instructions: request.instructions,
                options: request.options,
                config: this.config
            });
            planTokens = architectResult.tokensUsed;
            planProcessingTime = architectResult.processingTimeMs;
            planConfidence = (0, utils_1.clamp)(architectResult.confidence, 0, 1);
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
                const entry = {
                    plan: (0, utils_1.clonePlan)(architectResult.searchPlan, architectResult.searchPlan.metadata.origin),
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
                }
                catch (error) {
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
        const activePlan = architectResult.searchPlan;
        const extractorResult = await this.extractor.execute({
            inputData: request.inputData,
            plan: activePlan,
            config: this.config
        });
        const fallbackSummary = extractorResult.fallbackSummary;
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
        const baseConfidence = (0, utils_1.clamp)(architectResult.confidence * 0.35 + extractorResult.confidence * 0.65, 0, 1);
        let metadata = {
            architectPlan: (0, utils_1.clonePlan)(activePlan, activePlan.metadata.origin),
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
        if (fallbackSummary) {
            metadata = {
                ...metadata,
                fallback: fallbackSummary
            };
        }
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
        const hasPostprocessStage = (postprocessMetrics.runs ?? 0) > 0 || postprocessDiagnostics.length > 0;
        metadata = postprocessOutcome.metadata;
        if (hasPreprocessStage && !metadata.stageBreakdown.preprocess) {
            metadata.stageBreakdown.preprocess = preprocessMetrics;
        }
        if (hasPostprocessStage) {
            metadata.stageBreakdown.postprocess = postprocessMetrics;
        }
        if (fallbackSummary) {
            const mergedFallback = {
                ...fallbackSummary,
                ...(metadata.fallback ?? {})
            };
            if (mergedFallback.leanLLM === undefined && fallbackSummary.leanLLM) {
                mergedFallback.leanLLM = fallbackSummary.leanLLM;
            }
            metadata = {
                ...metadata,
                fallback: mergedFallback
            };
        }
        const finalParsedData = postprocessOutcome.parsedData;
        const threshold = request.options?.confidenceThreshold ?? this.config.minConfidence;
        let error;
        if (metadata.confidence < threshold) {
            const failingStage = metadata.confidence < baseConfidence ? 'postprocess' : 'extractor';
            const warning = {
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
        const response = {
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
        }
        else {
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
    async parseMany(requests, options = {}) {
        if (!Array.isArray(requests) || requests.length === 0) {
            return [];
        }
        const reusePlan = options.reusePlan ?? true;
        if (!reusePlan || requests.length === 1) {
            const responses = [];
            for (const request of requests) {
                responses.push(await this.parse(request));
            }
            return responses;
        }
        const [first, ...rest] = requests;
        const schemaKey = (0, utils_1.stableStringify)(first.outputSchema);
        const instructionsKey = first.instructions ?? '';
        for (const request of rest) {
            if ((0, utils_1.stableStringify)(request.outputSchema) !== schemaKey) {
                throw new Error('All batch requests must share the same outputSchema when reusePlan is enabled');
            }
            if ((request.instructions ?? '') !== instructionsKey) {
                throw new Error('All batch requests must share the same instructions when reusePlan is enabled');
            }
        }
        const session = this.createSession({
            outputSchema: first.outputSchema,
            instructions: first.instructions,
            options: first.options,
            seedInput: options.seedInput ?? first.inputData
        });
        const responses = [];
        for (const [index, request] of requests.entries()) {
            const overrides = {};
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
    getInterceptors() {
        return Array.from(this.interceptors);
    }
    getPreprocessors() {
        return [...this.preprocessors];
    }
    getPostprocessors() {
        return [...this.postprocessors];
    }
    getPlanCacheKey(request) {
        if (!this.planCache) {
            return undefined;
        }
        try {
            return (0, utils_1.createPlanCacheKey)({
                outputSchema: request.outputSchema,
                instructions: request.instructions,
                options: request.options,
                profile: this.profileName
            });
        }
        catch (error) {
            this.logger.warn?.('parserator-core:plan-cache-key-failed', {
                error: error instanceof Error ? error.message : error,
                profile: this.profileName
            });
            return undefined;
        }
    }
    cloneCacheEntry(entry) {
        return {
            ...entry,
            plan: (0, utils_1.clonePlan)(entry.plan, entry.plan.metadata.origin),
            diagnostics: [...entry.diagnostics]
        };
    }
    emitPlanCacheEvent(event) {
        const requestId = event.requestId ?? (0, uuid_1.v4)();
        const errorMessage = event.error === undefined
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
    async runBeforeInterceptors(context) {
        for (const interceptor of this.interceptors) {
            if (!interceptor.beforeParse) {
                continue;
            }
            try {
                await interceptor.beforeParse(context);
            }
            catch (error) {
                this.logger.warn?.('parserator-core:interceptor-before-error', {
                    error: error instanceof Error ? error.message : error,
                    requestId: context.requestId
                });
            }
        }
    }
    async runPreprocessors(params) {
        const preprocessors = this.getPreprocessors();
        const result = await (0, preprocessors_1.executePreprocessors)(preprocessors, {
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
    async runPostprocessors(params) {
        const postprocessors = this.getPostprocessors();
        const result = await (0, postprocessors_1.executePostprocessors)(postprocessors, {
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
    async runAfterInterceptors(context) {
        for (const interceptor of this.interceptors) {
            if (!interceptor.afterParse) {
                continue;
            }
            try {
                await interceptor.afterParse(context);
            }
            catch (error) {
                this.logger.warn?.('parserator-core:interceptor-after-error', {
                    error: error instanceof Error ? error.message : error,
                    requestId: context.requestId
                });
            }
        }
    }
    async runFailureInterceptors(context) {
        for (const interceptor of this.interceptors) {
            if (!interceptor.onFailure) {
                continue;
            }
            try {
                await interceptor.onFailure(context);
            }
            catch (error) {
                this.logger.warn?.('parserator-core:interceptor-failure-error', {
                    error: error instanceof Error ? error.message : error,
                    requestId: context.requestId
                });
            }
        }
    }
    async handleArchitectFailure(params) {
        const { request, architectResult, requestId, startTime, preprocessDiagnostics, preprocessMetrics, hasPreprocessStage } = params;
        const fallbackDiagnostic = {
            field: '*',
            stage: 'architect',
            message: architectResult.error?.message || 'Architect was unable to generate a search plan',
            severity: 'error'
        };
        const diagnostics = [
            ...preprocessDiagnostics,
            ...(architectResult.diagnostics.length ? architectResult.diagnostics : [fallbackDiagnostic])
        ];
        const stageBreakdown = {
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
        const response = (0, utils_1.createFailureResponse)({
            error: architectResult.error ?? {
                code: 'ARCHITECT_FAILED',
                message: 'Architect was unable to generate a search plan',
                stage: 'architect'
            },
            plan: architectResult.searchPlan ?? (0, utils_1.createEmptyPlan)(request, this.config),
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
            stage: response.error.stage,
            error: response.error,
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
            error: response.error
        });
        return response;
    }
    async handleExtractorFailure(params) {
        const { requestId, architectResult, extractorResult, startTime, request, preprocessDiagnostics, preprocessMetrics, hasPreprocessStage } = params;
        const fallbackDiagnostic = {
            field: '*',
            stage: 'extractor',
            message: extractorResult.error?.message || 'Extractor failed to resolve required fields',
            severity: 'error'
        };
        const diagnostics = [
            ...preprocessDiagnostics,
            ...architectResult.diagnostics,
            ...extractorResult.diagnostics,
            ...(extractorResult.success ? [] : [fallbackDiagnostic])
        ];
        const stageBreakdown = {
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
        const response = (0, utils_1.createFailureResponse)({
            error: extractorResult.error ?? {
                code: 'EXTRACTOR_FAILED',
                message: 'Extractor failed to resolve required fields',
                stage: 'extractor'
            },
            plan: architectResult.searchPlan ?? (0, utils_1.createEmptyPlan)(request, this.config),
            requestId,
            diagnostics,
            tokensUsed: architectResult.tokensUsed + extractorResult.tokensUsed,
            processingTimeMs: Date.now() - startTime,
            architectTokens: architectResult.tokensUsed,
            extractorTokens: extractorResult.tokensUsed,
            stageBreakdown,
            fallbackSummary: extractorResult.fallbackSummary
        });
        this.telemetry.emit({
            type: 'parse:failure',
            source: 'core',
            requestId,
            timestamp: response.metadata.timestamp,
            profile: this.profileName,
            stage: response.error.stage,
            error: response.error,
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
            error: response.error
        });
        return response;
    }
    attachRegistryIfSupported(agent) {
        if (typeof agent?.attachRegistry === 'function') {
            agent.attachRegistry(this.resolverRegistry);
        }
    }
}
exports.ParseratorCore = ParseratorCore;
//# sourceMappingURL=index.js.map