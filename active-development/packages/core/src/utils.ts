import {
  ParseDiagnostic,
  ParseError,
  ParseMetadata,
  ParseRequest,
  ParseResponse,
  ParserFallbackSummary,
  ParseratorCoreConfig,
  ParseratorPlanCacheKeyInput,
  SearchPlan
} from './types';
import { detectFormat, humaniseKey } from './heuristics';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createEmptyPlan(
  request: ParseRequest,
  config: ParseratorCoreConfig
): SearchPlan {
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

export function clonePlan(
  plan: SearchPlan,
  originOverride?: SearchPlan['metadata']['origin']
): SearchPlan {
  return {
    ...plan,
    steps: plan.steps.map(step => ({ ...step })),
    metadata: {
      ...plan.metadata,
      origin: originOverride ?? plan.metadata.origin
    }
  };
}

export interface FailureResponseOptions {
  error: ParseError;
  plan: SearchPlan;
  requestId: string;
  diagnostics: ParseDiagnostic[];
  tokensUsed?: number;
  processingTimeMs?: number;
  architectTokens?: number;
  extractorTokens?: number;
  stageBreakdown?: ParseMetadata['stageBreakdown'];
  fallbackSummary?: ParserFallbackSummary;
}

export function createFailureResponse(options: FailureResponseOptions): ParseResponse {
  const { error, plan, requestId, diagnostics } = options;

  const metadata: ParseMetadata = {
    architectPlan: plan,
    confidence: 0,
    tokensUsed: options.tokensUsed ?? 0,
    processingTimeMs: options.processingTimeMs ?? 0,
    architectTokens: options.architectTokens ?? 0,
    extractorTokens: options.extractorTokens ?? 0,
    requestId,
    timestamp: new Date().toISOString(),
    diagnostics,
    stageBreakdown:
      options.stageBreakdown ?? {
        architect: {
          timeMs: options.processingTimeMs ?? 0,
          tokens: options.architectTokens ?? 0,
          confidence: 0
        },
        extractor: {
          timeMs: 0,
          tokens: options.extractorTokens ?? 0,
          confidence: 0
        }
      }
  };

  if (options.fallbackSummary) {
    metadata.fallback = options.fallbackSummary;
  }

  return {
    success: false,
    parsedData: {},
    metadata,
    error
  };
}

export function toParseError(error: unknown, stage: ParseError['stage']): ParseError {
  if (isParseError(error)) {
    return error;
  }

  return {
    code: 'INVALID_REQUEST',
    message: error instanceof Error ? error.message : 'Unknown error',
    stage
  };
}

export function isParseError(error: unknown): error is ParseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'stage' in error
  );
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalise(value));
}

export function createPlanCacheKey(input: ParseratorPlanCacheKeyInput): string {
  return stableStringify({
    profile: input.profile ?? 'default',
    schema: stableStringify(input.outputSchema),
    instructions: input.instructions ?? '',
    options: input.options ? stableStringify(input.options) : undefined
  });
}

function normalise(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalise);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, normalise(val)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = val;
      return acc;
    }, {});
  }

  return value;
}

export function validateParseRequest(
  request: ParseRequest,
  config: ParseratorCoreConfig
): void {
  if (!request.inputData || typeof request.inputData !== 'string') {
    throw new Error('inputData must be a non-empty string');
  }

  const trimmed = request.inputData.trim();
  if (trimmed.length === 0) {
    throw new Error('inputData cannot be empty or whitespace');
  }

  if (trimmed.length > config.maxInputLength) {
    throw new Error(
      `inputData length ${trimmed.length} exceeds maximum ${config.maxInputLength}`
    );
  }

  if (!request.outputSchema || typeof request.outputSchema !== 'object') {
    throw new Error('outputSchema must be an object describing the expected fields');
  }

  const fields = Object.keys(request.outputSchema);
  if (fields.length === 0) {
    throw new Error('outputSchema must contain at least one field');
  }

  if (fields.length > config.maxSchemaFields) {
    throw new Error(
      `outputSchema has ${fields.length} fields which exceeds the limit of ${config.maxSchemaFields}`
    );
  }

  if (request.instructions !== undefined && typeof request.instructions !== 'string') {
    throw new Error('instructions must be a string when provided');
  }
}
