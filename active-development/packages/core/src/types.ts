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
  stage: 'architect' | 'extractor' | 'validation' | 'fallback' | 'postprocess';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ParseError {
  code: string;
  message: string;
  stage: 'validation' | 'architect' | 'extractor' | 'fallback' | 'postprocess' | 'orchestration';
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
  fallbackTokens?: number;
  fallbackUsed?: boolean;
  kernelSnapshotId?: string;
  requestId: string;
  timestamp: string;
  diagnostics: ParseDiagnostic[];
}

export interface ParseResponse {
  success: boolean;
  parsedData: Record<string, unknown>;
  metadata: ParseMetadata;
  error?: ParseError;
  snapshot?: KernelSnapshot;
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
  enableExtractorFallbacks: boolean;
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
  fallbackExtractor?: ExtractorAgent;
  postProcessors?: KernelPostProcessor[];
  observers?: KernelObserver[];
}

export type KernelStage = 'validation' | 'plan' | 'extract' | 'fallback' | 'postprocess';

export type KernelStageStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped';

export type KernelEventType = 'started' | 'finished' | 'failed';

export interface KernelEvent<T = unknown> {
  stage: KernelStage;
  type: KernelEventType;
  timestamp: string;
  payload?: T;
}

export type KernelObserver = (event: KernelEvent) => void | Promise<void>;

export interface KernelStageState {
  status: KernelStageStatus;
  startedAt?: string;
  finishedAt?: string;
  diagnostics: ParseDiagnostic[];
  metadata?: Record<string, unknown>;
  error?: ParseError;
}

export interface KernelSnapshot {
  requestId: string;
  startedAt: string;
  finishedAt?: string;
  stages: Record<KernelStage, KernelStageState>;
}

export interface KernelPostProcessor {
  name: string;
  process(
    response: ParseResponse,
    context: { request: ParseRequest; config: ParseratorCoreConfig; snapshot: KernelSnapshot }
  ): Promise<ParseResponse> | ParseResponse;
}
