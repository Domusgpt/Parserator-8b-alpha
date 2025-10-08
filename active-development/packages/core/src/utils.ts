import {
  ParseDiagnostic,
  ParseError,
  ParseMetadata,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
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

export interface FailureResponseOptions {
  error: ParseError;
  plan: SearchPlan;
  requestId: string;
  diagnostics: ParseDiagnostic[];
  tokensUsed?: number;
  processingTimeMs?: number;
}

export function createFailureResponse(options: FailureResponseOptions): ParseResponse {
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
