/**
 * Shared type definitions for the Parserator core package.
 * The goal is to provide a lightweight, agent-friendly set of
 * abstractions that model the two-stage Architect → Extractor
 * workflow without locking consumers into rigid orchestration
 * layers.
 */
export type ValidationType = 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'date' | 'iso_date' | 'url' | 'string_array' | 'number_array' | 'currency' | 'percentage' | 'address' | 'name' | 'object' | 'custom';
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
export interface BatchParseOptions {
    /**
     * When true (default) the core will reuse a cached architect plan via a session so
     * additional parses avoid re-running the planner. Disable when each request should
     * create an independent plan.
     */
    reusePlan?: boolean;
    /**
     * Optional seed document to prime the shared plan when {@link reusePlan} is enabled.
     */
    seedInput?: string;
}
export interface ParseDiagnostic {
    field: string;
    stage: 'architect' | 'extractor' | 'validation' | 'orchestration';
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
export interface StageMetrics {
    timeMs: number;
    tokens: number;
    confidence: number;
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
        architect: StageMetrics;
        extractor: StageMetrics;
    };
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
    resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined> | FieldResolutionResult | undefined;
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
export interface ParseratorProfileContext {
    logger: CoreLogger;
}
export interface ParseratorProfileConfig {
    config?: Partial<ParseratorCoreConfig>;
    architect?: ArchitectAgent;
    extractor?: ExtractorAgent;
    resolvers?: FieldResolver[];
}
export interface ParseratorProfile {
    name: string;
    summary: string;
    description: string;
    tags?: string[];
    configure(context: ParseratorProfileContext): ParseratorProfileConfig;
}
export type ParseratorProfileOption = ParseratorProfile | string;
export interface ParseratorCoreOptions {
    apiKey: string;
    config?: Partial<ParseratorCoreConfig>;
    logger?: CoreLogger;
    architect?: ArchitectAgent;
    extractor?: ExtractorAgent;
    resolvers?: FieldResolver[];
    profile?: ParseratorProfileOption;
    telemetry?: ParseratorTelemetry | ParseratorTelemetryListener | ParseratorTelemetryListener[];
    interceptors?: ParseratorInterceptor | ParseratorInterceptor[];
}
export interface ParseratorSessionInit {
    outputSchema: Record<string, unknown>;
    instructions?: string;
    options?: ParseOptions;
    seedInput?: string;
    plan?: SearchPlan;
    planConfidence?: number;
    planDiagnostics?: ParseDiagnostic[];
    sessionId?: string;
}
export interface SessionParseOverrides {
    options?: Partial<ParseOptions>;
    instructions?: string;
    seedInput?: string;
}
export interface ParseratorInterceptorContext {
    request: ParseRequest;
    requestId: string;
    profile?: string;
    source: ParseratorTelemetrySource;
    sessionId?: string;
    plan?: SearchPlan;
}
export interface ParseratorInterceptorSuccessContext extends ParseratorInterceptorContext {
    response: ParseResponse;
}
export interface ParseratorInterceptorFailureContext extends ParseratorInterceptorContext {
    response: ParseResponse;
    error: ParseError;
}
export interface ParseratorInterceptor {
    beforeParse?(context: ParseratorInterceptorContext): void | Promise<void>;
    afterParse?(context: ParseratorInterceptorSuccessContext): void | Promise<void>;
    onFailure?(context: ParseratorInterceptorFailureContext): void | Promise<void>;
}
export interface ParseratorSessionSnapshot {
    id: string;
    createdAt: string;
    planReady: boolean;
    planVersion?: string;
    planConfidence: number;
    parseCount: number;
    tokensUsed: {
        architect: number;
        extractor: number;
        total: number;
    };
    lastRequestId?: string;
    lastConfidence?: number;
    lastDiagnostics: ParseDiagnostic[];
}
export type ParseratorTelemetrySource = 'core' | 'session';
export interface ParseratorTelemetryBaseEvent {
    requestId: string;
    timestamp: string;
    source: ParseratorTelemetrySource;
    profile?: string;
    sessionId?: string;
}
export interface ParseratorParseStartEvent extends ParseratorTelemetryBaseEvent {
    type: 'parse:start';
    inputLength: number;
    schemaFieldCount: number;
    options?: ParseOptions;
}
export interface ParseratorParseStageEvent extends ParseratorTelemetryBaseEvent {
    type: 'parse:stage';
    stage: 'architect' | 'extractor';
    metrics: StageMetrics;
    diagnostics: ParseDiagnostic[];
}
export interface ParseratorParseSuccessEvent extends ParseratorTelemetryBaseEvent {
    type: 'parse:success';
    metadata: ParseMetadata;
}
export interface ParseratorParseFailureEvent extends ParseratorTelemetryBaseEvent {
    type: 'parse:failure';
    error: ParseError;
    stage: ParseError['stage'];
    diagnostics: ParseDiagnostic[];
    metadata?: Partial<ParseMetadata>;
}
export interface ParseratorPlanReadyEvent extends ParseratorTelemetryBaseEvent {
    type: 'plan:ready';
    plan: SearchPlan;
    diagnostics: ParseDiagnostic[];
    tokensUsed: number;
    processingTimeMs: number;
    confidence: number;
}
export type ParseratorTelemetryEvent = ParseratorParseStartEvent | ParseratorParseStageEvent | ParseratorParseSuccessEvent | ParseratorParseFailureEvent | ParseratorPlanReadyEvent;
export type ParseratorTelemetryListener = (event: ParseratorTelemetryEvent) => void | Promise<void>;
export interface ParseratorTelemetry {
    emit(event: ParseratorTelemetryEvent): void;
    register(listener: ParseratorTelemetryListener): void;
    unregister(listener: ParseratorTelemetryListener): void;
    listeners(): ParseratorTelemetryListener[];
}
//# sourceMappingURL=types.d.ts.map