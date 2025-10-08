/**
 * Shared type definitions for the Parserator agentic kernel.
 * These abstractions favour modular orchestration so the core
 * system can operate as an agent-facing primitive today while
 * evolving toward high-bandwidth, sensor-aware parsing workloads.
 */
export type ValidationType = 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'date' | 'iso_date' | 'url' | 'string_array' | 'number_array' | 'object' | 'custom';
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
        origin: 'model' | 'cached' | 'manual';
    };
}
export interface ParseOptions {
    timeout?: number;
    retries?: number;
    validateOutput?: boolean;
    includeMetadata?: boolean;
    confidenceThreshold?: number;
    streamingMode?: 'none' | 'progress' | 'diff';
}
export interface ParseRequest {
    inputData: string;
    outputSchema: Record<string, unknown>;
    instructions?: string;
    options?: ParseOptions;
}
export interface KernelConfig {
    maxInputBytes: number;
    maxSchemaFields: number;
    minConfidence: number;
    defaultStrategy: 'sequential' | 'parallel' | 'adaptive';
    environment: 'cloud' | 'edge';
    instrumentation?: KernelInstrumentation;
    experimentalFeatures?: {
        adaptiveSampling?: boolean;
        localFallbacks?: boolean;
    };
}
export interface KernelInstrumentation {
    emit(event: KernelEvent): void;
}
export interface KernelEvent {
    type: 'kernel:start' | 'kernel:finish' | 'planner:start' | 'planner:finish' | 'executor:start' | 'executor:finish' | 'validator:start' | 'validator:finish' | 'kernel:error';
    timestamp: string;
    requestId: string;
    metadata?: Record<string, unknown>;
}
export interface KernelDiagnostic {
    stage: 'planner' | 'executor' | 'validator' | 'orchestrator';
    message: string;
    severity: 'info' | 'warning' | 'error';
    details?: Record<string, unknown>;
}
export interface KernelError {
    code: string;
    message: string;
    stage: 'planner' | 'executor' | 'validator' | 'orchestrator';
    details?: Record<string, unknown>;
    suggestion?: string;
}
export interface KernelModuleResult<TOutput> {
    success: boolean;
    output?: TOutput;
    metadata?: Record<string, unknown>;
    tokensUsed?: number;
    diagnostics?: KernelDiagnostic[];
    error?: KernelError;
}
export interface KernelRuntimeContext {
    requestId: string;
    clock: () => number;
    config: KernelConfig;
    logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}
export type KernelModuleKind = 'planner' | 'executor' | 'validator' | 'observer';
export interface KernelModule<TInput = unknown, TOutput = unknown> {
    name: string;
    kind: KernelModuleKind;
    supports(job: AgenticParseJob): boolean;
    execute(context: KernelRuntimeContext, input: TInput): Promise<KernelModuleResult<TOutput>>;
    warmup?(context: KernelRuntimeContext): Promise<void> | void;
    dispose?(context: KernelRuntimeContext): Promise<void> | void;
}
export type PlannerPayload = AgenticParseJob;
export interface ExecutorPayload {
    job: AgenticParseJob;
    plan: SearchPlan;
}
export interface AgenticParseJob extends ParseRequest {
    requestId: string;
    createdAt: string;
    invokedBy: 'sdk' | 'api' | 'cli' | 'agent';
    tenantId?: string;
    metadata?: Record<string, unknown>;
}
export interface ParseMetadata {
    architectPlan: SearchPlan;
    confidence: number;
    tokensUsed: number;
    processingTimeMs: number;
    requestId: string;
    timestamp: string;
    diagnostics: KernelDiagnostic[];
}
export interface ParseResponse {
    success: boolean;
    parsedData: Record<string, unknown>;
    metadata: ParseMetadata;
    error?: KernelError;
}
export interface KernelRunSummary {
    response: ParseResponse;
    plannerResult: KernelModuleResult<SearchPlan>;
    executorResult: KernelModuleResult<Record<string, unknown>>;
}
export interface ParseratorCoreOptions {
    apiKey: string;
    config?: Partial<KernelConfig>;
    logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}
export interface ParseInvocationOptions {
    requestId?: string;
    invokedBy?: AgenticParseJob['invokedBy'];
    tenantId?: string;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map