"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseratorSession = void 0;
const uuid_1 = require("uuid");
const utils_1 = require("./utils");
const preprocessors_1 = require("./preprocessors");
const postprocessors_1 = require("./postprocessors");
const telemetry_1 = require("./telemetry");
const async_queue_1 = require("./async-queue");
class ParseratorSession {
    constructor(deps) {
        this.deps = deps;
        this.planDiagnostics = [];
        this.planTokens = 0;
        this.planProcessingTime = 0;
        this.totalArchitectTokens = 0;
        this.totalExtractorTokens = 0;
        this.parseCount = 0;
        this.lastDiagnostics = [];
        this.parsesSinceRefresh = 0;
        this.lowConfidenceRuns = 0;
        this.autoRefreshPending = false;
        this.planCacheQueue = (0, async_queue_1.createAsyncTaskQueue)();
        this.autoRefreshTasks = new Set();
        this.id = deps.init.sessionId ?? (0, uuid_1.v4)();
        this.createdAt = new Date().toISOString();
        this.planConfidence = (0, utils_1.clamp)(deps.init.planConfidence ?? 0.8, 0, 1);
        this.defaultSeedInput = deps.init.seedInput;
        this.telemetry = deps.telemetry;
        this.profileName = deps.profile;
        this.lastSeedInput = deps.init.seedInput;
        this.autoRefreshConfig = deps.init.autoRefresh ? { ...deps.init.autoRefresh } : undefined;
        this.autoRefresh = this.normaliseAutoRefresh(this.autoRefreshConfig);
        this.deps.init.autoRefresh = this.autoRefreshConfig;
        this.planCache = deps.planCache;
        this.planCacheKey = deps.planCacheKey ?? this.resolvePlanCacheKey(deps.init);
        this.emitPlanCacheTelemetry = (0, telemetry_1.createPlanCacheTelemetryEmitter)({
            telemetry: this.telemetry,
            source: 'session',
            resolveProfile: () => this.profileName,
            resolveSessionId: () => this.id,
            resolveKey: () => this.planCacheKey,
            resolvePlanId: () => this.plan?.id,
            requestIdFactory: uuid_1.v4,
            logger: this.deps.logger
        });
        if (deps.init.plan) {
            this.plan = (0, utils_1.clonePlan)(deps.init.plan, 'cached');
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
    async parse(inputData, overrides = {}) {
        const baseOptions = this.deps.init.options ?? {};
        const overrideOptions = overrides.options ?? {};
        const mergedOptions = {
            ...baseOptions,
            ...overrideOptions
        };
        const options = Object.keys(mergedOptions).length ? mergedOptions : undefined;
        let request = {
            inputData,
            outputSchema: this.deps.init.outputSchema,
            instructions: overrides.instructions ?? this.deps.init.instructions,
            options
        };
        const requestId = (0, uuid_1.v4)();
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
        const hasPreprocessStage = (preprocessMetrics.runs ?? 0) > 0 || preprocessDiagnostics.length > 0;
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
            (0, utils_1.validateParseRequest)(request, validationConfig);
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
            return await this.captureFailure((0, utils_1.createFailureResponse)({
                error: parseError,
                plan: this.plan ?? (0, utils_1.createEmptyPlan)(request, validationConfig),
                requestId,
                diagnostics,
                stageBreakdown
            }), request);
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
        const plan = this.plan;
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
            const stageBreakdown = {
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
            return await this.captureFailure((0, utils_1.createFailureResponse)({
                error: extractorResult.error ?? {
                    code: 'EXTRACTOR_FAILED',
                    message: 'Extractor failed to resolve required fields',
                    stage: 'extractor'
                },
                plan: (0, utils_1.clonePlan)(plan, shouldChargePlan ? planOrigin : 'cached'),
                requestId,
                diagnostics: combinedDiagnostics,
                tokensUsed: totalTokens,
                processingTimeMs: Date.now() - startTime,
                architectTokens: architectTokensForCall,
                extractorTokens: extractorResult.tokensUsed,
                stageBreakdown
            }), request);
        }
        const planConfidence = this.planConfidence;
        const baseConfidence = (0, utils_1.clamp)(planConfidence * 0.35 + extractorResult.confidence * 0.65, 0, 1);
        const totalTokens = architectTokensForCall + extractorResult.tokensUsed;
        let metadata = {
            architectPlan: (0, utils_1.clonePlan)(plan, shouldChargePlan ? planOrigin : 'cached'),
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
            }
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
        const hasPostprocessStage = (postprocessMetrics.runs ?? 0) > 0 || postprocessDiagnostics.length > 0;
        metadata = postprocessOutcome.metadata;
        if (hasPreprocessStage && !metadata.stageBreakdown.preprocess) {
            metadata.stageBreakdown.preprocess = preprocessMetrics;
        }
        if (hasPostprocessStage) {
            metadata.stageBreakdown.postprocess = postprocessMetrics;
        }
        const finalParsedData = postprocessOutcome.parsedData;
        const threshold = request.options?.confidenceThreshold ?? runtimeConfig.minConfidence;
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
            if (!runtimeConfig.enableFieldFallbacks) {
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
        }
        else {
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
        this.scheduleAutoRefreshPostParse({
            request,
            response,
            confidence: metadata.confidence,
            threshold,
            overrides,
            requestId
        });
        return response;
    }
    snapshot() {
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
    getBackgroundTaskState() {
        const pendingWrites = this.planCacheQueue.size();
        const planCacheState = {
            pendingWrites,
            idle: pendingWrites === 0,
            lastAttemptAt: this.planCacheLastPersistAttemptAt,
            lastPersistAt: this.planCacheLastPersistAt,
            lastPersistReason: this.planCacheLastPersistReason,
            lastPersistError: this.planCacheLastPersistError
        };
        const autoRefresh = this.getAutoRefreshState();
        if (!autoRefresh) {
            return { planCache: planCacheState };
        }
        return {
            planCache: planCacheState,
            autoRefresh: {
                ...autoRefresh,
                inFlight: this.autoRefreshTasks.size
            }
        };
    }
    exportInit(overrides = {}) {
        const baseOptions = this.deps.init.options;
        const overrideOptions = overrides.options;
        const mergedOptions = baseOptions && overrideOptions
            ? { ...baseOptions, ...overrideOptions }
            : overrideOptions ?? baseOptions;
        return {
            outputSchema: overrides.outputSchema ?? this.deps.init.outputSchema,
            instructions: overrides.instructions ?? this.deps.init.instructions,
            options: mergedOptions,
            seedInput: overrides.seedInput ?? this.defaultSeedInput,
            plan: overrides.plan ?? (this.plan ? (0, utils_1.clonePlan)(this.plan, 'cached') : undefined),
            planConfidence: overrides.planConfidence ?? this.planConfidence,
            planDiagnostics: overrides.planDiagnostics ?? [...this.planDiagnostics],
            sessionId: overrides.sessionId ?? this.id,
            autoRefresh: overrides.autoRefresh ??
                (this.autoRefreshConfig ? { ...this.autoRefreshConfig } : undefined)
        };
    }
    getInterceptors() {
        try {
            return this.deps.interceptors?.() ?? [];
        }
        catch (error) {
            this.deps.logger.warn?.('parserator-core:session-interceptor-resolution-failed', {
                error: error instanceof Error ? error.message : error
            });
            return [];
        }
    }
    getPreprocessors() {
        try {
            return this.deps.preprocessors?.() ?? [];
        }
        catch (error) {
            this.deps.logger.warn?.('parserator-core:session-preprocessor-resolution-failed', {
                error: error instanceof Error ? error.message : error
            });
            return [];
        }
    }
    getPostprocessors() {
        try {
            return this.deps.postprocessors?.() ?? [];
        }
        catch (error) {
            this.deps.logger.warn?.('parserator-core:session-postprocessor-resolution-failed', {
                error: error instanceof Error ? error.message : error
            });
            return [];
        }
    }
    resolvePlanCacheKey(basis) {
        if (!this.planCache) {
            return undefined;
        }
        const reference = basis ?? this.deps.init;
        try {
            return (0, utils_1.createPlanCacheKey)({
                outputSchema: reference.outputSchema,
                instructions: reference.instructions,
                options: reference.options,
                profile: this.profileName
            });
        }
        catch (error) {
            this.deps.logger.warn?.('parserator-core:session-plan-cache-key-failed', {
                error: error instanceof Error ? error.message : error,
                sessionId: this.id
            });
            return undefined;
        }
    }
    queuePlanCachePersist(reason, context = {}) {
        if (!this.planCache || !this.planCacheKey || !this.plan) {
            return;
        }
        const entry = {
            plan: (0, utils_1.clonePlan)(this.plan, this.plan.metadata.origin),
            confidence: this.planConfidence,
            diagnostics: [...this.planDiagnostics],
            tokensUsed: this.planTokens,
            processingTimeMs: this.planProcessingTime,
            updatedAt: this.planUpdatedAt ?? new Date().toISOString(),
            profile: this.profileName
        };
        void this.planCacheQueue.enqueue(async () => {
            this.planCacheLastPersistAttemptAt = new Date().toISOString();
            this.planCacheLastPersistReason = reason;
            try {
                await this.planCache.set(this.planCacheKey, entry);
                this.planCacheLastPersistAt = new Date().toISOString();
                this.planCacheLastPersistError = undefined;
                this.emitPlanCacheTelemetry({
                    action: 'store',
                    requestId: context.requestId,
                    reason,
                    key: this.planCacheKey,
                    planId: entry.plan.id,
                    confidence: entry.confidence,
                    tokensUsed: entry.tokensUsed,
                    processingTimeMs: entry.processingTimeMs
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.planCacheLastPersistError = errorMessage;
                this.deps.logger.warn?.('parserator-core:session-plan-cache-set-failed', {
                    error: error instanceof Error ? error.message : error,
                    sessionId: this.id,
                    reason
                });
                this.emitPlanCacheTelemetry({
                    action: 'store',
                    requestId: context.requestId,
                    reason,
                    key: this.planCacheKey,
                    planId: entry.plan.id,
                    error
                });
            }
        });
    }
    emitAutoRefreshTelemetry(event) {
        this.telemetry.emit({
            type: 'plan:auto-refresh',
            source: 'session',
            timestamp: new Date().toISOString(),
            profile: this.profileName,
            sessionId: this.id,
            ...event
        });
    }
    async runBeforeInterceptors(context) {
        for (const interceptor of this.getInterceptors()) {
            if (!interceptor.beforeParse) {
                continue;
            }
            try {
                await interceptor.beforeParse(context);
            }
            catch (error) {
                this.deps.logger.warn?.('parserator-core:session-interceptor-before-error', {
                    error: error instanceof Error ? error.message : error,
                    requestId: context.requestId,
                    sessionId: this.id
                });
            }
        }
    }
    async executePreprocessorsForRequest(params) {
        const preprocessors = this.getPreprocessors();
        const result = await (0, preprocessors_1.executePreprocessors)(preprocessors, {
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
    async executePostprocessorsForResponse(params) {
        const postprocessors = this.getPostprocessors();
        const result = await (0, postprocessors_1.executePostprocessors)(postprocessors, {
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
    async runAfterInterceptors(context) {
        for (const interceptor of this.getInterceptors()) {
            if (!interceptor.afterParse) {
                continue;
            }
            try {
                await interceptor.afterParse(context);
            }
            catch (error) {
                this.deps.logger.warn?.('parserator-core:session-interceptor-after-error', {
                    error: error instanceof Error ? error.message : error,
                    requestId: context.requestId,
                    sessionId: this.id
                });
            }
        }
    }
    async runFailureInterceptors(context) {
        for (const interceptor of this.getInterceptors()) {
            if (!interceptor.onFailure) {
                continue;
            }
            try {
                await interceptor.onFailure(context);
            }
            catch (error) {
                this.deps.logger.warn?.('parserator-core:session-interceptor-failure-error', {
                    error: error instanceof Error ? error.message : error,
                    requestId: context.requestId,
                    sessionId: this.id
                });
            }
        }
    }
    scheduleAutoRefreshPostParse(params) {
        if (!this.autoRefresh) {
            return;
        }
        const task = this.handleAutoRefreshPostParse(params);
        this.trackAutoRefreshTask(task, params.requestId);
    }
    async handleAutoRefreshPostParse(params) {
        if (!this.autoRefresh || !this.plan) {
            return;
        }
        this.parsesSinceRefresh += 1;
        let trigger;
        if (this.autoRefresh.minConfidence !== undefined) {
            if (params.confidence < this.autoRefresh.minConfidence) {
                this.lowConfidenceRuns += 1;
            }
            else {
                this.lowConfidenceRuns = 0;
            }
            if (params.confidence < this.autoRefresh.minConfidence &&
                this.lowConfidenceRuns > this.autoRefresh.lowConfidenceGrace) {
                trigger = 'confidence';
            }
        }
        else {
            this.lowConfidenceRuns = 0;
        }
        if (!trigger &&
            this.autoRefresh.maxParses !== undefined &&
            this.parsesSinceRefresh >= this.autoRefresh.maxParses) {
            trigger = 'usage';
        }
        if (!trigger) {
            return;
        }
        this.emitAutoRefreshTelemetry({
            requestId: params.requestId,
            action: 'queued',
            reason: trigger,
            confidence: params.confidence,
            threshold: params.threshold,
            minConfidence: this.autoRefresh.minConfidence,
            maxParses: this.autoRefresh.maxParses,
            parsesSinceRefresh: this.parsesSinceRefresh,
            lowConfidenceRuns: this.lowConfidenceRuns,
            pending: this.autoRefreshPending
        });
        await this.triggerAutoRefresh({
            reason: trigger,
            request: params.request,
            overrides: params.overrides,
            response: params.response,
            confidence: params.confidence,
            threshold: params.threshold
        });
    }
    getAutoRefreshState() {
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
    getConfig() {
        return this.deps.config();
    }
    getAutoRefreshConfigSnapshot() {
        const config = {
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
    isAutoRefreshCoolingDown(now = Date.now()) {
        if (!this.autoRefresh?.minIntervalMs || !this.lastAutoRefreshAt) {
            return false;
        }
        return now - this.lastAutoRefreshAt < this.autoRefresh.minIntervalMs;
    }
    async triggerAutoRefresh(params) {
        if (!this.autoRefresh) {
            return;
        }
        if (this.autoRefreshPending) {
            this.emitAutoRefreshTelemetry({
                requestId: params.response.metadata.requestId,
                action: 'skipped',
                reason: params.reason,
                skipReason: 'pending',
                confidence: params.confidence,
                threshold: params.threshold,
                minConfidence: this.autoRefresh.minConfidence,
                maxParses: this.autoRefresh.maxParses,
                parsesSinceRefresh: this.parsesSinceRefresh,
                lowConfidenceRuns: this.lowConfidenceRuns,
                cooldownMs: this.autoRefresh.minIntervalMs,
                pending: true
            });
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
            this.emitAutoRefreshTelemetry({
                requestId: params.response.metadata.requestId,
                action: 'skipped',
                reason: params.reason,
                skipReason: 'cooldown',
                confidence: params.confidence,
                threshold: params.threshold,
                minConfidence: this.autoRefresh.minConfidence,
                maxParses: this.autoRefresh.maxParses,
                parsesSinceRefresh: this.parsesSinceRefresh,
                lowConfidenceRuns: this.lowConfidenceRuns,
                cooldownMs: this.autoRefresh.minIntervalMs,
                pending: false
            });
            return;
        }
        const seedInput = params.reason === 'usage'
            ? this.defaultSeedInput ?? this.lastSeedInput ?? params.request.inputData
            : params.overrides.seedInput ?? params.request.inputData;
        const seedProvided = Boolean(seedInput);
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
                seedProvided
            });
            this.emitAutoRefreshTelemetry({
                requestId: params.response.metadata.requestId,
                action: 'triggered',
                reason: params.reason,
                confidence: params.confidence,
                threshold: params.threshold,
                minConfidence: this.autoRefresh.minConfidence,
                maxParses: this.autoRefresh.maxParses,
                parsesSinceRefresh: this.parsesSinceRefresh,
                lowConfidenceRuns: this.lowConfidenceRuns,
                cooldownMs: this.autoRefresh.minIntervalMs,
                pending: true,
                seedProvided
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
                this.emitAutoRefreshTelemetry({
                    requestId: params.response.metadata.requestId,
                    action: 'failed',
                    reason: params.reason,
                    confidence: params.confidence,
                    threshold: params.threshold,
                    minConfidence: this.autoRefresh.minConfidence,
                    maxParses: this.autoRefresh.maxParses,
                    parsesSinceRefresh: this.parsesSinceRefresh,
                    lowConfidenceRuns: this.lowConfidenceRuns,
                    cooldownMs: this.autoRefresh.minIntervalMs,
                    pending: false,
                    seedProvided,
                    error: result.failure?.error?.message ?? 'unknown'
                });
                return;
            }
            if (!result.skipped) {
                this.lastAutoRefreshAt = Date.now();
                this.lastAutoRefreshReason = params.reason;
            }
            this.emitAutoRefreshTelemetry({
                requestId: params.response.metadata.requestId,
                action: 'completed',
                reason: params.reason,
                confidence: params.confidence,
                threshold: params.threshold,
                minConfidence: this.autoRefresh.minConfidence,
                maxParses: this.autoRefresh.maxParses,
                parsesSinceRefresh: this.parsesSinceRefresh,
                lowConfidenceRuns: this.lowConfidenceRuns,
                cooldownMs: this.autoRefresh.minIntervalMs,
                pending: false,
                seedProvided
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.deps.logger.warn?.('parserator-core:session-auto-refresh-error', {
                sessionId: this.id,
                reason: params.reason,
                error: errorMessage
            });
            this.emitAutoRefreshTelemetry({
                requestId: params.response.metadata.requestId,
                action: 'failed',
                reason: params.reason,
                confidence: params.confidence,
                threshold: params.threshold,
                minConfidence: this.autoRefresh.minConfidence,
                maxParses: this.autoRefresh.maxParses,
                parsesSinceRefresh: this.parsesSinceRefresh,
                lowConfidenceRuns: this.lowConfidenceRuns,
                cooldownMs: this.autoRefresh.minIntervalMs,
                pending: false,
                seedProvided,
                error: errorMessage
            });
        }
        finally {
            this.autoRefreshPending = false;
        }
    }
    resetAutoRefreshState() {
        this.parsesSinceRefresh = 0;
        this.lowConfidenceRuns = 0;
    }
    trackAutoRefreshTask(task, requestId) {
        let tracked;
        tracked = task
            .catch(error => {
            this.deps.logger.warn?.('parserator-core:session-auto-refresh-unhandled', {
                error: error instanceof Error ? error.message : error,
                sessionId: this.id,
                requestId
            });
        })
            .finally(() => {
            this.autoRefreshTasks.delete(tracked);
        });
        this.autoRefreshTasks.add(tracked);
    }
    async waitForAutoRefreshIdle() {
        if (this.autoRefreshTasks.size === 0) {
            return;
        }
        await Promise.all(Array.from(this.autoRefreshTasks, task => task.catch(() => undefined)));
    }
    async waitForIdleTasks() {
        await Promise.all([this.planCacheQueue.onIdle(), this.waitForAutoRefreshIdle()]);
    }
    normaliseAutoRefresh(config) {
        if (!config) {
            return undefined;
        }
        const minConfidence = typeof config.minConfidence === 'number'
            ? (0, utils_1.clamp)(config.minConfidence, 0, 1)
            : undefined;
        const maxParses = typeof config.maxParses === 'number' && config.maxParses > 0
            ? Math.floor(config.maxParses)
            : undefined;
        const minIntervalMs = typeof config.minIntervalMs === 'number' && config.minIntervalMs > 0
            ? config.minIntervalMs
            : undefined;
        const lowConfidenceGrace = typeof config.lowConfidenceGrace === 'number' && config.lowConfidenceGrace > 0
            ? Math.floor(config.lowConfidenceGrace)
            : 0;
        const normalized = {
            minConfidence,
            maxParses,
            minIntervalMs,
            lowConfidenceGrace
        };
        if (normalized.minConfidence === undefined && normalized.maxParses === undefined) {
            normalized.minConfidence = (0, utils_1.clamp)(this.getConfig().minConfidence, 0, 1);
        }
        return normalized;
    }
    async ensurePlan(params) {
        if (this.plan && params.reason === 'ensure') {
            return undefined;
        }
        const seedInput = params.seedInput ?? params.request.inputData;
        const config = this.getConfig();
        const planRequest = {
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
            (0, utils_1.validateParseRequest)(planRequest, config);
        }
        catch (error) {
            const parseError = (0, utils_1.toParseError)(error, 'validation');
            return (0, utils_1.createFailureResponse)({
                error: parseError,
                plan: (0, utils_1.createEmptyPlan)(planRequest, config),
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
                    this.emitPlanCacheTelemetry({
                        action: 'hit',
                        requestId: params.requestId,
                        reason: params.reason,
                        key: this.planCacheKey,
                        planId: cached.plan.id,
                        confidence: cached.confidence,
                        tokensUsed: cached.tokensUsed,
                        processingTimeMs: cached.processingTimeMs
                    });
                    this.plan = (0, utils_1.clonePlan)(cached.plan, 'cached');
                    this.planDiagnostics = [...cached.diagnostics];
                    this.planConfidence = (0, utils_1.clamp)(cached.confidence ?? this.planConfidence, 0, 1);
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
                        plan: (0, utils_1.clonePlan)(this.plan),
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
                this.emitPlanCacheTelemetry({
                    action: 'miss',
                    requestId: params.requestId,
                    reason: params.reason,
                    key: this.planCacheKey
                });
            }
            catch (error) {
                this.deps.logger.warn?.('parserator-core:session-plan-cache-get-failed', {
                    error: error instanceof Error ? error.message : error,
                    sessionId: this.id
                });
                this.emitPlanCacheTelemetry({
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
            const diagnostics = architectResult.diagnostics.length
                ? architectResult.diagnostics
                : [
                    {
                        field: '*',
                        stage: 'architect',
                        message: architectResult.error?.message ??
                            'Architect was unable to generate a search plan',
                        severity: 'error'
                    }
                ];
            this.planTokens = 0;
            this.planProcessingTime = architectResult.processingTimeMs;
            return (0, utils_1.createFailureResponse)({
                error: architectResult.error ?? {
                    code: 'ARCHITECT_FAILED',
                    message: 'Architect was unable to generate a search plan',
                    stage: 'architect'
                },
                plan: architectResult.searchPlan ?? (0, utils_1.createEmptyPlan)(planRequest, config),
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
        this.planConfidence = (0, utils_1.clamp)(architectResult.confidence ?? this.planConfidence, 0, 1);
        this.planTokens = architectResult.tokensUsed;
        this.planProcessingTime = architectResult.processingTimeMs;
        this.plan = (0, utils_1.clonePlan)(architectResult.searchPlan);
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
            plan: (0, utils_1.clonePlan)(this.plan),
            diagnostics: [...this.planDiagnostics],
            tokensUsed: this.planTokens,
            processingTimeMs: this.planProcessingTime,
            confidence: this.planConfidence
        });
        this.queuePlanCachePersist(params.reason, { requestId: params.requestId });
        return undefined;
    }
    getPlanState(options = {}) {
        const includePlan = options.includePlan ?? false;
        return {
            ready: Boolean(this.plan),
            plan: includePlan && this.plan ? (0, utils_1.clonePlan)(this.plan, this.plan.metadata.origin) : undefined,
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
    async refreshPlan(options = {}) {
        if (this.plan &&
            !options.force &&
            options.seedInput === undefined &&
            options.instructions === undefined &&
            options.options === undefined) {
            return {
                success: true,
                skipped: true,
                state: this.getPlanState({ includePlan: options.includePlan })
            };
        }
        const seedInput = options.seedInput ?? this.lastSeedInput ?? this.defaultSeedInput;
        if (!seedInput) {
            throw new Error('ParseratorSession.refreshPlan requires a seedInput when no previous calibration sample is available');
        }
        const requestId = (0, uuid_1.v4)();
        const baseOptions = this.deps.init.options ?? {};
        const overrideOptions = options.options ?? {};
        const mergedOptions = { ...baseOptions, ...overrideOptions };
        const planOptions = Object.keys(mergedOptions).length ? mergedOptions : undefined;
        const instructions = options.instructions ?? this.deps.init.instructions;
        const planRequest = {
            inputData: seedInput,
            outputSchema: this.deps.init.outputSchema,
            instructions,
            options: planOptions
        };
        const previousPlan = this.plan ? (0, utils_1.clonePlan)(this.plan, this.plan.metadata.origin) : undefined;
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
            this.plan = previousPlan ? (0, utils_1.clonePlan)(previousPlan, previousPlan.metadata.origin) : undefined;
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
    async captureFailure(response, request) {
        this.lastResponse = response;
        this.lastDiagnostics = response.metadata.diagnostics;
        this.lastConfidence = response.metadata.confidence;
        this.lastRequestId = response.metadata.requestId;
        const error = response.error ?? {
            code: 'UNKNOWN_FAILURE',
            message: 'Unknown parse failure',
            stage: 'orchestration'
        };
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
exports.ParseratorSession = ParseratorSession;
//# sourceMappingURL=session.js.map