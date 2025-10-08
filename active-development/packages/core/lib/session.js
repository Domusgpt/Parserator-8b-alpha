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
        try {
            (0, utils_1.validateParseRequest)(request, validationConfig);
        }
        catch (error) {
            const parseError = (0, utils_1.toParseError)(error, 'validation');
            return this.captureFailure((0, utils_1.createFailureResponse)({
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
            }));
        }
        const seedInput = overrides.seedInput ?? this.defaultSeedInput ?? request.inputData;
        const planFailure = await this.ensurePlan({ request, requestId, seedInput });
        if (planFailure) {
            return this.captureFailure(planFailure);
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
        if (!extractorResult.success || !extractorResult.parsedData) {
            const totalTokens = architectTokensForCall + extractorResult.tokensUsed;
            this.totalExtractorTokens += extractorResult.tokensUsed;
            return this.captureFailure((0, utils_1.createFailureResponse)({
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
            }));
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
    captureFailure(response) {
        this.lastResponse = response;
        this.lastDiagnostics = response.metadata.diagnostics;
        this.lastConfidence = response.metadata.confidence;
        this.lastRequestId = response.metadata.requestId;
        return response;
    }
}
exports.ParseratorSession = ParseratorSession;
//# sourceMappingURL=session.js.map