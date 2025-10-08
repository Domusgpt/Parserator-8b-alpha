import {
  ArchitectAgent,
  ArchitectResult,
  CoreLogger,
  ExtractorAgent,
  ExtractorResult,
  ParseDiagnostic,
  ParseError,
  ParseLifecycleEvent,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
  ParseratorSessionSnapshot,
  SearchPlan
} from './types';
import {
  clamp,
  createEmptyPlan,
  createFailureResponse,
  toParseError,
  validateRequest
} from './utils';

interface ParseratorSessionParams {
  requestId: string;
  request: ParseRequest;
  config: ParseratorCoreConfig;
  architect: ArchitectAgent;
  extractor: ExtractorAgent;
  logger: CoreLogger;
  notify: (event: ParseLifecycleEvent) => Promise<void>;
}

export class ParseratorSession {
  private readonly createdAt = new Date();
  private readonly startTime = Date.now();
  private architectResult?: ArchitectResult;
  private extractorResult?: ExtractorResult;
  private validationPromise?: Promise<void>;

  constructor(private readonly params: ParseratorSessionParams) {}

  get id(): string {
    return this.params.requestId;
  }

  getSnapshot(): ParseratorSessionSnapshot {
    return {
      requestId: this.params.requestId,
      request: this.params.request,
      createdAt: this.createdAt.toISOString(),
      architectResult: this.architectResult,
      extractorResult: this.extractorResult
    };
  }

  async run(): Promise<ParseResponse> {
    await this.safeNotify({
      type: 'session:created',
      requestId: this.id,
      request: this.params.request,
      config: this.params.config
    });

    try {
      await this.ensureValidated();
    } catch (error) {
      const parseError = toParseError(error, 'validation');
      const response = createFailureResponse({
        error: parseError,
        plan: createEmptyPlan(this.params.request, this.params.config),
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
    const confidence = clamp(
      architectResult.confidence * 0.35 + extractorResult.confidence * 0.65,
      0,
      1
    );
    const threshold =
      this.params.request.options?.confidenceThreshold ?? this.params.config.minConfidence;

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

    let error: ParseError | undefined;
    if (confidence < threshold) {
      const warning: ParseDiagnostic = {
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

    const response: ParseResponse = {
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

  async plan(): Promise<ArchitectResult> {
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
      } else {
        await this.safeNotify({
          type: 'architect:failed',
          requestId: this.id,
          result
        });
      }

      return result;
    } catch (error) {
      const failure = this.normaliseArchitectError(error as Error | unknown);
      this.architectResult = failure;
      await this.safeNotify({
        type: 'architect:failed',
        requestId: this.id,
        result: failure
      });
      return failure;
    }
  }

  async extract(plan: SearchPlan): Promise<ExtractorResult> {
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
    } catch (error) {
      const failure = this.normaliseExtractorError(error as Error | unknown);
      this.extractorResult = failure;
      await this.safeNotify({
        type: 'extractor:failed',
        requestId: this.id,
        result: failure
      });
      return failure;
    }
  }

  private async ensureValidated(): Promise<void> {
    if (!this.validationPromise) {
      this.validationPromise = this.performValidation();
    }

    return this.validationPromise;
  }

  private async performValidation(): Promise<void> {
    const validationStart = Date.now();
    validateRequest(this.params.request, this.params.config);
    await this.safeNotify({
      type: 'request:validated',
      requestId: this.id,
      validationTimeMs: Date.now() - validationStart
    });
  }

  private handleArchitectFailure(result: ArchitectResult): ParseResponse {
    const diagnostics: ParseDiagnostic[] = result.diagnostics.length
      ? [...result.diagnostics]
      : [
          {
            field: '*',
            stage: 'architect',
            message: result.error?.message || 'Architect was unable to generate a search plan',
            severity: 'error'
          }
        ];

    const response = createFailureResponse({
      error:
        result.error ?? {
          code: 'ARCHITECT_FAILED',
          message: 'Architect was unable to generate a search plan',
          stage: 'architect'
        },
      plan: result.searchPlan ?? createEmptyPlan(this.params.request, this.params.config),
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

  private handleExtractorFailure(
    architectResult: ArchitectResult,
    extractorResult: ExtractorResult
  ): ParseResponse {
    const fallbackDiagnostic: ParseDiagnostic = {
      field: '*',
      stage: 'extractor',
      message: extractorResult.error?.message || 'Extractor failed to resolve required fields',
      severity: 'error'
    };

    const diagnostics: ParseDiagnostic[] = [
      ...architectResult.diagnostics,
      ...extractorResult.diagnostics
    ];

    if (!extractorResult.success) {
      diagnostics.push(fallbackDiagnostic);
    }

    const response = createFailureResponse({
      error:
        extractorResult.error ?? {
          code: 'EXTRACTOR_FAILED',
          message: 'Extractor failed to resolve required fields',
          stage: 'extractor'
        },
      plan: architectResult.searchPlan ?? createEmptyPlan(this.params.request, this.params.config),
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

  private normaliseArchitectError(error: unknown): ArchitectResult {
    const parseError = toParseError(error, 'architect');
    const diagnostic: ParseDiagnostic = {
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

  private normaliseExtractorError(error: unknown): ExtractorResult {
    const parseError = toParseError(error, 'extractor');
    const diagnostic: ParseDiagnostic = {
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

  private async safeNotify(event: ParseLifecycleEvent): Promise<void> {
    try {
      await this.params.notify(event);
    } catch (error) {
      this.params.logger.warn?.('parserator-core:observer-notify-failed', {
        requestId: this.id,
        event: event.type,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
