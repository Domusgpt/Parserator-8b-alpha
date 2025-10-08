/**
 * Shared type definitions for the Parserator core package.
 * The goal is to provide a lightweight, agent-friendly set of
 * abstractions that model the two-stage Architect → Extractor
 * workflow without locking consumers into rigid orchestration
 * layers.
 */

export type ValidationType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'date'
  | 'iso_date'
  | 'url'
  | 'string_array'
  | 'number_array'
  | 'object'
  | 'custom';

export interface SearchStep {
  targetKey: string;
  description: string;
  searchInstruction: string;
  validationType: ValidationType;
  isRequired: boolean;
}

export interface SearchPlan {
  id: string;
  version: string;
  steps: SearchStep[];
  strategy: 'sequential' | 'parallel' | 'adaptive';
  confidenceThreshold: number;
  metadata: {
    detectedFormat: string;
    complexity: 'low' | 'medium' | 'high';
    estimatedTokens: number;
    origin: 'heuristic' | 'model' | 'cached';
  };
}

export interface ParseOptions {
  timeout?: number;
  retries?: number;
  validateOutput?: boolean;
  includeMetadata?: boolean;
  confidenceThreshold?: number;
}

export interface ParseRequest {
  inputData: string;
  outputSchema: Record<string, unknown>;
  instructions?: string;
  options?: ParseOptions;
}

export interface ParseDiagnostic {
  field: string;
  stage: 'architect' | 'extractor' | 'validation';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ParseError {
  code: string;
  message: string;
  stage: 'validation' | 'architect' | 'extractor' | 'orchestration';
  details?: Record<string, unknown>;
  suggestion?: string;
}

export interface ParseMetadata {
  architectPlan: SearchPlan;
  confidence: number;
  tokensUsed: number;
  processingTimeMs: number;
  architectTokens: number;
  extractorTokens: number;
  requestId: string;
  timestamp: string;
  diagnostics: ParseDiagnostic[];
}

export interface ParseResponse {
  success: boolean;
  parsedData: Record<string, unknown>;
  metadata: ParseMetadata;
  error?: ParseError;
}

export interface FieldResolutionContext {
  inputData: string;
  step: SearchStep;
  config: ParseratorCoreConfig;
  logger: CoreLogger;
  shared: Map<string, unknown>;
}

export interface FieldResolutionResult {
  value?: unknown;
  confidence: number;
  diagnostics: ParseDiagnostic[];
  resolver?: string;
}

export interface FieldResolver {
  name: string;
  supports(step: SearchStep): boolean;
  resolve(
    context: FieldResolutionContext
  ): Promise<FieldResolutionResult | undefined> | FieldResolutionResult | undefined;
}

export interface CoreLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface ParseratorCoreConfig {
  maxInputLength: number;
  maxSchemaFields: number;
  minConfidence: number;
  defaultStrategy: SearchPlan['strategy'];
  enableFieldFallbacks: boolean;
}

export interface ArchitectContext {
  inputData: string;
  outputSchema: Record<string, unknown>;
  instructions?: string;
  options?: ParseOptions;
  config: ParseratorCoreConfig;
}

export interface ArchitectResult {
  success: boolean;
  searchPlan?: SearchPlan;
  tokensUsed: number;
  processingTimeMs: number;
  confidence: number;
  diagnostics: ParseDiagnostic[];
  error?: ParseError;
}

export interface ExtractorContext {
  inputData: string;
  plan: SearchPlan;
  config: ParseratorCoreConfig;
}

export interface ExtractorResult {
  success: boolean;
  parsedData?: Record<string, unknown>;
  tokensUsed: number;
  processingTimeMs: number;
  confidence: number;
  diagnostics: ParseDiagnostic[];
  error?: ParseError;
}

export interface ArchitectAgent {
  createPlan(context: ArchitectContext): Promise<ArchitectResult>;
}

export interface ExtractorAgent {
  execute(context: ExtractorContext): Promise<ExtractorResult>;
}

export interface ParseratorCoreOptions {
  apiKey: string;
  config?: Partial<ParseratorCoreConfig>;
  logger?: CoreLogger;
  architect?: ArchitectAgent;
  extractor?: ExtractorAgent;
  resolvers?: FieldResolver[];
  observers?: ParseObserver[];
}

export type ParseLifecycleEvent =
  | {
      type: 'session:created';
      requestId: string;
      request: ParseRequest;
      config: ParseratorCoreConfig;
    }
  | {
      type: 'request:validated';
      requestId: string;
      validationTimeMs: number;
    }
  | {
      type: 'architect:started';
      requestId: string;
    }
  | {
      type: 'architect:completed';
      requestId: string;
      result: ArchitectResult;
    }
  | {
      type: 'architect:failed';
      requestId: string;
      result: ArchitectResult;
    }
  | {
      type: 'extractor:started';
      requestId: string;
      plan: SearchPlan;
    }
  | {
      type: 'extractor:completed';
      requestId: string;
      result: ExtractorResult;
    }
  | {
      type: 'extractor:failed';
      requestId: string;
      result: ExtractorResult;
    }
  | {
      type: 'parse:completed';
      requestId: string;
      response: ParseResponse;
    }
  | {
      type: 'parse:failed';
      requestId: string;
      response: ParseResponse;
    };

export type ParseObserver = (event: ParseLifecycleEvent) => void | Promise<void>;

export interface ParseratorSessionSnapshot {
  requestId: string;
  request: ParseRequest;
  createdAt: string;
  architectResult?: ArchitectResult;
  extractorResult?: ExtractorResult;
}
