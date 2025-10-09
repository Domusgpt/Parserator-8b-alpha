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
    stage: 'preprocess' | 'validation' | 'architect' | 'extractor' | 'postprocess' | 'orchestration';
    message: string;
    severity: 'info' | 'warning' | 'error';
}
export interface ParseError {
    code: string;
    message: string;
    stage: 'validation' | 'preprocess' | 'architect' | 'extractor' | 'postprocess' | 'orchestration';
    details?: Record<string, unknown>;
    suggestion?: string;
}
export interface StageMetrics {
    timeMs: number;
    tokens: number;
    confidence: number;
    runs?: number;
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
        preprocess?: StageMetrics;
        architect: StageMetrics;
        extractor: StageMetrics;
        postprocess?: StageMetrics;
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
export interface ParseratorPreprocessContext {
    request: ParseRequest;
    config: ParseratorCoreConfig;
    profile?: string;
    logger: CoreLogger;
    shared: Map<string, unknown>;
}
export interface ParseratorPreprocessResult {
    request?: Partial<ParseRequest>;
    diagnostics?: ParseDiagnostic[];
}
export interface ParseratorPreprocessor {
    name: string;
    run(context: ParseratorPreprocessContext): Promise<ParseratorPreprocessResult | void> | ParseratorPreprocessResult | void;
}
export interface ParseratorPreprocessExecutionResult {
    request: ParseRequest;
    diagnostics: ParseDiagnostic[];
    metrics: StageMetrics & {
        runs: number;
    };
}
export interface ParseratorPostprocessContext {
    request: ParseRequest;
    parsedData: Record<string, unknown>;
    metadata: ParseMetadata;
    config: ParseratorCoreConfig;
    profile?: string;
    logger: CoreLogger;
    shared: Map<string, unknown>;
}
export interface ParseratorPostprocessResult {
    parsedData?: Record<string, unknown>;
    metadata?: Partial<ParseMetadata>;
    diagnostics?: ParseDiagnostic[];
}
export interface ParseratorPostprocessor {
    name: string;
    run(context: ParseratorPostprocessContext): Promise<ParseratorPostprocessResult | void> | ParseratorPostprocessResult | void;
}
export interface ParseratorPostprocessExecutionResult {
    parsedData: Record<string, unknown>;
    metadata: ParseMetadata;
    diagnostics: ParseDiagnostic[];
    metrics: StageMetrics & {
        runs: number;
    };
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
export type ParseratorAutoRefreshReason = 'confidence' | 'usage';
export interface ParseratorPlanAutoRefreshConfig {
    /**
     * Trigger an automatic refresh when the combined parse confidence dips below
     * this threshold. Defaults to the core configuration's `minConfidence` when
     * omitted.
     */
    minConfidence?: number;
    /**
     * Force a refresh after this many parses have been executed with the current
     * plan. Useful for long-running agents that want predictable recalibration
     * intervals even when confidence remains high.
     */
    maxParses?: number;
    /**
     * Minimum amount of time (in milliseconds) that must elapse between
     * successive automatic refresh attempts.
     */
    minIntervalMs?: number;
    /**
     * Allow this many consecutive low-confidence results before a refresh is
     * triggered. A value of `0` (default) refreshes immediately when the
     * threshold is crossed.
     */
    lowConfidenceGrace?: number;
}
export interface ParseratorPlanCacheEntry {
    plan: SearchPlan;
    confidence: number;
    diagnostics: ParseDiagnostic[];
    tokensUsed: number;
    processingTimeMs: number;
    updatedAt: string;
    profile?: string;
}
export interface ParseratorPlanCacheKeyInput {
    outputSchema: Record<string, unknown>;
    instructions?: string;
    options?: ParseOptions;
    profile?: string;
}
export interface ParseratorPlanCache {
    get(key: string): Promise<ParseratorPlanCacheEntry | undefined> | ParseratorPlanCacheEntry | undefined;
    set(key: string, entry: ParseratorPlanCacheEntry): Promise<void> | void;
    delete?(key: string): Promise<void> | void;
    clear?(profile?: string): Promise<void> | void;
}
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
    planCache?: ParseratorPlanCache | null;
    preprocessors?: ParseratorPreprocessor | ParseratorPreprocessor[] | null;
    postprocessors?: ParseratorPostprocessor | ParseratorPostprocessor[] | null;
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
    autoRefresh?: ParseratorPlanAutoRefreshConfig;
}
export interface ParseratorSessionFromResponseOptions {
    request: ParseRequest;
    response: ParseResponse;
    overrides?: Partial<ParseratorSessionInit>;
}
export interface SessionParseOverrides {
    options?: Partial<ParseOptions>;
    instructions?: string;
    seedInput?: string;
}
export interface RefreshPlanOptions {
    /**
     * Provide a fresh calibration sample for the architect. Falls back to the
     * most recent seed input when omitted.
     */
    seedInput?: string;
    /**
     * Override the default session instructions before regenerating the plan.
     */
    instructions?: string;
    /**
     * Apply option overrides (timeout, retries, thresholds, etc.) prior to
     * running the architect. The merged options become the new session default
     * when the refresh succeeds.
     */
    options?: Partial<ParseOptions>;
    /**
     * Skip regeneration when a plan already exists unless this flag is true.
     */
    force?: boolean;
    /**
     * When true the refreshed plan will be included in the returned state.
     */
    includePlan?: boolean;
}
export interface ParseratorPlanState {
    ready: boolean;
    plan?: SearchPlan;
    version?: string;
    strategy?: SearchPlan['strategy'];
    confidence: number;
    diagnostics: ParseDiagnostic[];
    tokensUsed: number;
    processingTimeMs: number;
    origin?: SearchPlan['metadata']['origin'];
    updatedAt?: string;
    seedInput?: string;
}
export interface ParseratorPlanRefreshResult {
    success: boolean;
    state: ParseratorPlanState;
    failure?: ParseResponse;
    skipped?: boolean;
}
export interface ParseratorAutoRefreshState {
    config: ParseratorPlanAutoRefreshConfig;
    parsesSinceRefresh: number;
    lowConfidenceRuns: number;
    lastTriggeredAt?: string;
    lastAttemptAt?: string;
    lastReason?: ParseratorAutoRefreshReason;
    coolingDown: boolean;
    pending: boolean;
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
    planStrategy?: SearchPlan['strategy'];
    planUpdatedAt?: string;
    planSeedInput?: string;
    planConfidence: number;
    planDiagnostics: ParseDiagnostic[];
    parseCount: number;
    tokensUsed: {
        architect: number;
        extractor: number;
        total: number;
    };
    lastRequestId?: string;
    lastConfidence?: number;
    lastDiagnostics: ParseDiagnostic[];
    autoRefresh?: ParseratorAutoRefreshState;
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
    stage: 'preprocess' | 'architect' | 'extractor' | 'postprocess';
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