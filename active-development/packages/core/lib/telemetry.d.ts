import { CoreLogger, ParseratorTelemetry, ParseratorTelemetryEvent, ParseratorTelemetryListener, ParseratorPlanCacheEvent, ParseratorTelemetrySource, ParseratorPlanRewriteEvent, ParseratorPlanRewriteSkipReason, ParseratorLeanLLMPlanRewriteQueueState, ParseratorLeanLLMPlanRewriteUsage, ParseratorFieldFallbackEvent, ParseratorFieldFallbackSkipReason, ParseratorLeanLLMFieldFallbackQueueState } from './types';
export declare class TelemetryHub implements ParseratorTelemetry {
    private readonly logger?;
    private readonly listenersSet;
    constructor(listeners?: ParseratorTelemetryListener[], logger?: CoreLogger | undefined);
    emit(event: ParseratorTelemetryEvent): void;
    register(listener: ParseratorTelemetryListener): void;
    unregister(listener: ParseratorTelemetryListener): void;
    listeners(): ParseratorTelemetryListener[];
}
export declare function createTelemetryHub(input: ParseratorTelemetry | ParseratorTelemetryListener | ParseratorTelemetryListener[] | undefined, logger?: CoreLogger): ParseratorTelemetry;
export interface PlanCacheTelemetryEventInput {
    action: ParseratorPlanCacheEvent['action'];
    key?: string;
    scope?: string;
    planId?: string;
    confidence?: number;
    tokensUsed?: number;
    processingTimeMs?: number;
    reason?: string;
    requestId?: string;
    error?: unknown;
}
export interface PlanCacheTelemetryEmitterOptions {
    telemetry: ParseratorTelemetry;
    source: ParseratorTelemetrySource;
    resolveProfile?: () => string | undefined;
    resolveSessionId?: () => string | undefined;
    resolveKey?: () => string | undefined;
    resolvePlanId?: () => string | undefined;
    requestIdFactory?: () => string;
    logger?: CoreLogger;
}
export type PlanCacheTelemetryEmitter = (event: PlanCacheTelemetryEventInput) => void;
export declare function createPlanCacheTelemetryEmitter(options: PlanCacheTelemetryEmitterOptions): PlanCacheTelemetryEmitter;
export interface PlanRewriteTelemetryEventInput {
    action: ParseratorPlanRewriteEvent['action'];
    heuristicsConfidence?: number;
    requestedThreshold?: number;
    rewriteConfidence?: number;
    cooldownMs?: number;
    usage?: ParseratorLeanLLMPlanRewriteUsage;
    queue?: ParseratorLeanLLMPlanRewriteQueueState;
    skipReason?: ParseratorPlanRewriteSkipReason;
    error?: unknown;
    requestId?: string;
    sessionId?: string;
    source?: ParseratorTelemetrySource;
}
export interface PlanRewriteTelemetryEmitterOptions {
    telemetry: ParseratorTelemetry;
    source: ParseratorTelemetrySource;
    resolveProfile?: () => string | undefined;
    resolveSessionId?: () => string | undefined;
    requestIdFactory?: () => string;
    logger?: CoreLogger;
}
export type PlanRewriteTelemetryEmitter = (event: PlanRewriteTelemetryEventInput) => void;
export declare function createPlanRewriteTelemetryEmitter(options: PlanRewriteTelemetryEmitterOptions): PlanRewriteTelemetryEmitter;
export interface FieldFallbackTelemetryEventInput {
    action: ParseratorFieldFallbackEvent['action'];
    field?: string;
    required?: boolean;
    pendingFields?: number;
    usage?: ParseratorLeanLLMPlanRewriteUsage;
    queue?: ParseratorLeanLLMFieldFallbackQueueState;
    skipReason?: ParseratorFieldFallbackSkipReason;
    error?: unknown;
    requestId?: string;
    sessionId?: string;
}
export interface FieldFallbackTelemetryEmitterOptions {
    telemetry: ParseratorTelemetry;
    source: ParseratorTelemetrySource;
    resolveProfile?: () => string | undefined;
    resolveSessionId?: () => string | undefined;
    requestIdFactory?: () => string;
    logger?: CoreLogger;
}
export type FieldFallbackTelemetryEmitter = (event: FieldFallbackTelemetryEventInput) => void;
export declare function createFieldFallbackTelemetryEmitter(options: FieldFallbackTelemetryEmitterOptions): FieldFallbackTelemetryEmitter;
//# sourceMappingURL=telemetry.d.ts.map