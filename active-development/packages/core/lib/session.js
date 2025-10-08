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
        this.id = deps.init.sessionId ?? (0, uuid_1.v4)();
        this.createdAt = new Date().toISOString();
        this.planConfidence = (0, utils_1.clamp)(deps.init.planConfidence ?? 0.8, 0, 1);
        this.defaultSeedInput = deps.init.seedInput;
        this.telemetry = deps.telemetry;
        this.profileName = deps.profile;
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
        const planFailure = await this.ensurePlan({ request, requestId, seedInput });
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
        if (this.plan) {
            return undefined;
        }
        const seedInput = params.seedInput ?? params.request.inputData;
        const config = this.getConfig();
        const planRequest = {
            inputData: seedInput,
            outputSchema: this.deps.init.outputSchema,
            instructions: this.deps.init.instructions,
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
        this.deps.logger.info?.('parserator-core:session-plan-created', {
            sessionId: this.id,
            planId: this.plan.id,
            strategy: this.plan.strategy
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