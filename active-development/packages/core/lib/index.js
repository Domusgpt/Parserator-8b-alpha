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
exports.createDefaultResolvers = exports.ResolverRegistry = exports.RegexExtractor = exports.HeuristicArchitect = exports.ParseratorSession = exports.ParseratorCore = void 0;
const uuid_1 = require("uuid");
const architect_1 = require("./architect");
Object.defineProperty(exports, "HeuristicArchitect", { enumerable: true, get: function () { return architect_1.HeuristicArchitect; } });
const extractor_1 = require("./extractor");
Object.defineProperty(exports, "RegexExtractor", { enumerable: true, get: function () { return extractor_1.RegexExtractor; } });
const logger_1 = require("./logger");
const resolvers_1 = require("./resolvers");
Object.defineProperty(exports, "createDefaultResolvers", { enumerable: true, get: function () { return resolvers_1.createDefaultResolvers; } });
Object.defineProperty(exports, "ResolverRegistry", { enumerable: true, get: function () { return resolvers_1.ResolverRegistry; } });
const utils_1 = require("./utils");
__exportStar(require("./types"), exports);
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
        if (!options?.apiKey || options.apiKey.trim().length === 0) {
            throw new Error('ParseratorCore requires a non-empty apiKey');
        }
        this.apiKey = options.apiKey;
        this.config = { ...DEFAULT_CONFIG, ...options.config };
        this.logger = options.logger ?? DEFAULT_LOGGER;
        const initialResolvers = options.resolvers ?? (0, resolvers_1.createDefaultResolvers)(this.logger);
        this.resolverRegistry = new resolvers_1.ResolverRegistry(initialResolvers, this.logger);
        this.architect = options.architect ?? new architect_1.HeuristicArchitect(this.logger);
        const extractor = options.extractor ?? new extractor_1.RegexExtractor(this.logger, this.resolverRegistry);
        this.attachRegistryIfSupported(extractor);
        this.extractor = extractor;
    }
    updateConfig(partial) {
        this.config = { ...this.config, ...partial };
        this.logger.info?.('parserator-core:config-updated', { config: this.config });
    }
    getConfig() {
        return { ...this.config };
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
    createSession(init) {
        return new ParseratorSession({
            architect: this.architect,
            extractor: this.extractor,
            config: () => this.config,
            logger: this.logger,
            init
        });
    }
    async parse(request) {
        const requestId = (0, uuid_1.v4)();
        const startTime = Date.now();
        try {
            (0, utils_1.validateParseRequest)(request, this.config);
        }
        catch (error) {
            const parseError = (0, utils_1.toParseError)(error, 'validation');
            return (0, utils_1.createFailureResponse)({
                error: parseError,
                plan: (0, utils_1.createEmptyPlan)(request, this.config),
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
        const confidence = (0, utils_1.clamp)(architectResult.confidence * 0.35 + extractorResult.confidence * 0.65, 0, 1);
        const threshold = request.options?.confidenceThreshold ?? this.config.minConfidence;
        const metadata = {
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
        let error;
        if (confidence < threshold) {
            const warning = {
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
    handleArchitectFailure(params) {
        const { request, architectResult, requestId, startTime } = params;
        const fallbackDiagnostic = {
            field: '*',
            stage: 'architect',
            message: architectResult.error?.message || 'Architect was unable to generate a search plan',
            severity: 'error'
        };
        const diagnostics = architectResult.diagnostics.length
            ? architectResult.diagnostics
            : [fallbackDiagnostic];
        return (0, utils_1.createFailureResponse)({
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
    handleExtractorFailure(params) {
        const { requestId, architectResult, extractorResult, startTime, request } = params;
        const fallbackDiagnostic = {
            field: '*',
            stage: 'extractor',
            message: extractorResult.error?.message || 'Extractor failed to resolve required fields',
            severity: 'error'
        };
        const diagnostics = [
            ...architectResult.diagnostics,
            ...extractorResult.diagnostics,
            ...(extractorResult.success ? [] : [fallbackDiagnostic])
        ];
        return (0, utils_1.createFailureResponse)({
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
    }
    attachRegistryIfSupported(agent) {
        if (typeof agent?.attachRegistry === 'function') {
            agent.attachRegistry(this.resolverRegistry);
        }
    }
}
exports.ParseratorCore = ParseratorCore;
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
                        confidence: this.planConfidence
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
        this.parseCount += 1;
        this.totalExtractorTokens += extractorResult.tokensUsed;
        this.lastRequestId = requestId;
        this.lastConfidence = confidence;
        this.lastDiagnostics = diagnostics;
        this.lastResponse = response;
        return response;
    }
    getPlan() {
        return this.plan ? this.clonePlan(this.plan) : undefined;
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
//# sourceMappingURL=index.js.map