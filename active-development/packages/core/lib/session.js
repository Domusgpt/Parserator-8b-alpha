"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseratorSession = void 0;
const utils_1 = require("./utils");
class ParseratorSession {
    constructor(params) {
        this.params = params;
        this.createdAt = new Date();
        this.startTime = Date.now();
    }
    get id() {
        return this.params.requestId;
    }
    getSnapshot() {
        return {
            requestId: this.params.requestId,
            request: this.params.request,
            createdAt: this.createdAt.toISOString(),
            architectResult: this.architectResult,
            extractorResult: this.extractorResult
        };
    }
    async run() {
        await this.safeNotify({
            type: 'session:created',
            requestId: this.id,
            request: this.params.request,
            config: this.params.config
        });
        try {
            await this.ensureValidated();
        }
        catch (error) {
            const parseError = (0, utils_1.toParseError)(error, 'validation');
            const response = (0, utils_1.createFailureResponse)({
                error: parseError,
                plan: (0, utils_1.createEmptyPlan)(this.params.request, this.params.config),
                requestId: this.id,
                diagnostics: [
                    {
                        field: '*',
                        stage: 'validation',
                        message: parseError.message,
                        severity: 'error'
                    }
                ],
                processingTimeMs: Date.now() - this.startTime
            });
            this.params.logger.warn?.('parserator-core:session-validation-failed', {
                requestId: this.id,
                message: parseError.message
            });
            await this.safeNotify({ type: 'parse:failed', requestId: this.id, response });
            return response;
        }
        const architectResult = await this.plan();
        if (!architectResult.success || !architectResult.searchPlan) {
            const response = this.handleArchitectFailure(architectResult);
            await this.safeNotify({ type: 'parse:failed', requestId: this.id, response });
            return response;
        }
        const extractorResult = await this.extract(architectResult.searchPlan);
        if (!extractorResult.success || !extractorResult.parsedData) {
            const response = this.handleExtractorFailure(architectResult, extractorResult);
            await this.safeNotify({ type: 'parse:failed', requestId: this.id, response });
            return response;
        }
        const totalTokens = architectResult.tokensUsed + extractorResult.tokensUsed;
        const confidence = (0, utils_1.clamp)(architectResult.confidence * 0.35 + extractorResult.confidence * 0.65, 0, 1);
        const threshold = this.params.request.options?.confidenceThreshold ?? this.params.config.minConfidence;
        const metadata = {
            architectPlan: architectResult.searchPlan,
            confidence,
            tokensUsed: totalTokens,
            processingTimeMs: Date.now() - this.startTime,
            architectTokens: architectResult.tokensUsed,
            extractorTokens: extractorResult.tokensUsed,
            requestId: this.id,
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
            if (!this.params.config.enableFieldFallbacks) {
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
        this.params.logger.info?.('parserator-core:session-completed', {
            requestId: this.id,
            success: response.success,
            confidence,
            tokensUsed: totalTokens
        });
        await this.safeNotify({ type: 'parse:completed', requestId: this.id, response });
        return response;
    }
    async plan() {
        await this.ensureValidated();
        if (this.architectResult) {
            return this.architectResult;
        }
        await this.safeNotify({ type: 'architect:started', requestId: this.id });
        try {
            const result = await this.params.architect.createPlan({
                inputData: this.params.request.inputData,
                outputSchema: this.params.request.outputSchema,
                instructions: this.params.request.instructions,
                options: this.params.request.options,
                config: this.params.config
            });
            this.architectResult = result;
            if (result.success && result.searchPlan) {
                await this.safeNotify({
                    type: 'architect:completed',
                    requestId: this.id,
                    result
                });
            }
            else {
                await this.safeNotify({
                    type: 'architect:failed',
                    requestId: this.id,
                    result
                });
            }
            return result;
        }
        catch (error) {
            const failure = this.normaliseArchitectError(error);
            this.architectResult = failure;
            await this.safeNotify({
                type: 'architect:failed',
                requestId: this.id,
                result: failure
            });
            return failure;
        }
    }
    async extract(plan) {
        await this.ensureValidated();
        if (this.extractorResult) {
            return this.extractorResult;
        }
        await this.safeNotify({ type: 'extractor:started', requestId: this.id, plan });
        try {
            const result = await this.params.extractor.execute({
                inputData: this.params.request.inputData,
                plan,
                config: this.params.config
            });
            this.extractorResult = result;
            await this.safeNotify({
                type: result.success ? 'extractor:completed' : 'extractor:failed',
                requestId: this.id,
                result
            });
            return result;
        }
        catch (error) {
            const failure = this.normaliseExtractorError(error);
            this.extractorResult = failure;
            await this.safeNotify({
                type: 'extractor:failed',
                requestId: this.id,
                result: failure
            });
            return failure;
        }
    }
    async ensureValidated() {
        if (!this.validationPromise) {
            this.validationPromise = this.performValidation();
        }
        return this.validationPromise;
    }
    async performValidation() {
        const validationStart = Date.now();
        (0, utils_1.validateRequest)(this.params.request, this.params.config);
        await this.safeNotify({
            type: 'request:validated',
            requestId: this.id,
            validationTimeMs: Date.now() - validationStart
        });
    }
    handleArchitectFailure(result) {
        const diagnostics = result.diagnostics.length
            ? [...result.diagnostics]
            : [
                {
                    field: '*',
                    stage: 'architect',
                    message: result.error?.message || 'Architect was unable to generate a search plan',
                    severity: 'error'
                }
            ];
        const response = (0, utils_1.createFailureResponse)({
            error: result.error ?? {
                code: 'ARCHITECT_FAILED',
                message: 'Architect was unable to generate a search plan',
                stage: 'architect'
            },
            plan: result.searchPlan ?? (0, utils_1.createEmptyPlan)(this.params.request, this.params.config),
            requestId: this.id,
            diagnostics,
            tokensUsed: result.tokensUsed,
            processingTimeMs: Date.now() - this.startTime
        });
        this.params.logger.error?.('parserator-core:session-architect-failed', {
            requestId: this.id,
            message: response.error?.message
        });
        return response;
    }
    handleExtractorFailure(architectResult, extractorResult) {
        const fallbackDiagnostic = {
            field: '*',
            stage: 'extractor',
            message: extractorResult.error?.message || 'Extractor failed to resolve required fields',
            severity: 'error'
        };
        const diagnostics = [
            ...architectResult.diagnostics,
            ...extractorResult.diagnostics
        ];
        if (!extractorResult.success) {
            diagnostics.push(fallbackDiagnostic);
        }
        const response = (0, utils_1.createFailureResponse)({
            error: extractorResult.error ?? {
                code: 'EXTRACTOR_FAILED',
                message: 'Extractor failed to resolve required fields',
                stage: 'extractor'
            },
            plan: architectResult.searchPlan ?? (0, utils_1.createEmptyPlan)(this.params.request, this.params.config),
            requestId: this.id,
            diagnostics,
            tokensUsed: architectResult.tokensUsed + extractorResult.tokensUsed,
            processingTimeMs: Date.now() - this.startTime
        });
        this.params.logger.error?.('parserator-core:session-extractor-failed', {
            requestId: this.id,
            message: response.error?.message
        });
        return response;
    }
    normaliseArchitectError(error) {
        const parseError = (0, utils_1.toParseError)(error, 'architect');
        const diagnostic = {
            field: '*',
            stage: 'architect',
            message: parseError.message,
            severity: 'error'
        };
        return {
            success: false,
            tokensUsed: 0,
            processingTimeMs: 0,
            confidence: 0,
            diagnostics: [diagnostic],
            error: parseError
        };
    }
    normaliseExtractorError(error) {
        const parseError = (0, utils_1.toParseError)(error, 'extractor');
        const diagnostic = {
            field: '*',
            stage: 'extractor',
            message: parseError.message,
            severity: 'error'
        };
        return {
            success: false,
            parsedData: {},
            tokensUsed: 0,
            processingTimeMs: 0,
            confidence: 0,
            diagnostics: [diagnostic],
            error: parseError
        };
    }
    async safeNotify(event) {
        try {
            await this.params.notify(event);
        }
        catch (error) {
            this.params.logger.warn?.('parserator-core:observer-notify-failed', {
                requestId: this.id,
                event: event.type,
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
exports.ParseratorSession = ParseratorSession;
//# sourceMappingURL=session.js.map