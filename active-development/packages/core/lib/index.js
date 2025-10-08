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
exports.ParseratorCore = exports.createDefaultResolvers = exports.ResolverRegistry = exports.RegexExtractor = exports.HeuristicArchitect = void 0;
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
    async parse(request) {
        const requestId = (0, uuid_1.v4)();
        const startTime = Date.now();
        try {
            this.validateRequest(request);
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
                ]
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
            diagnostics: [...architectResult.diagnostics, ...extractorResult.diagnostics]
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
            processingTimeMs: Date.now() - startTime
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
            processingTimeMs: Date.now() - startTime
        });
    }
    validateRequest(request) {
        if (!request.inputData || typeof request.inputData !== 'string') {
            throw new Error('inputData must be a non-empty string');
        }
        const trimmed = request.inputData.trim();
        if (trimmed.length === 0) {
            throw new Error('inputData cannot be empty or whitespace');
        }
        if (trimmed.length > this.config.maxInputLength) {
            throw new Error(`inputData length ${trimmed.length} exceeds maximum ${this.config.maxInputLength}`);
        }
        if (!request.outputSchema || typeof request.outputSchema !== 'object') {
            throw new Error('outputSchema must be an object describing the expected fields');
        }
        const fields = Object.keys(request.outputSchema);
        if (fields.length === 0) {
            throw new Error('outputSchema must contain at least one field');
        }
        if (fields.length > this.config.maxSchemaFields) {
            throw new Error(`outputSchema has ${fields.length} fields which exceeds the limit of ${this.config.maxSchemaFields}`);
        }
        if (request.instructions !== undefined && typeof request.instructions !== 'string') {
            throw new Error('instructions must be a string when provided');
        }
    }
    attachRegistryIfSupported(agent) {
        if (typeof agent?.attachRegistry === 'function') {
            agent.attachRegistry(this.resolverRegistry);
        }
    }
}
exports.ParseratorCore = ParseratorCore;
//# sourceMappingURL=index.js.map