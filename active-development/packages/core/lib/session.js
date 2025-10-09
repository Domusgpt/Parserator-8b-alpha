"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseratorSession = void 0;
const uuid_1 = require("uuid");
const utils_1 = require("./utils");
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
        this.planRuns = 0;
        this.planSuccesses = 0;
        this.planFailures = 0;
        this.planConfidenceHistory = [];
        this.maxConfidenceSamples = 50;
        this.id = deps.init.sessionId ?? (0, uuid_1.v4)();
        this.createdAt = new Date().toISOString();
        this.planConfidence = (0, utils_1.clamp)(deps.init.planConfidence ?? 0.8, 0, 1);
        this.defaultSeedInput = deps.init.seedInput;
        this.telemetry = deps.telemetry;
        this.profileName = deps.profile;
        this.lastSeedInput = deps.init.seedInput;
        if (deps.init.plan) {
            this.plan = this.clonePlan(deps.init.plan, 'cached');
            this.planDiagnostics = [...(deps.init.planDiagnostics ?? [])];
            this.planTokens = 0;
            this.totalArchitectTokens = 0;
            this.planUpdatedAt = new Date().toISOString();
            this.resetPlanHealthMetrics();
            this.deps.logger.info?.('parserator-core:session-plan-attached', {
                sessionId: this.id,
                planId: this.plan.id,
                strategy: this.plan.strategy
            });
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
        const request = {
            inputData,
            outputSchema: this.deps.init.outputSchema,
            instructions: overrides.instructions ?? this.deps.init.instructions,
            options
        };
        const requestId = (0, uuid_1.v4)();
        const startTime = Date.now();
        const validationConfig = this.getConfig();
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
            return await this.captureFailure((0, utils_1.createFailureResponse)({
                error: parseError,
                plan: this.plan ?? (0, utils_1.createEmptyPlan)(request, validationConfig),
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
            return await this.captureFailure(planFailure, request);
        }
        const runtimeConfig = this.getConfig();
        const plan = this.plan;
        const architectTokensForCall = this.parseCount === 0 ? this.planTokens : 0;
        const extractorResult = await this.deps.extractor.execute({
            inputData: request.inputData,
            plan,
            config: runtimeConfig
        });
        const combinedDiagnostics = [...this.planDiagnostics, ...extractorResult.diagnostics];
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
            return await this.captureFailure((0, utils_1.createFailureResponse)({
                error: extractorResult.error ?? {
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
                extractorTokens: extractorResult.tokensUsed,
                stageBreakdown: {
                    architect: {
                        timeMs: this.parseCount === 0 ? this.planProcessingTime : 0,
                        tokens: architectTokensForCall,
                        confidence: this.planConfidence
                    },
                    extractor: {
                        timeMs: extractorResult.processingTimeMs,
                        tokens: extractorResult.tokensUsed,
                        confidence: extractorResult.confidence
                    }
                }
            }), request);
        }
        const planConfidence = this.planConfidence;
        const confidence = (0, utils_1.clamp)(planConfidence * 0.35 + extractorResult.confidence * 0.65, 0, 1);
        const threshold = request.options?.confidenceThreshold ?? runtimeConfig.minConfidence;
        let error;
        let diagnostics = combinedDiagnostics;
        if (confidence < threshold) {
            const warning = {
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
        const response = {
            success: !error,
            parsedData: extractorResult.parsedData,
            metadata: {
                architectPlan: this.clonePlan(plan, this.parseCount === 0 ? plan.metadata.origin : 'cached'),
                confidence,
                tokensUsed: totalTokens,
                processingTimeMs: Date.now() - startTime,
                architectTokens: architectTokensForCall,
                extractorTokens: extractorResult.tokensUsed,
                requestId,
                timestamp: new Date().toISOString(),
                diagnostics,
                stageBreakdown: {
                    architect: {
                        timeMs: this.parseCount === 0 ? this.planProcessingTime : 0,
                        tokens: architectTokensForCall,
                        confidence: planConfidence
                    },
                    extractor: {
                        timeMs: extractorResult.processingTimeMs,
                        tokens: extractorResult.tokensUsed,
                        confidence: extractorResult.confidence
                    }
                }
            },
            error
        };
        this.totalExtractorTokens += extractorResult.tokensUsed;
        this.totalArchitectTokens += architectTokensForCall;
        this.parseCount += 1;
        this.lastResponse = response;
        this.lastDiagnostics = diagnostics;
        this.lastConfidence = confidence;
        this.lastRequestId = requestId;
        this.recordPlanRun({
            confidence,
            success: !error,
            timestamp: response.metadata.timestamp
        });
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
            health: this.getPlanHealth()
        };
    }
    getPlanHealth() {
        const state = this.getPlanState();
        const planRuns = this.planRuns;
        const failureRate = planRuns > 0 ? this.planFailures / planRuns : 0;
        const averageConfidence = this.planConfidenceHistory.length
            ? this.planConfidenceHistory.reduce((total, value) => total + value, 0) /
                this.planConfidenceHistory.length
            : undefined;
        const trend = this.calculateConfidenceTrend();
        const planAgeMs = state.updatedAt ? Date.now() - new Date(state.updatedAt).getTime() : undefined;
        const config = this.getConfig();
        const notes = [];
        let recommendation = 'monitor';
        if (!state.ready) {
            recommendation = 'refresh_plan';
            notes.push('No architect plan has been generated for this session.');
        }
        if (state.ready && planRuns === 0) {
            notes.push('Plan is calibrated but has not been exercised yet.');
        }
        if (state.ready && failureRate >= 0.35) {
            recommendation = 'refresh_plan';
            notes.push('Failure rate exceeded 35% for the current plan.');
        }
        if (state.ready &&
            averageConfidence !== undefined &&
            averageConfidence < config.minConfidence &&
            recommendation !== 'refresh_plan') {
            recommendation = 'reseed_plan';
            notes.push('Average confidence fell below the configured minimum.');
        }
        if (trend === 'decreasing' && planRuns >= 6 && recommendation === 'monitor') {
            recommendation = 'reseed_plan';
            notes.push('Confidence trend is decreasing across recent runs.');
        }
        if (planAgeMs !== undefined && planAgeMs > 1000 * 60 * 60 * 6) {
            notes.push('Plan is older than 6 hours; consider refreshing during the next maintenance window.');
        }
        return {
            ready: state.ready,
            planVersion: state.version,
            planStrategy: state.strategy,
            planConfidence: state.confidence,
            planUpdatedAt: state.updatedAt,
            planAgeMs,
            seedInput: state.seedInput,
            parseCount: this.parseCount,
            totalRuns: planRuns,
            successCount: this.planSuccesses,
            failureCount: this.planFailures,
            failureRate,
            lastConfidence: this.lastConfidence,
            averageConfidence,
            confidenceTrend: trend,
            lastSuccessAt: this.lastSuccessAt,
            lastFailureAt: this.lastFailureAt,
            recommendation,
            notes
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
            plan: overrides.plan ?? (this.plan ? this.clonePlan(this.plan, 'cached') : undefined),
            planConfidence: overrides.planConfidence ?? this.planConfidence,
            planDiagnostics: overrides.planDiagnostics ?? [...this.planDiagnostics],
            sessionId: overrides.sessionId ?? this.id
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
    getConfig() {
        return this.deps.config();
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
        this.plan = this.clonePlan(architectResult.searchPlan);
        this.planUpdatedAt = new Date().toISOString();
        this.resetPlanHealthMetrics();
        this.lastSeedInput = planRequest.inputData;
        if (!this.defaultSeedInput) {
            this.defaultSeedInput = planRequest.inputData;
        }
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
            plan: this.clonePlan(this.plan),
            diagnostics: [...this.planDiagnostics],
            tokensUsed: this.planTokens,
            processingTimeMs: this.planProcessingTime,
            confidence: this.planConfidence
        });
        return undefined;
    }
    getPlanState(options = {}) {
        const includePlan = options.includePlan ?? false;
        return {
            ready: Boolean(this.plan),
            plan: includePlan && this.plan ? this.clonePlan(this.plan, this.plan.metadata.origin) : undefined,
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
        const previousPlan = this.plan ? this.clonePlan(this.plan, this.plan.metadata.origin) : undefined;
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
            this.plan = previousPlan ? this.clonePlan(previousPlan, previousPlan.metadata.origin) : undefined;
            this.planDiagnostics = previousDiagnostics;
            this.planConfidence = previousConfidence;
            this.planTokens = previousTokens;
            this.planProcessingTime = previousProcessing;
            this.planUpdatedAt = previousUpdatedAt;
            this.lastSeedInput = previousSeed;
            this.deps.init.instructions = previousInstructions;
            this.deps.init.options = previousOptions;
            this.defaultSeedInput = previousDefaultSeed;
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
    clonePlan(plan, originOverride) {
        return {
            ...plan,
            steps: plan.steps.map(step => ({ ...step })),
            metadata: {
                ...plan.metadata,
                origin: originOverride ?? plan.metadata.origin
            }
        };
    }
    async captureFailure(response, request) {
        this.lastResponse = response;
        this.lastDiagnostics = response.metadata.diagnostics;
        this.lastConfidence = response.metadata.confidence;
        this.lastRequestId = response.metadata.requestId;
        this.recordPlanRun({
            confidence: response.metadata.confidence,
            success: false,
            timestamp: response.metadata.timestamp
        });
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
    resetPlanHealthMetrics() {
        this.planRuns = 0;
        this.planSuccesses = 0;
        this.planFailures = 0;
        this.planConfidenceHistory = [];
        this.lastSuccessAt = undefined;
        this.lastFailureAt = undefined;
    }
    recordPlanRun(params) {
        if (!this.plan) {
            return;
        }
        this.planRuns += 1;
        if (params.success) {
            this.planSuccesses += 1;
            this.lastSuccessAt = params.timestamp;
        }
        else {
            this.planFailures += 1;
            this.lastFailureAt = params.timestamp;
        }
        if (typeof params.confidence === 'number' && !Number.isNaN(params.confidence)) {
            const sample = (0, utils_1.clamp)(params.confidence, 0, 1);
            this.planConfidenceHistory.push(sample);
            if (this.planConfidenceHistory.length > this.maxConfidenceSamples) {
                this.planConfidenceHistory.shift();
            }
        }
    }
    calculateConfidenceTrend() {
        if (this.planConfidenceHistory.length < 4) {
            return 'stable';
        }
        const window = this.planConfidenceHistory.slice(-Math.min(this.planConfidenceHistory.length, 10));
        const midpoint = Math.floor(window.length / 2);
        if (midpoint === 0) {
            return 'stable';
        }
        const firstHalf = window.slice(0, midpoint);
        const secondHalf = window.slice(midpoint);
        const firstAverage = firstHalf.reduce((total, value) => total + value, 0) / firstHalf.length;
        const secondAverage = secondHalf.reduce((total, value) => total + value, 0) / secondHalf.length;
        const delta = secondAverage - firstAverage;
        if (Math.abs(delta) <= 0.05) {
            return 'stable';
        }
        return delta > 0 ? 'increasing' : 'decreasing';
    }
}
exports.ParseratorSession = ParseratorSession;
//# sourceMappingURL=session.js.map