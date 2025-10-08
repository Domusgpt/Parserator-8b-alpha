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
exports.ParseratorKernel = exports.RegexExtractor = exports.HeuristicArchitect = exports.ParseratorCore = void 0;
const uuid_1 = require("uuid");
__exportStar(require("./types"), exports);
const DEFAULT_CONFIG = {
    maxInputLength: 120000,
    maxSchemaFields: 64,
    minConfidence: 0.55,
    defaultStrategy: 'sequential',
    enableFieldFallbacks: true,
    enableExtractorFallbacks: true
};
const DEFAULT_LOGGER = createDefaultLogger();
function createDefaultLogger() {
    const globalConsole = globalThis.console;
    if (globalConsole) {
        return {
            debug: (...args) => globalConsole.debug?.(...args),
            info: (...args) => globalConsole.info?.(...args),
            warn: (...args) => globalConsole.warn?.(...args),
            error: (...args) => globalConsole.error?.(...args)
        };
    }
    return {
        debug: () => { },
        info: () => { },
        warn: () => { },
        error: () => { }
    };
}
class ParseratorKernel {
    constructor(logger, observers) {
        this.logger = logger;
        this.observers = new Set();
        observers?.forEach(observer => this.observers.add(observer));
    }
    addObserver(observer) {
        this.observers.add(observer);
        return () => this.observers.delete(observer);
    }
    getLastSnapshot() {
        return this.lastSnapshot ? cloneSnapshot(this.lastSnapshot) : undefined;
    }
    async run(options) {
        const requestId = (0, uuid_1.v4)();
        const startTime = Date.now();
        const snapshot = createKernelSnapshot(requestId);
        this.lastSnapshot = cloneSnapshot(snapshot);
        markStageRunning(snapshot, 'validation');
        await this.emit({
            stage: 'validation',
            type: 'started',
            timestamp: new Date().toISOString(),
            payload: { requestId }
        });
        try {
            options.validateRequest(options.request);
            markStageSuccess(snapshot, 'validation');
            await this.emit({
                stage: 'validation',
                type: 'finished',
                timestamp: new Date().toISOString(),
                payload: { requestId }
            });
        }
        catch (error) {
            const parseError = toParseError(error, 'validation');
            const diagnostic = {
                field: '*',
                stage: 'validation',
                message: parseError.message,
                severity: 'error'
            };
            markStageFailure(snapshot, 'validation', parseError, [diagnostic]);
            await this.emit({
                stage: 'validation',
                type: 'failed',
                timestamp: new Date().toISOString(),
                payload: { requestId, error: parseError }
            });
            snapshot.finishedAt = new Date().toISOString();
            const failure = createFailureResponse({
                error: parseError,
                plan: createEmptyPlan(options.request, options.config),
                requestId,
                diagnostics: [diagnostic]
            });
            failure.snapshot = cloneSnapshot(snapshot);
            const finalSnapshot = cloneSnapshot(snapshot);
            this.lastSnapshot = finalSnapshot;
            return { response: failure, snapshot: finalSnapshot };
        }
        this.lastSnapshot = cloneSnapshot(snapshot);
        markStageRunning(snapshot, 'plan');
        await this.emit({
            stage: 'plan',
            type: 'started',
            timestamp: new Date().toISOString(),
            payload: { requestId }
        });
        let architectResult;
        try {
            architectResult = await options.architect.createPlan({
                inputData: options.request.inputData,
                outputSchema: options.request.outputSchema,
                instructions: options.request.instructions,
                options: options.request.options,
                config: options.config
            });
        }
        catch (error) {
            const parseError = toParseError(error, 'architect');
            architectResult = {
                success: false,
                tokensUsed: 0,
                processingTimeMs: 0,
                confidence: 0,
                diagnostics: [],
                error: parseError
            };
        }
        if (!architectResult.success || !architectResult.searchPlan) {
            const planError = architectResult.error ?? {
                code: 'ARCHITECT_FAILED',
                message: 'Architect was unable to generate a search plan',
                stage: 'architect'
            };
            const fallbackDiagnostic = {
                field: '*',
                stage: 'architect',
                message: planError.message,
                severity: 'error'
            };
            const diagnostics = architectResult.diagnostics.length
                ? architectResult.diagnostics
                : [fallbackDiagnostic];
            markStageFailure(snapshot, 'plan', planError, diagnostics);
            await this.emit({
                stage: 'plan',
                type: 'failed',
                timestamp: new Date().toISOString(),
                payload: { requestId, error: planError }
            });
            snapshot.finishedAt = new Date().toISOString();
            const failurePlan = architectResult.searchPlan ?? createEmptyPlan(options.request, options.config);
            const failure = createFailureResponse({
                error: planError,
                plan: failurePlan,
                requestId,
                diagnostics,
                tokensUsed: architectResult.tokensUsed,
                processingTimeMs: Date.now() - startTime
            });
            failure.snapshot = cloneSnapshot(snapshot);
            const finalSnapshot = cloneSnapshot(snapshot);
            this.lastSnapshot = finalSnapshot;
            return { response: failure, snapshot: finalSnapshot };
        }
        const plan = architectResult.searchPlan;
        markStageSuccess(snapshot, 'plan', {
            planId: plan.id,
            steps: plan.steps.length,
            strategy: plan.strategy,
            confidence: architectResult.confidence
        }, architectResult.diagnostics);
        await this.emit({
            stage: 'plan',
            type: 'finished',
            timestamp: new Date().toISOString(),
            payload: { requestId, planId: plan.id }
        });
        this.lastSnapshot = cloneSnapshot(snapshot);
        markStageRunning(snapshot, 'extract');
        await this.emit({
            stage: 'extract',
            type: 'started',
            timestamp: new Date().toISOString(),
            payload: { requestId, planId: plan.id }
        });
        let primaryResult;
        try {
            primaryResult = await options.extractor.execute({
                inputData: options.request.inputData,
                plan,
                config: options.config
            });
        }
        catch (error) {
            const parseError = toParseError(error, 'extractor');
            primaryResult = {
                success: false,
                tokensUsed: 0,
                processingTimeMs: 0,
                confidence: 0,
                diagnostics: [],
                error: parseError
            };
        }
        let activeResult = primaryResult;
        let fallbackResult;
        let fallbackUsed = false;
        if (!primaryResult.success || !primaryResult.parsedData) {
            const extractError = primaryResult.error ?? {
                code: 'EXTRACTOR_FAILED',
                message: 'Extractor failed to resolve required fields',
                stage: 'extractor'
            };
            const extractDiagnostics = primaryResult.diagnostics.length
                ? primaryResult.diagnostics
                : [
                    {
                        field: '*',
                        stage: 'extractor',
                        message: extractError.message,
                        severity: 'error'
                    }
                ];
            markStageFailure(snapshot, 'extract', extractError, extractDiagnostics);
            await this.emit({
                stage: 'extract',
                type: 'failed',
                timestamp: new Date().toISOString(),
                payload: { requestId, error: extractError }
            });
            if (options.enableExtractorFallbacks && options.fallbackExtractor) {
                markStageRunning(snapshot, 'fallback');
                await this.emit({
                    stage: 'fallback',
                    type: 'started',
                    timestamp: new Date().toISOString(),
                    payload: { requestId, reason: extractError.code }
                });
                try {
                    fallbackResult = await options.fallbackExtractor.execute({
                        inputData: options.request.inputData,
                        plan,
                        config: options.config
                    });
                }
                catch (error) {
                    const parseError = toParseError(error, 'fallback');
                    fallbackResult = {
                        success: false,
                        tokensUsed: 0,
                        processingTimeMs: 0,
                        confidence: 0,
                        diagnostics: [],
                        error: parseError
                    };
                }
                if (fallbackResult.success && fallbackResult.parsedData) {
                    fallbackUsed = true;
                    activeResult = fallbackResult;
                    markStageSuccess(snapshot, 'fallback', { confidence: fallbackResult.confidence }, fallbackResult.diagnostics);
                    await this.emit({
                        stage: 'fallback',
                        type: 'finished',
                        timestamp: new Date().toISOString(),
                        payload: { requestId, confidence: fallbackResult.confidence }
                    });
                }
                else {
                    const fallbackError = fallbackResult?.error ?? {
                        code: 'FALLBACK_EXTRACTOR_FAILED',
                        message: 'Fallback extractor failed to resolve required fields',
                        stage: 'fallback'
                    };
                    const fallbackDiagnostics = fallbackResult?.diagnostics?.length
                        ? fallbackResult.diagnostics
                        : [
                            {
                                field: '*',
                                stage: 'fallback',
                                message: fallbackError.message,
                                severity: 'error'
                            }
                        ];
                    markStageFailure(snapshot, 'fallback', fallbackError, fallbackDiagnostics);
                    await this.emit({
                        stage: 'fallback',
                        type: 'failed',
                        timestamp: new Date().toISOString(),
                        payload: { requestId, error: fallbackError }
                    });
                    snapshot.finishedAt = new Date().toISOString();
                    const failureDiagnostics = [
                        ...architectResult.diagnostics,
                        ...extractDiagnostics,
                        ...fallbackDiagnostics
                    ];
                    const failure = createFailureResponse({
                        error: fallbackError,
                        plan,
                        requestId,
                        diagnostics: failureDiagnostics,
                        tokensUsed: architectResult.tokensUsed +
                            primaryResult.tokensUsed +
                            (fallbackResult?.tokensUsed ?? 0),
                        processingTimeMs: Date.now() - startTime
                    });
                    failure.snapshot = cloneSnapshot(snapshot);
                    const finalSnapshot = cloneSnapshot(snapshot);
                    this.lastSnapshot = finalSnapshot;
                    return { response: failure, snapshot: finalSnapshot };
                }
            }
            else {
                snapshot.finishedAt = new Date().toISOString();
                const failureDiagnostics = [
                    ...architectResult.diagnostics,
                    ...extractDiagnostics
                ];
                const failure = createFailureResponse({
                    error: extractError,
                    plan,
                    requestId,
                    diagnostics: failureDiagnostics,
                    tokensUsed: architectResult.tokensUsed + primaryResult.tokensUsed,
                    processingTimeMs: Date.now() - startTime
                });
                failure.snapshot = cloneSnapshot(snapshot);
                const finalSnapshot = cloneSnapshot(snapshot);
                this.lastSnapshot = finalSnapshot;
                return { response: failure, snapshot: finalSnapshot };
            }
        }
        else {
            markStageSuccess(snapshot, 'extract', { confidence: primaryResult.confidence }, primaryResult.diagnostics);
            await this.emit({
                stage: 'extract',
                type: 'finished',
                timestamp: new Date().toISOString(),
                payload: { requestId, confidence: primaryResult.confidence }
            });
        }
        if (!fallbackUsed) {
            skipStage(snapshot, 'fallback');
        }
        const totalTokens = architectResult.tokensUsed +
            primaryResult.tokensUsed +
            (fallbackResult?.tokensUsed ?? 0);
        const diagnostics = [
            ...architectResult.diagnostics,
            ...primaryResult.diagnostics,
            ...(fallbackResult?.diagnostics ?? [])
        ];
        if (fallbackUsed) {
            diagnostics.push({
                field: '*',
                stage: 'fallback',
                message: 'Fallback extractor succeeded after primary failure',
                severity: 'info'
            });
        }
        const confidence = weightedConfidence(fallbackUsed && fallbackResult
            ? [
                { value: architectResult.confidence, weight: 0.35 },
                { value: primaryResult.confidence, weight: 0.2 },
                { value: fallbackResult.confidence, weight: 0.45 }
            ]
            : [
                { value: architectResult.confidence, weight: 0.35 },
                { value: primaryResult.confidence, weight: 0.65 }
            ]);
        const threshold = options.request.options?.confidenceThreshold ?? options.config.minConfidence;
        const metadata = {
            architectPlan: plan,
            confidence,
            tokensUsed: totalTokens,
            processingTimeMs: Date.now() - startTime,
            architectTokens: architectResult.tokensUsed,
            extractorTokens: activeResult.tokensUsed,
            fallbackTokens: fallbackResult?.tokensUsed,
            fallbackUsed,
            kernelSnapshotId: requestId,
            requestId,
            timestamp: new Date().toISOString(),
            diagnostics
        };
        let response = {
            success: true,
            parsedData: activeResult.parsedData ?? {},
            metadata,
            snapshot: cloneSnapshot(snapshot)
        };
        if (confidence < threshold) {
            const warning = {
                field: '*',
                stage: 'postprocess',
                message: `Confidence ${confidence.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
                severity: 'warning'
            };
            metadata.diagnostics = [...metadata.diagnostics, warning];
            if (!options.enableFieldFallbacks) {
                response.success = false;
                response.error = {
                    code: 'LOW_CONFIDENCE',
                    message: warning.message,
                    stage: 'extractor',
                    details: { confidence, threshold }
                };
            }
        }
        if (options.postProcessors.length === 0) {
            skipStage(snapshot, 'postprocess');
        }
        else {
            markStageRunning(snapshot, 'postprocess');
            await this.emit({
                stage: 'postprocess',
                type: 'started',
                timestamp: new Date().toISOString(),
                payload: { requestId, processors: options.postProcessors.map(p => p.name) }
            });
            let processedResponse = response;
            for (const processor of options.postProcessors) {
                try {
                    processedResponse = await processor.process(processedResponse, {
                        request: options.request,
                        config: options.config,
                        snapshot: cloneSnapshot(snapshot)
                    });
                }
                catch (error) {
                    const parseError = toParseError(error, 'postprocess');
                    const diagnostic = {
                        field: '*',
                        stage: 'postprocess',
                        message: `Post processor "${processor.name}" failed: ${parseError.message}`,
                        severity: 'warning'
                    };
                    processedResponse.metadata.diagnostics = [
                        ...processedResponse.metadata.diagnostics,
                        diagnostic
                    ];
                    this.logger.warn?.('parserator-core:postprocess-error', {
                        processor: processor.name,
                        error: parseError
                    });
                }
            }
            const postprocessDiagnostics = processedResponse.metadata.diagnostics.filter(diagnostic => diagnostic.stage === 'postprocess');
            markStageSuccess(snapshot, 'postprocess', undefined, postprocessDiagnostics);
            await this.emit({
                stage: 'postprocess',
                type: 'finished',
                timestamp: new Date().toISOString(),
                payload: { requestId }
            });
            response = processedResponse;
        }
        snapshot.finishedAt = new Date().toISOString();
        const finalSnapshot = response.snapshot ? cloneSnapshot(response.snapshot) : cloneSnapshot(snapshot);
        response.snapshot = finalSnapshot;
        this.lastSnapshot = finalSnapshot;
        return { response, snapshot: finalSnapshot };
    }
    async emit(event) {
        await Promise.all(Array.from(this.observers).map(async (observer) => {
            try {
                await observer(event);
            }
            catch (error) {
                this.logger.warn?.('parserator-core:observer-error', {
                    stage: event.stage,
                    type: event.type,
                    error: error instanceof Error ? error.message : error
                });
            }
        }));
    }
}
exports.ParseratorKernel = ParseratorKernel;
class ParseratorCore {
    constructor(options) {
        if (!options?.apiKey || options.apiKey.trim().length === 0) {
            throw new Error('ParseratorCore requires a non-empty apiKey');
        }
        this.apiKey = options.apiKey;
        this.config = { ...DEFAULT_CONFIG, ...options.config };
        this.logger = options.logger ?? DEFAULT_LOGGER;
        this.architect = options.architect ?? new HeuristicArchitect(this.logger);
        this.extractor = options.extractor ?? new RegexExtractor(this.logger);
        this.fallbackExtractor = options.fallbackExtractor;
        this.postProcessors = [...(options.postProcessors ?? [])];
        this.kernel = new ParseratorKernel(this.logger, options.observers);
    }
    updateConfig(partial) {
        this.config = { ...this.config, ...partial };
        this.logger.info?.('parserator-core:config-updated', { config: this.config });
    }
    setArchitect(agent) {
        this.architect = agent;
    }
    setExtractor(agent) {
        this.extractor = agent;
    }
    setFallbackExtractor(agent) {
        this.fallbackExtractor = agent;
    }
    registerPostProcessor(processor) {
        this.postProcessors.push(processor);
        return () => {
            this.postProcessors = this.postProcessors.filter(existing => existing !== processor);
        };
    }
    addObserver(observer) {
        return this.kernel.addObserver(observer);
    }
    getLastSnapshot() {
        return this.kernel.getLastSnapshot();
    }
    async parse(request) {
        const { response } = await this.kernel.run({
            request,
            config: this.config,
            architect: this.architect,
            extractor: this.extractor,
            fallbackExtractor: this.fallbackExtractor,
            enableFieldFallbacks: this.config.enableFieldFallbacks,
            enableExtractorFallbacks: this.config.enableExtractorFallbacks,
            postProcessors: this.postProcessors,
            validateRequest: req => this.validateRequest(req)
        });
        return response;
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
}
exports.ParseratorCore = ParseratorCore;
function createKernelSnapshot(requestId) {
    return {
        requestId,
        startedAt: new Date().toISOString(),
        stages: {
            validation: createStageState('idle'),
            plan: createStageState('idle'),
            extract: createStageState('idle'),
            fallback: createStageState('idle'),
            postprocess: createStageState('idle')
        }
    };
}
function createStageState(status) {
    return {
        status,
        diagnostics: []
    };
}
function cloneSnapshot(snapshot) {
    return JSON.parse(JSON.stringify(snapshot));
}
function markStageRunning(snapshot, stage) {
    const state = snapshot.stages[stage];
    state.status = 'running';
    state.startedAt = new Date().toISOString();
}
function markStageSuccess(snapshot, stage, metadata, diagnostics = []) {
    const state = snapshot.stages[stage];
    state.status = 'success';
    state.finishedAt = new Date().toISOString();
    if (metadata) {
        state.metadata = { ...(state.metadata ?? {}), ...metadata };
    }
    if (diagnostics.length) {
        state.diagnostics = [...state.diagnostics, ...diagnostics];
    }
}
function markStageFailure(snapshot, stage, error, diagnostics = []) {
    const state = snapshot.stages[stage];
    state.status = 'failed';
    state.finishedAt = new Date().toISOString();
    state.error = error;
    if (diagnostics.length) {
        state.diagnostics = [...state.diagnostics, ...diagnostics];
    }
}
function skipStage(snapshot, stage) {
    const state = snapshot.stages[stage];
    if (state.status === 'idle') {
        state.status = 'skipped';
    }
    state.startedAt = state.startedAt ?? new Date().toISOString();
    state.finishedAt = new Date().toISOString();
}
class HeuristicArchitect {
    constructor(logger) {
        this.logger = logger;
    }
    async createPlan(context) {
        const start = Date.now();
        const diagnostics = [];
        const fields = Object.keys(context.outputSchema);
        const steps = fields.map(field => {
            const schemaValue = context.outputSchema[field];
            const validationType = detectValidationType(field, schemaValue);
            const isRequired = !isFieldOptional(schemaValue);
            const humanKey = humaniseKey(field);
            const searchInstruction = buildSearchInstruction(humanKey, validationType, context.instructions);
            if (!isRequired) {
                diagnostics.push({
                    field,
                    stage: 'architect',
                    message: `${field} marked as optional by schema heuristics`,
                    severity: 'info'
                });
            }
            return {
                targetKey: field,
                description: `Extract ${humanKey}`,
                searchInstruction,
                validationType,
                isRequired
            };
        });
        const plan = {
            id: `plan_${Date.now().toString(36)}`,
            version: '1.0',
            steps,
            strategy: context.config.defaultStrategy,
            confidenceThreshold: context.options?.confidenceThreshold ?? context.config.minConfidence,
            metadata: {
                detectedFormat: detectFormat(context.inputData),
                complexity: estimateComplexity(steps.length, context.inputData.length),
                estimatedTokens: estimateTokenCost(steps.length, context.inputData.length),
                origin: 'heuristic'
            }
        };
        const confidence = steps.length > 0 ? clamp(0.68 + steps.length * 0.01, 0, 0.92) : 0.65;
        this.logger.debug?.('parserator-core:architect-plan', {
            fields: steps.length,
            strategy: plan.strategy,
            confidence
        });
        return {
            success: true,
            searchPlan: plan,
            tokensUsed: Math.max(48, Math.round(plan.metadata.estimatedTokens * 0.3)),
            processingTimeMs: Date.now() - start,
            confidence,
            diagnostics
        };
    }
}
exports.HeuristicArchitect = HeuristicArchitect;
class RegexExtractor {
    constructor(logger) {
        this.logger = logger;
    }
    async execute(context) {
        const start = Date.now();
        const parsed = {};
        const diagnostics = [];
        let resolvedRequired = 0;
        let requiredCount = 0;
        for (const step of context.plan.steps) {
            if (step.isRequired) {
                requiredCount += 1;
            }
            const result = extractField(context.inputData, step);
            if (result.value !== undefined) {
                parsed[step.targetKey] = result.value;
                if (step.isRequired) {
                    resolvedRequired += 1;
                }
            }
            diagnostics.push(...result.diagnostics);
        }
        const success = requiredCount === 0 || resolvedRequired === requiredCount;
        const processingTimeMs = Date.now() - start;
        const tokensUsed = Math.max(72, Math.round(context.plan.metadata.estimatedTokens * 0.7));
        const confidence = context.plan.steps.length
            ? (resolvedRequired + (context.plan.steps.length - requiredCount) * 0.6) /
                context.plan.steps.length
            : 0;
        let error;
        if (!success) {
            const missing = context.plan.steps
                .filter(step => step.isRequired && !(step.targetKey in parsed))
                .map(step => step.targetKey);
            error = {
                code: 'MISSING_REQUIRED_FIELDS',
                message: `Extractor could not resolve required fields: ${missing.join(', ')}`,
                stage: 'extractor',
                details: { missing }
            };
            diagnostics.push({
                field: '*',
                stage: 'extractor',
                message: error.message,
                severity: 'error'
            });
        }
        this.logger.debug?.('parserator-core:extraction-finished', {
            resolvedRequired,
            requiredCount,
            success,
            confidence
        });
        return {
            success,
            parsedData: parsed,
            tokensUsed,
            processingTimeMs,
            confidence: clamp(confidence, 0, 1),
            diagnostics,
            error
        };
    }
}
exports.RegexExtractor = RegexExtractor;
function extractField(input, step) {
    const diagnostics = [];
    let value;
    switch (step.validationType) {
        case 'email':
            value = matchFirst(input, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
            break;
        case 'phone':
            value = matchFirst(input, /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)[\d\s-]{7,}/);
            break;
        case 'iso_date':
            value = matchFirst(input, /\d{4}-\d{2}-\d{2}/);
            break;
        case 'date':
            value =
                matchFirst(input, /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/) ||
                    matchFirst(input, /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i);
            break;
        case 'url':
            value = matchFirst(input, /https?:\/\/[^\s]+/i);
            break;
        case 'number':
            value = matchNumber(input);
            break;
        case 'boolean':
            value = matchBoolean(input);
            break;
        case 'string_array':
            value = matchList(input, step.targetKey, false);
            break;
        case 'number_array':
            value = matchList(input, step.targetKey, true);
            break;
        default:
            value = matchByLabel(input, step.targetKey);
    }
    if (value === undefined && !step.isRequired) {
        diagnostics.push({
            field: step.targetKey,
            stage: 'extractor',
            message: `${step.targetKey} not located but field marked optional`,
            severity: 'info'
        });
    }
    if (value === undefined && step.isRequired) {
        diagnostics.push({
            field: step.targetKey,
            stage: 'extractor',
            message: `${step.targetKey} not found in input`,
            severity: 'warning'
        });
    }
    return { value, diagnostics };
}
function matchFirst(input, regex) {
    const match = input.match(regex);
    return match ? match[0].trim() : undefined;
}
function matchNumber(input) {
    const match = input.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
}
function matchBoolean(input) {
    const lowered = input.toLowerCase();
    if (/(^|\b)(true|yes|enabled)(\b|$)/.test(lowered)) {
        return true;
    }
    if (/(^|\b)(false|no|disabled)(\b|$)/.test(lowered)) {
        return false;
    }
    return undefined;
}
function matchList(input, key, numeric) {
    const labelPattern = new RegExp(`${escapeRegExp(key)}\\s*[:\-]?\\s*(.+)`, 'i');
    const labelMatch = input.match(labelPattern);
    const source = labelMatch ? labelMatch[1] : input;
    const items = source
        .split(/[\n,;]+/)
        .map(item => item.trim())
        .filter(Boolean);
    if (items.length === 0) {
        return undefined;
    }
    if (numeric) {
        const numbers = items
            .map(item => item.match(/-?\d+(?:\.\d+)?/))
            .filter((match) => !!match)
            .map(match => Number(match[0]));
        return numbers.length ? numbers : undefined;
    }
    return items;
}
function matchByLabel(input, key) {
    const labelPattern = new RegExp(`${escapeRegExp(key)}\\s*[:\-]?\\s*(.+)`, 'i');
    const match = input.match(labelPattern);
    if (match) {
        return match[1].split(/\r?\n/)[0].trim();
    }
    return undefined;
}
function detectValidationType(key, schemaValue) {
    if (typeof schemaValue === 'string') {
        const lowered = schemaValue.toLowerCase();
        if (lowered.includes('email'))
            return 'email';
        if (lowered.includes('phone'))
            return 'phone';
        if (lowered.includes('date'))
            return 'date';
        if (lowered.includes('url'))
            return 'url';
        if (lowered.includes('number'))
            return 'number';
        if (lowered.includes('boolean'))
            return 'boolean';
    }
    const normalised = key.toLowerCase();
    if (normalised.includes('email'))
        return 'email';
    if (normalised.includes('phone'))
        return 'phone';
    if (normalised.includes('date'))
        return normalised.includes('iso') ? 'iso_date' : 'date';
    if (normalised.includes('url') || normalised.includes('link'))
        return 'url';
    if (normalised.includes('count') || normalised.includes('number') || normalised.includes('total')) {
        return 'number';
    }
    if (normalised.includes('flag') || normalised.startsWith('is_') || normalised.startsWith('has_')) {
        return 'boolean';
    }
    if (normalised.includes('ids') || normalised.includes('numbers'))
        return 'number_array';
    if (normalised.includes('list') || normalised.includes('tags'))
        return 'string_array';
    return 'string';
}
function isFieldOptional(schemaValue) {
    if (schemaValue && typeof schemaValue === 'object' && 'optional' in schemaValue) {
        return Boolean(schemaValue.optional);
    }
    return false;
}
function humaniseKey(key) {
    return key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function buildSearchInstruction(humanKey, validationType, instructions) {
    const base = `Locate the value for "${humanKey}"`;
    const guidance = {
        email: 'Prefer RFC compliant email addresses.',
        phone: 'Return the primary phone number including country code when available.',
        date: 'Return the most relevant date mentioned (dd/mm/yyyy accepted).',
        iso_date: 'Return the ISO-8601 date representation (YYYY-MM-DD).',
        url: 'Return the main URL or link that matches the request.',
        number: 'Return a numeric value; remove formatting characters.',
        number_array: 'Return numeric values as an array.',
        string_array: 'Return textual values as an array.',
        boolean: 'Return true/false based on clear affirmative language.',
        string: 'Return the literal text response.',
        object: 'Return structured JSON describing the field.',
        custom: 'Apply custom logic described by the caller.'
    };
    const suffix = guidance[validationType] ?? guidance.string;
    const hint = instructions ? ` Consider caller instructions: ${instructions}` : '';
    return `${base}. ${suffix}${hint}`.trim();
}
function detectFormat(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return 'unknown';
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
    }
    if (/<[a-z][\s\S]*>/i.test(trimmed)) {
        return 'html';
    }
    if (trimmed.includes(',')) {
        return 'csv-like';
    }
    return 'text';
}
function estimateComplexity(fieldCount, length) {
    if (fieldCount <= 3 && length < 5000)
        return 'low';
    if (fieldCount <= 8 && length < 20000)
        return 'medium';
    return 'high';
}
function estimateTokenCost(fieldCount, length) {
    const base = Math.ceil(length / 4); // rough token estimate
    return Math.min(2000, base + fieldCount * 32);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function weightedConfidence(entries) {
    if (entries.length === 0) {
        return 0;
    }
    const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
    if (totalWeight === 0) {
        return 0;
    }
    const weightedSum = entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
    return clamp(weightedSum / totalWeight, 0, 1);
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function createEmptyPlan(request, config) {
    return {
        id: 'plan_empty',
        version: '1.0',
        steps: Object.keys(request.outputSchema).map(key => ({
            targetKey: key,
            description: `Pending extraction for ${humaniseKey(key)}`,
            searchInstruction: 'No plan available.',
            validationType: 'string',
            isRequired: true
        })),
        strategy: config.defaultStrategy,
        confidenceThreshold: config.minConfidence,
        metadata: {
            detectedFormat: detectFormat(request.inputData ?? ''),
            complexity: 'high',
            estimatedTokens: 0,
            origin: 'heuristic'
        }
    };
}
function createFailureResponse(options) {
    const { error, plan, requestId, diagnostics } = options;
    const metadata = {
        architectPlan: plan,
        confidence: 0,
        tokensUsed: options.tokensUsed ?? 0,
        processingTimeMs: options.processingTimeMs ?? 0,
        architectTokens: 0,
        extractorTokens: 0,
        requestId,
        timestamp: new Date().toISOString(),
        diagnostics
    };
    return {
        success: false,
        parsedData: {},
        metadata,
        error
    };
}
function toParseError(error, stage) {
    if (isParseError(error)) {
        return error;
    }
    return {
        code: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Unknown error',
        stage
    };
}
function isParseError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error &&
        'stage' in error);
}
//# sourceMappingURL=index.js.map