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
exports.TelemetryHub = exports.createTelemetryHub = exports.createDefaultResolvers = exports.ResolverRegistry = exports.RegexExtractor = exports.HeuristicArchitect = exports.ParseratorCore = exports.ParseratorSession = void 0;
const uuid_1 = require("uuid");
const architect_1 = require("./architect");
Object.defineProperty(exports, "HeuristicArchitect", { enumerable: true, get: function () { return architect_1.HeuristicArchitect; } });
const extractor_1 = require("./extractor");
Object.defineProperty(exports, "RegexExtractor", { enumerable: true, get: function () { return extractor_1.RegexExtractor; } });
const logger_1 = require("./logger");
const resolvers_1 = require("./resolvers");
Object.defineProperty(exports, "createDefaultResolvers", { enumerable: true, get: function () { return resolvers_1.createDefaultResolvers; } });
Object.defineProperty(exports, "ResolverRegistry", { enumerable: true, get: function () { return resolvers_1.ResolverRegistry; } });
const profiles_1 = require("./profiles");
const session_1 = require("./session");
const telemetry_1 = require("./telemetry");
Object.defineProperty(exports, "createTelemetryHub", { enumerable: true, get: function () { return telemetry_1.createTelemetryHub; } });
Object.defineProperty(exports, "TelemetryHub", { enumerable: true, get: function () { return telemetry_1.TelemetryHub; } });
const utils_1 = require("./utils");
__exportStar(require("./types"), exports);
__exportStar(require("./profiles"), exports);
var session_2 = require("./session");
Object.defineProperty(exports, "ParseratorSession", { enumerable: true, get: function () { return session_2.ParseratorSession; } });
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
    createSession(init) {
        return new session_1.ParseratorSession({
            architect: this.architect,
            extractor: this.extractor,
            config: () => this.config,
            logger: this.logger,
            telemetry: this.telemetry,
            interceptors: () => this.getInterceptors(),
            profile: this.profileName,
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
            sessionId: overrides.sessionId
        };
        this.logger.info?.('parserator-core:session-created-from-response', {
            sessionId: sessionInit.sessionId,
            planVersion: sessionInit.plan?.version,
            diagnostics: sessionInit.planDiagnostics?.length ?? 0
        });
        return this.createSession(sessionInit);
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
            const response = (0, utils_1.createFailureResponse)({
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
            return await this.handleArchitectFailure({
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
            return await this.handleExtractorFailure({
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
        const response = {
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