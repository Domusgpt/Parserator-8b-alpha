/**
 * Core TypeScript interfaces for the Parserator Node.js SDK
 * Implements the Architect-Extractor pattern for intelligent data parsing
 */

// Core API Request/Response Types
export interface ParseRequest {
  inputData: string;
  outputSchema: Record<string, any>;
  instructions?: string;
  options?: ParseOptions;
}

export interface ParseOptions {
  timeout?: number;
  retries?: number;
  validateOutput?: boolean;
  includeMetadata?: boolean;
  confidenceThreshold?: number;
}

export interface ParseResponse {
  success: boolean;
  parsedData: Record<string, any>;
  metadata: ParseMetadata;
  error?: ParseError;
}

export interface StageBreakdownMetrics {
  timeMs: number;
  tokens: number;
  confidence: number;
  runs?: number;
}

export interface ParseDiagnostic {
  field: string;
  stage: 'preprocess' | 'validation' | 'architect' | 'extractor' | 'postprocess';
  message: string;
  severity: 'info' | 'warning' | 'error';
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
  stageBreakdown: {
    preprocess?: StageBreakdownMetrics;
    architect: StageBreakdownMetrics;
    extractor: StageBreakdownMetrics;
    postprocess?: StageBreakdownMetrics;
  };
  fallback?: ParserFallbackSummary;
}

// Architect-Extractor Pattern Types
export interface SearchStep {
  targetKey: string;
  description: string;
  searchInstruction: string;
  validationType: ValidationType;
  isRequired: boolean;
  confidence?: number;
  fallbackValue?: any;
}

export interface SearchPlan {
  steps: SearchStep[];
  strategy: 'sequential' | 'parallel' | 'adaptive';
  confidenceThreshold: number;
  metadata: {
    detectedFormat: string;
    complexity: 'low' | 'medium' | 'high';
    estimatedTokens: number;
    origin: 'heuristic' | 'model' | 'cached';
    context?: DetectedSystemContext;
    plannerConfidence?: number;
  };
}

export interface DetectedSystemContext {
  id: string;
  label: string;
  confidence: number;
  matchedFields: string[];
  matchedInstructionTerms: string[];
  rationale: string[];
}

export type LeanLLMFallbackUsageAction = 'invoked' | 'reused' | 'skipped';

export interface LeanLLMFallbackFieldUsage {
  field: string;
  action: LeanLLMFallbackUsageAction;
  resolved?: boolean;
  confidence?: number;
  tokensUsed?: number;
  reason?: string;
  sourceField?: string;
  sharedKeys?: string[];
  plannerConfidence?: number;
  gate?: number;
  error?: string;
}

export interface LeanLLMFallbackUsageSummary {
  totalInvocations: number;
  resolvedFields: number;
  reusedResolutions: number;
  skippedByPlanConfidence: number;
  sharedExtractions: number;
  totalTokens: number;
  planConfidenceGate?: number;
  fields: LeanLLMFallbackFieldUsage[];
}

export interface ParserFallbackSummary {
  leanLLM?: LeanLLMFallbackUsageSummary;
}

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
  | 'currency'
  | 'percentage'
  | 'address'
  | 'name'
  | 'object'
  | 'custom';

// Error Types
export interface ParseError {
  code: ErrorCode;
  message: string;
  stage?: 'validation' | 'preprocess' | 'architect' | 'extractor' | 'postprocess' | 'orchestration';
  details?: Record<string, any>;
  suggestion?: string;
}

export type ErrorCode =
  | 'INVALID_API_KEY'
  | 'INVALID_INPUT'
  | 'INVALID_SCHEMA'
  | 'RATE_LIMIT_EXCEEDED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PARSE_FAILED'
  | 'VALIDATION_FAILED'
  | 'INSUFFICIENT_CONFIDENCE'
  | 'QUOTA_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

// Client Configuration
export interface ParseratorConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  defaultOptions?: ParseOptions;
  debug?: boolean;
}

// Batch Processing Types
export interface BatchParseRequest {
  items: ParseRequest[];
  options?: BatchOptions;
}

export interface BatchOptions {
  concurrency?: number;
  failFast?: boolean;
  preserveOrder?: boolean;
}

export interface BatchParseResponse {
  results: (ParseResponse | ParseError)[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalTokensUsed: number;
    totalProcessingTimeMs: number;
  };
}

// Schema Management Types
export interface SchemaTemplate {
  name: string;
  description: string;
  schema: Record<string, any>;
  examples: string[];
  tags: string[];
  version: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  suggestions: string[];
}

export interface SchemaValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

// Utility Types
export interface ProgressCallback {
  (progress: {
    completed: number;
    total: number;
    currentItem?: string;
    estimatedTimeRemaining?: number;
  }): void;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

// Event Types for Advanced Usage
export interface ParseEvent {
  type: 'start' | 'architect_complete' | 'extractor_start' | 'complete' | 'error';
  timestamp: string;
  data: any;
}

export type EventHandler = (event: ParseEvent) => void;

// Template and Preset Types
export interface ParsePreset {
  name: string;
  description: string;
  outputSchema: Record<string, any>;
  instructions: string;
  examples: Array<{
    input: string;
    expectedOutput: Record<string, any>;
  }>;
  options: ParseOptions;
}

// Advanced Configuration
export interface AdvancedConfig {
  architectModel?: string;
  extractorModel?: string;
  customEndpoints?: {
    architect?: string;
    extractor?: string;
  };
  fallbackStrategies?: string[];
  caching?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

// Export all types for easy importing
export * from './validation';
export * from './presets';
