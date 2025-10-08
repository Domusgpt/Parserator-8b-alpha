import { v4 as uuidv4 } from 'uuid';

import {
  ArchitectAgent,
  ArchitectContext,
  ArchitectResult,
  CoreLogger,
  ExtractorAgent,
  ExtractorContext,
  ExtractorResult,
  ParseDiagnostic,
  ParseError,
  ParseMetadata,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
  ParseratorCoreOptions,
  SearchPlan,
  SearchStep,
  ValidationType
} from './types';

export * from './types';

const DEFAULT_CONFIG: ParseratorCoreConfig = {
  maxInputLength: 120_000,
  maxSchemaFields: 64,
  minConfidence: 0.55,
  defaultStrategy: 'sequential',
  enableFieldFallbacks: true
};

const DEFAULT_LOGGER: CoreLogger = createDefaultLogger();

function createDefaultLogger(): CoreLogger {
  const globalConsole = (globalThis as any).console;
  if (globalConsole) {
    return {
      debug: (...args: unknown[]) => globalConsole.debug?.(...args),
      info: (...args: unknown[]) => globalConsole.info?.(...args),
      warn: (...args: unknown[]) => globalConsole.warn?.(...args),
      error: (...args: unknown[]) => globalConsole.error?.(...args)
    };
  }

  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

export class ParseratorCore {
  private readonly apiKey: string;
  private config: ParseratorCoreConfig;
  private logger: CoreLogger;
  private architect: ArchitectAgent;
  private extractor: ExtractorAgent;

  constructor(options: ParseratorCoreOptions) {
    if (!options?.apiKey || options.apiKey.trim().length === 0) {
      throw new Error('ParseratorCore requires a non-empty apiKey');
    }

    this.apiKey = options.apiKey;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.architect = options.architect ?? new HeuristicArchitect(this.logger);
    this.extractor = options.extractor ?? new RegexExtractor(this.logger);
  }

  /**
   * Update runtime configuration while keeping the same agents.
   */
  updateConfig(partial: Partial<ParseratorCoreConfig>): void {
    this.config = { ...this.config, ...partial };
    this.logger.info?.('parserator-core:config-updated', { config: this.config });
  }

  /**
   * Swap in a custom architect agent.
   */
  setArchitect(agent: ArchitectAgent): void {
    this.architect = agent;
  }

  /**
   * Swap in a custom extractor agent.
   */
  setExtractor(agent: ExtractorAgent): void {
    this.extractor = agent;
  }

  /**
   * Execute the two-stage parse flow. The default implementation uses
   * a heuristic architect and regex-driven extractor so developers and
   * agents get useful behaviour without provisioning LLM credentials.
   */
  async parse(request: ParseRequest): Promise<ParseResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      this.validateRequest(request);
    } catch (error) {
      const parseError = toParseError(error, 'validation');
      return createFailureResponse({
        error: parseError,
        plan: createEmptyPlan(request, this.config),
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
      const fallbackDiagnostic: ParseDiagnostic = {
        field: '*',
        stage: 'architect',
        message:
          architectResult.error?.message ||
          'Architect was unable to generate a search plan',
        severity: 'error'
      };

      const diagnostics = architectResult.diagnostics.length
        ? architectResult.diagnostics
        : [fallbackDiagnostic];

      return createFailureResponse({
        error:
          architectResult.error ?? {
            code: 'ARCHITECT_FAILED',
            message: 'Architect was unable to generate a search plan',
            stage: 'architect'
          },
        plan: architectResult.searchPlan ?? createEmptyPlan(request, this.config),
        requestId,
        diagnostics,
        tokensUsed: architectResult.tokensUsed,
        processingTimeMs: Date.now() - startTime
      });
    }

    const extractorResult = await this.extractor.execute({
      inputData: request.inputData,
      plan: architectResult.searchPlan,
      config: this.config
    });

    if (!extractorResult.success || !extractorResult.parsedData) {
      const fallbackDiagnostic: ParseDiagnostic = {
        field: '*',
        stage: 'extractor',
        message:
          extractorResult.error?.message ||
          'Extractor failed to resolve required fields',
        severity: 'error'
      };

      const diagnostics = [
        ...architectResult.diagnostics,
        ...extractorResult.diagnostics,
        ...(extractorResult.success ? [] : [fallbackDiagnostic])
      ];

      return createFailureResponse({
        error:
          extractorResult.error ?? {
            code: 'EXTRACTOR_FAILED',
            message: 'Extractor failed to resolve required fields',
            stage: 'extractor'
          },
        plan: architectResult.searchPlan,
        requestId,
        diagnostics,
        tokensUsed: architectResult.tokensUsed + extractorResult.tokensUsed,
        processingTimeMs: Date.now() - startTime
      });
    }

    const totalTokens = architectResult.tokensUsed + extractorResult.tokensUsed;
    const confidence = clamp(
      architectResult.confidence * 0.35 + extractorResult.confidence * 0.65,
      0,
      1
    );
    const threshold = request.options?.confidenceThreshold ?? this.config.minConfidence;

    const metadata: ParseMetadata = {
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

    let error: ParseError | undefined;
    if (confidence < threshold) {
      const warning: ParseDiagnostic = {
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

  private validateRequest(request: ParseRequest): void {
    if (!request.inputData || typeof request.inputData !== 'string') {
      throw new Error('inputData must be a non-empty string');
    }

    const trimmed = request.inputData.trim();
    if (trimmed.length === 0) {
      throw new Error('inputData cannot be empty or whitespace');
    }

    if (trimmed.length > this.config.maxInputLength) {
      throw new Error(
        `inputData length ${trimmed.length} exceeds maximum ${this.config.maxInputLength}`
      );
    }

    if (!request.outputSchema || typeof request.outputSchema !== 'object') {
      throw new Error('outputSchema must be an object describing the expected fields');
    }

    const fields = Object.keys(request.outputSchema);
    if (fields.length === 0) {
      throw new Error('outputSchema must contain at least one field');
    }

    if (fields.length > this.config.maxSchemaFields) {
      throw new Error(
        `outputSchema has ${fields.length} fields which exceeds the limit of ${this.config.maxSchemaFields}`
      );
    }

    if (request.instructions !== undefined && typeof request.instructions !== 'string') {
      throw new Error('instructions must be a string when provided');
    }
  }
}

class HeuristicArchitect implements ArchitectAgent {
  constructor(private readonly logger: CoreLogger) {}

  async createPlan(context: ArchitectContext): Promise<ArchitectResult> {
    const start = Date.now();
    const diagnostics: ParseDiagnostic[] = [];
    const fields = Object.keys(context.outputSchema);

    const steps: SearchStep[] = fields.map(field => {
      const schemaValue = context.outputSchema[field];
      const validationType = detectValidationType(field, schemaValue);
      const isRequired = !isFieldOptional(schemaValue);
      const humanKey = humaniseKey(field);

      const searchInstruction = buildSearchInstruction(
        humanKey,
        validationType,
        context.instructions
      );

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

    const plan: SearchPlan = {
      id: `plan_${Date.now().toString(36)}`,
      version: '1.0',
      steps,
      strategy: context.config.defaultStrategy,
      confidenceThreshold:
        context.options?.confidenceThreshold ?? context.config.minConfidence,
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

class RegexExtractor implements ExtractorAgent {
  constructor(private readonly logger: CoreLogger) {}

  async execute(context: ExtractorContext): Promise<ExtractorResult> {
    const start = Date.now();
    const parsed: Record<string, unknown> = {};
    const diagnostics: ParseDiagnostic[] = [];
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
    const tokensUsed = Math.max(
      72,
      Math.round(context.plan.metadata.estimatedTokens * 0.7)
    );

    const confidence = context.plan.steps.length
      ? (resolvedRequired + (context.plan.steps.length - requiredCount) * 0.6) /
        context.plan.steps.length
      : 0;

    let error: ParseError | undefined;
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

interface FieldExtractionResult {
  value?: unknown;
  diagnostics: ParseDiagnostic[];
}

function extractField(input: string, step: SearchStep): FieldExtractionResult {
  const diagnostics: ParseDiagnostic[] = [];
  let value: unknown;

  switch (step.validationType) {
    case 'email':
      value = matchFirst(input, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      break;
    case 'phone':
      value = matchFirst(
        input,
        /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)[\d\s-]{7,}/
      );
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

function matchFirst(input: string, regex: RegExp): string | undefined {
  const match = input.match(regex);
  return match ? match[0].trim() : undefined;
}

function matchNumber(input: string): number | undefined {
  const match = input.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function matchBoolean(input: string): boolean | undefined {
  const lowered = input.toLowerCase();
  if (/(^|\b)(true|yes|enabled)(\b|$)/.test(lowered)) {
    return true;
  }
  if (/(^|\b)(false|no|disabled)(\b|$)/.test(lowered)) {
    return false;
  }
  return undefined;
}

function matchList(input: string, key: string, numeric: boolean): unknown[] | undefined {
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
      .filter((match): match is RegExpMatchArray => !!match)
      .map(match => Number(match[0]));
    return numbers.length ? numbers : undefined;
  }

  return items;
}

function matchByLabel(input: string, key: string): string | undefined {
  const labelPattern = new RegExp(`${escapeRegExp(key)}\\s*[:\-]?\\s*(.+)`, 'i');
  const match = input.match(labelPattern);
  if (match) {
    return match[1].split(/\r?\n/)[0].trim();
  }
  return undefined;
}

function detectValidationType(key: string, schemaValue: unknown): ValidationType {
  if (typeof schemaValue === 'string') {
    const lowered = schemaValue.toLowerCase();
    if (lowered.includes('email')) return 'email';
    if (lowered.includes('phone')) return 'phone';
    if (lowered.includes('date')) return 'date';
    if (lowered.includes('url')) return 'url';
    if (lowered.includes('number')) return 'number';
    if (lowered.includes('boolean')) return 'boolean';
  }

  const normalised = key.toLowerCase();
  if (normalised.includes('email')) return 'email';
  if (normalised.includes('phone')) return 'phone';
  if (normalised.includes('date')) return normalised.includes('iso') ? 'iso_date' : 'date';
  if (normalised.includes('url') || normalised.includes('link')) return 'url';
  if (normalised.includes('count') || normalised.includes('number') || normalised.includes('total')) {
    return 'number';
  }
  if (normalised.includes('flag') || normalised.startsWith('is_') || normalised.startsWith('has_')) {
    return 'boolean';
  }
  if (normalised.includes('ids') || normalised.includes('numbers')) return 'number_array';
  if (normalised.includes('list') || normalised.includes('tags')) return 'string_array';

  return 'string';
}

function isFieldOptional(schemaValue: unknown): boolean {
  if (schemaValue && typeof schemaValue === 'object' && 'optional' in (schemaValue as Record<string, unknown>)) {
    return Boolean((schemaValue as Record<string, unknown>).optional);
  }

  return false;
}

function humaniseKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchInstruction(
  humanKey: string,
  validationType: ValidationType,
  instructions?: string
): string {
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
  } as Record<ValidationType, string>;

  const suffix = guidance[validationType] ?? guidance.string;
  const hint = instructions ? ` Consider caller instructions: ${instructions}` : '';
  return `${base}. ${suffix}${hint}`.trim();
}

function detectFormat(input: string): string {
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

function estimateComplexity(fieldCount: number, length: number): 'low' | 'medium' | 'high' {
  if (fieldCount <= 3 && length < 5_000) return 'low';
  if (fieldCount <= 8 && length < 20_000) return 'medium';
  return 'high';
}

function estimateTokenCost(fieldCount: number, length: number): number {
  const base = Math.ceil(length / 4); // rough token estimate
  return Math.min(2000, base + fieldCount * 32);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createEmptyPlan(request: ParseRequest, config: ParseratorCoreConfig): SearchPlan {
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

interface FailureResponseOptions {
  error: ParseError;
  plan: SearchPlan;
  requestId: string;
  diagnostics: ParseDiagnostic[];
  tokensUsed?: number;
  processingTimeMs?: number;
}

function createFailureResponse(options: FailureResponseOptions): ParseResponse {
  const { error, plan, requestId, diagnostics } = options;

  const metadata: ParseMetadata = {
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

function toParseError(error: unknown, stage: ParseError['stage']): ParseError {
  if (isParseError(error)) {
    return error;
  }

  return {
    code: 'INVALID_REQUEST',
    message: error instanceof Error ? error.message : 'Unknown error',
    stage
  };
}

function isParseError(error: unknown): error is ParseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'stage' in error
  );
}

export { HeuristicArchitect, RegexExtractor };
