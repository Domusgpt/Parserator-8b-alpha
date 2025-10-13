"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeanLLMFieldResolver = createLeanLLMFieldResolver;
const async_queue_1 = require("./async-queue");
const resolver_constants_1 = require("./resolver-constants");
const utils_1 = require("./utils");
const DEFAULT_MIN_CONFIDENCE = 0.65;
function toQueueState(queue) {
    const metrics = queue.metrics();
    return {
        pending: metrics.pending,
        inFlight: metrics.inFlight,
        completed: metrics.completed,
        failed: metrics.failed,
        size: queue.size(),
        lastDurationMs: metrics.lastDurationMs,
        lastError: toErrorMessage(metrics.lastError)
    };
}
function toErrorMessage(error) {
    if (error === undefined || error === null) {
        return undefined;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
function buildUsageDiagnostic(usage) {
    if (!usage) {
        return undefined;
    }
    const parts = [];
    if (usage.tokensUsed !== undefined) {
        parts.push(`${usage.tokensUsed} tokens`);
    }
    if (usage.latencyMs !== undefined) {
        parts.push(`${usage.latencyMs}ms`);
    }
    if (usage.model) {
        parts.push(usage.model);
    }
    if (parts.length === 0) {
        return undefined;
    }
    return {
        field: '*',
        stage: 'extractor',
        message: `Lean LLM fallback usage: ${parts.join(', ')}`,
        severity: 'info'
    };
}
function collectPendingFields(plan, shared, includeOptional) {
    const pending = new Set();
    for (const step of plan.steps) {
        const resolvedKey = `${resolver_constants_1.SHARED_RESOLVED_FIELD_PREFIX}${step.targetKey}`;
        if (shared.has(resolvedKey)) {
            continue;
        }
        if (step.isRequired || includeOptional) {
            pending.add(step.targetKey);
        }
    }
    return Array.from(pending);
}
function createLeanLLMFieldResolver(options) {
    const { client, logger, includeOptionalFields = false, concurrency = 1, minConfidence = DEFAULT_MIN_CONFIDENCE, emitTelemetry } = options;
    const queue = (0, async_queue_1.createAsyncTaskQueue)({
        concurrency: Math.max(1, Math.floor(concurrency)),
        onError: error => {
            lastError = toErrorMessage(error);
            lastFailureAt = Date.now();
            logger?.error?.('parserator-core:lean-llm-field-fallback-queue-error', {
                message: lastError ?? 'unknown lean LLM field fallback error'
            });
        }
    });
    let attempts = 0;
    let successes = 0;
    let failures = 0;
    let lastAttemptAt;
    let lastSuccessAt;
    let lastFailureAt;
    let lastError;
    let lastUsage;
    const emit = (event) => {
        emitTelemetry?.({
            ...event,
            queue: event.queue ?? toQueueState(queue)
        });
    };
    const toIso = (value) => (value ? new Date(value).toISOString() : undefined);
    const resolver = {
        name: 'lean-llm-field-fallback',
        supports() {
            return true;
        },
        async resolve(context) {
            if (!context.config.enableFieldFallbacks) {
                emit({
                    action: 'skipped',
                    skipReason: 'disabled',
                    field: context.step.targetKey,
                    required: context.step.isRequired,
                    requestId: context.shared.get(resolver_constants_1.SHARED_REQUEST_ID_KEY),
                    sessionId: context.shared.get(resolver_constants_1.SHARED_SESSION_ID_KEY)
                });
                return undefined;
            }
            if (!includeOptionalFields && !context.step.isRequired) {
                emit({
                    action: 'skipped',
                    skipReason: 'optional-field',
                    field: context.step.targetKey,
                    required: context.step.isRequired,
                    requestId: context.shared.get(resolver_constants_1.SHARED_REQUEST_ID_KEY),
                    sessionId: context.shared.get(resolver_constants_1.SHARED_SESSION_ID_KEY)
                });
                return undefined;
            }
            const plan = context.shared.get(resolver_constants_1.SHARED_PLAN_KEY);
            if (!plan) {
                emit({
                    action: 'skipped',
                    skipReason: 'no-plan',
                    field: context.step.targetKey,
                    required: context.step.isRequired,
                    requestId: context.shared.get(resolver_constants_1.SHARED_REQUEST_ID_KEY),
                    sessionId: context.shared.get(resolver_constants_1.SHARED_SESSION_ID_KEY)
                });
                return undefined;
            }
            let result = context.shared.get(resolver_constants_1.SHARED_LEAN_FALLBACK_RESULT_KEY);
            if (!result) {
                let sharedPromise = context.shared.get(resolver_constants_1.SHARED_LEAN_FALLBACK_PROMISE_KEY);
                if (!sharedPromise) {
                    const pendingFields = collectPendingFields(plan, context.shared, includeOptionalFields);
                    if (!pendingFields.includes(context.step.targetKey)) {
                        pendingFields.push(context.step.targetKey);
                    }
                    const requestId = context.shared.get(resolver_constants_1.SHARED_REQUEST_ID_KEY) ?? undefined;
                    const sessionId = context.shared.get(resolver_constants_1.SHARED_SESSION_ID_KEY) ?? undefined;
                    const profile = context.shared.get(resolver_constants_1.SHARED_PROFILE_KEY) ?? undefined;
                    const schema = context.shared.get(resolver_constants_1.SHARED_SCHEMA_KEY) ?? {};
                    const instructions = context.shared.get(resolver_constants_1.SHARED_INSTRUCTIONS_KEY) ?? undefined;
                    sharedPromise = (async () => {
                        if (pendingFields.length === 0) {
                            emit({
                                action: 'skipped',
                                skipReason: 'no-pending-fields',
                                field: context.step.targetKey,
                                required: context.step.isRequired,
                                requestId,
                                sessionId
                            });
                            const success = {
                                status: 'success',
                                response: {},
                                deliveredGlobalDiagnostics: true,
                                deliveredUsageDiagnostic: true
                            };
                            context.shared.set(resolver_constants_1.SHARED_LEAN_FALLBACK_RESULT_KEY, success);
                            return success;
                        }
                        attempts += 1;
                        lastAttemptAt = Date.now();
                        emit({
                            action: 'queued',
                            field: context.step.targetKey,
                            required: context.step.isRequired,
                            pendingFields: pendingFields.length,
                            requestId,
                            sessionId
                        });
                        try {
                            const { response } = await queue.enqueue(async () => {
                                emit({
                                    action: 'started',
                                    field: context.step.targetKey,
                                    required: context.step.isRequired,
                                    pendingFields: pendingFields.length,
                                    requestId,
                                    sessionId
                                });
                                const response = await client.resolve({
                                    inputData: context.inputData,
                                    outputSchema: schema,
                                    instructions,
                                    plan,
                                    pendingFields,
                                    context: {
                                        profile,
                                        requestId,
                                        sessionId
                                    }
                                });
                                return { response };
                            });
                            successes += 1;
                            lastSuccessAt = Date.now();
                            lastFailureAt = undefined;
                            lastError = undefined;
                            lastUsage = response?.usage ? { ...response.usage } : undefined;
                            emit({
                                action: 'resolved',
                                field: context.step.targetKey,
                                required: context.step.isRequired,
                                pendingFields: pendingFields.length,
                                requestId,
                                sessionId,
                                usage: lastUsage
                            });
                            const success = {
                                status: 'success',
                                response: response ?? {},
                                deliveredGlobalDiagnostics: false,
                                deliveredUsageDiagnostic: !response?.usage
                            };
                            context.shared.set(resolver_constants_1.SHARED_LEAN_FALLBACK_RESULT_KEY, success);
                            return success;
                        }
                        catch (error) {
                            failures += 1;
                            lastFailureAt = Date.now();
                            const message = toErrorMessage(error) ?? 'Lean LLM fallback failed with unknown error';
                            lastError = message;
                            lastUsage = undefined;
                            emit({
                                action: 'failed',
                                field: context.step.targetKey,
                                required: context.step.isRequired,
                                pendingFields: pendingFields.length,
                                requestId,
                                sessionId,
                                error: message
                            });
                            const failure = {
                                status: 'failed',
                                error: message
                            };
                            context.shared.set(resolver_constants_1.SHARED_LEAN_FALLBACK_RESULT_KEY, failure);
                            return failure;
                        }
                        finally {
                            context.shared.delete(resolver_constants_1.SHARED_LEAN_FALLBACK_PROMISE_KEY);
                        }
                    })();
                    context.shared.set(resolver_constants_1.SHARED_LEAN_FALLBACK_PROMISE_KEY, sharedPromise);
                }
                result = await sharedPromise;
            }
            if (!result) {
                return undefined;
            }
            if (result.status === 'failed') {
                const diagnostics = [
                    {
                        field: context.step.targetKey,
                        stage: 'extractor',
                        message: `Lean LLM fallback failed: ${result.error}`,
                        severity: context.step.isRequired ? 'warning' : 'info'
                    }
                ];
                return {
                    value: undefined,
                    confidence: context.step.isRequired ? 0 : 0.2,
                    diagnostics,
                    resolver: resolver.name
                };
            }
            const diagnostics = [];
            const usageDiagnostic = !result.deliveredUsageDiagnostic
                ? buildUsageDiagnostic(result.response.usage)
                : undefined;
            if (usageDiagnostic) {
                diagnostics.push(usageDiagnostic);
                result.deliveredUsageDiagnostic = true;
                context.shared.set(resolver_constants_1.SHARED_LEAN_FALLBACK_RESULT_KEY, result);
            }
            if (!result.deliveredGlobalDiagnostics && result.response.diagnostics?.length) {
                diagnostics.push(...result.response.diagnostics);
                result.deliveredGlobalDiagnostics = true;
                context.shared.set(resolver_constants_1.SHARED_LEAN_FALLBACK_RESULT_KEY, result);
            }
            const fieldDiagnostics = result.response.fieldDiagnostics?.[context.step.targetKey];
            if (fieldDiagnostics?.length) {
                diagnostics.push(...fieldDiagnostics);
            }
            const value = result.response.values?.[context.step.targetKey];
            if (value === undefined) {
                diagnostics.push({
                    field: context.step.targetKey,
                    stage: 'extractor',
                    message: 'Lean LLM fallback did not return a value for this field',
                    severity: context.step.isRequired ? 'warning' : 'info'
                });
                return {
                    value: undefined,
                    confidence: context.step.isRequired ? 0 : (0, utils_1.clamp)(minConfidence * 0.4, 0, 1),
                    diagnostics,
                    resolver: resolver.name
                };
            }
            diagnostics.push({
                field: context.step.targetKey,
                stage: 'extractor',
                message: 'Lean LLM fallback resolved this field',
                severity: 'info'
            });
            const confidence = (0, utils_1.clamp)(result.response.confidences?.[context.step.targetKey] ??
                result.response.confidence ??
                minConfidence, 0, 1);
            return {
                value,
                confidence,
                diagnostics,
                resolver: resolver.name
            };
        },
        getState() {
            return {
                enabled: true,
                concurrency: Math.max(1, Math.floor(concurrency)),
                includeOptionalFields,
                minConfidence,
                attempts,
                successes,
                failures,
                lastAttemptAt: toIso(lastAttemptAt),
                lastSuccessAt: toIso(lastSuccessAt),
                lastFailureAt: toIso(lastFailureAt),
                lastError,
                lastUsage,
                queue: toQueueState(queue)
            };
        }
    };
    return resolver;
}
//# sourceMappingURL=lean-llm-field-resolver.js.map