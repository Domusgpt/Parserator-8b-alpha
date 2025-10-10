"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeanLLMFallbackResolver = createLeanLLMFallbackResolver;
const utils_1 = require("./utils");
const async_queue_1 = require("./async-queue");
const resolver_constants_1 = require("./resolver-constants");
const DEFAULT_CONFIDENCE_FLOOR = 0.5;
const DEFAULT_REQUEST_STRATEGY = 'missing-required';
const DEFAULT_COOLDOWN_MS = 2500;
function toFieldContext(step) {
    return {
        targetKey: step.targetKey,
        description: step.description,
        searchInstruction: step.searchInstruction,
        validationType: step.validationType,
        isRequired: step.isRequired
    };
}
function collectResolvedFields(shared) {
    const resolved = {};
    for (const [key, value] of shared.entries()) {
        if (key.startsWith(resolver_constants_1.SHARED_RESOLVED_FIELD_PREFIX)) {
            resolved[key.slice(resolver_constants_1.SHARED_RESOLVED_FIELD_PREFIX.length)] = value;
        }
    }
    return resolved;
}
function normaliseResponse(response, targetContexts, confidenceFloor) {
    const map = new Map();
    for (const context of targetContexts) {
        const fieldResult = response.fields[context.targetKey] ?? {};
        const diagnostics = [];
        if (fieldResult.reasoning) {
            diagnostics.push({
                field: context.targetKey,
                stage: 'extractor',
                message: `Lean LLM rationale: ${fieldResult.reasoning}`,
                severity: 'info'
            });
        }
        if (Array.isArray(fieldResult.diagnostics)) {
            diagnostics.push(...fieldResult.diagnostics);
        }
        if (Array.isArray(response.diagnostics)) {
            diagnostics.push(...response.diagnostics.filter(diagnostic => diagnostic.field === context.targetKey || diagnostic.field === '*'));
        }
        if (response.usage?.tokensUsed !== undefined || response.usage?.latencyMs !== undefined) {
            const pieces = [];
            if (response.usage?.tokensUsed !== undefined) {
                pieces.push(`${response.usage.tokensUsed} tokens`);
            }
            if (response.usage?.latencyMs !== undefined) {
                pieces.push(`${response.usage.latencyMs}ms`);
            }
            diagnostics.push({
                field: context.targetKey,
                stage: 'extractor',
                message: `Lean LLM fallback executed${pieces.length ? ` (${pieces.join(', ')})` : ''}`,
                severity: 'info'
            });
        }
        map.set(context.targetKey, {
            value: fieldResult.value,
            confidence: (0, utils_1.clamp)(fieldResult.confidence ?? confidenceFloor, 0, 1),
            diagnostics
        });
    }
    return map;
}
function buildExtractionRequest(context, targetContexts, resolvedFields) {
    const plan = context.shared.get(resolver_constants_1.SHARED_PLAN_KEY);
    return {
        inputData: context.inputData,
        instructions: context.shared.get(resolver_constants_1.SHARED_INSTRUCTIONS_KEY),
        outputSchema: context.shared.get(resolver_constants_1.SHARED_SCHEMA_KEY),
        plan: plan && typeof plan === 'object' ? plan : undefined,
        targetFields: targetContexts,
        activeField: toFieldContext(context.step),
        resolvedFields,
        requestId: context.shared.get(resolver_constants_1.SHARED_REQUEST_ID_KEY),
        sessionId: context.shared.get(resolver_constants_1.SHARED_SESSION_ID_KEY),
        profile: context.shared.get(resolver_constants_1.SHARED_PROFILE_KEY)
    };
}
function createLeanLLMFallbackResolver(options) {
    const { client, allowOptionalFields = false, requestStrategy = DEFAULT_REQUEST_STRATEGY, concurrency = 1, cooldownMs = DEFAULT_COOLDOWN_MS, confidenceFloor = DEFAULT_CONFIDENCE_FLOOR, logger } = options;
    const queue = (0, async_queue_1.createAsyncTaskQueue)({
        concurrency,
        onError: error => {
            logger?.error?.('parserator-core:lean-llm-fallback-error', {
                message: error instanceof Error ? error.message : error
            });
        }
    });
    return {
        name: 'lean-llm-fallback',
        supports() {
            return true;
        },
        async resolve(context) {
            if (!context.config.enableFieldFallbacks) {
                return undefined;
            }
            if (!allowOptionalFields && !context.step.isRequired) {
                return undefined;
            }
            const cached = context.shared.get(resolver_constants_1.SHARED_LEAN_LLM_RESULTS_KEY);
            if (cached?.has(context.step.targetKey)) {
                const cachedResult = cached.get(context.step.targetKey);
                return {
                    value: cachedResult.value,
                    confidence: cachedResult.confidence ?? confidenceFloor,
                    diagnostics: cachedResult.diagnostics,
                    resolver: 'lean-llm-fallback'
                };
            }
            const inflight = context.shared.get(resolver_constants_1.SHARED_LEAN_LLM_PENDING_KEY);
            if (inflight) {
                try {
                    const awaited = await inflight;
                    const reuse = awaited.get(context.step.targetKey);
                    if (reuse) {
                        return {
                            value: reuse.value,
                            confidence: reuse.confidence ?? confidenceFloor,
                            diagnostics: reuse.diagnostics,
                            resolver: 'lean-llm-fallback'
                        };
                    }
                }
                catch (error) {
                    logger?.warn?.('parserator-core:lean-llm-fallback-inflight-error', {
                        field: context.step.targetKey,
                        message: error instanceof Error ? error.message : error
                    });
                }
            }
            const now = Date.now();
            const lastCallAt = context.shared.get(resolver_constants_1.SHARED_LEAN_LLM_LAST_CALL_KEY);
            if (typeof lastCallAt === 'number' && now - lastCallAt < cooldownMs) {
                return {
                    value: undefined,
                    confidence: 0,
                    diagnostics: [
                        {
                            field: context.step.targetKey,
                            stage: 'extractor',
                            message: 'Lean LLM fallback skipped due to cooldown window',
                            severity: 'info'
                        }
                    ],
                    resolver: 'lean-llm-fallback'
                };
            }
            const plan = context.shared.get(resolver_constants_1.SHARED_PLAN_KEY);
            const resolvedFields = collectResolvedFields(context.shared);
            let targetContexts = [];
            if (requestStrategy === 'single-field' || !plan) {
                targetContexts = [toFieldContext(context.step)];
            }
            else {
                const planSteps = Array.isArray(plan?.steps)
                    ? plan.steps
                    : [];
                const filtered = planSteps.filter((step) => {
                    if (!step || typeof step !== 'object') {
                        return false;
                    }
                    if (!allowOptionalFields && step.isRequired === false) {
                        return false;
                    }
                    const key = String(step.targetKey ?? '');
                    if (!key) {
                        return false;
                    }
                    if (resolvedFields[key] !== undefined) {
                        return false;
                    }
                    return true;
                });
                if (!filtered.some((step) => step?.targetKey === context.step.targetKey)) {
                    filtered.push(context.step);
                }
                targetContexts = filtered.map((step) => toFieldContext(step));
            }
            const request = buildExtractionRequest(context, targetContexts, resolvedFields);
            let responseMapPromise = queue.enqueue(async () => {
                const response = await client.infer(request);
                return normaliseResponse(response, targetContexts, confidenceFloor);
            });
            responseMapPromise = responseMapPromise
                .then(map => {
                context.shared.set(resolver_constants_1.SHARED_LEAN_LLM_RESULTS_KEY, map);
                context.shared.set(resolver_constants_1.SHARED_LEAN_LLM_LAST_CALL_KEY, now);
                context.shared.delete(resolver_constants_1.SHARED_LEAN_LLM_LAST_ERROR_KEY);
                return map;
            })
                .catch(error => {
                context.shared.set(resolver_constants_1.SHARED_LEAN_LLM_LAST_ERROR_KEY, error);
                throw error;
            })
                .finally(() => {
                context.shared.delete(resolver_constants_1.SHARED_LEAN_LLM_PENDING_KEY);
            });
            context.shared.set(resolver_constants_1.SHARED_LEAN_LLM_PENDING_KEY, responseMapPromise);
            context.shared.set(resolver_constants_1.SHARED_LEAN_LLM_LAST_CALL_KEY, now);
            try {
                const map = await responseMapPromise;
                const fieldResult = map.get(context.step.targetKey);
                if (!fieldResult) {
                    return {
                        value: undefined,
                        confidence: 0,
                        diagnostics: [
                            {
                                field: context.step.targetKey,
                                stage: 'extractor',
                                message: 'Lean LLM fallback returned no result for this field',
                                severity: context.step.isRequired ? 'warning' : 'info'
                            }
                        ],
                        resolver: 'lean-llm-fallback'
                    };
                }
                return {
                    value: fieldResult.value,
                    confidence: fieldResult.confidence ?? confidenceFloor,
                    diagnostics: [
                        ...fieldResult.diagnostics,
                        {
                            field: context.step.targetKey,
                            stage: 'extractor',
                            message: 'Value supplied by lean LLM fallback resolver',
                            severity: fieldResult.value === undefined ? 'warning' : 'info'
                        }
                    ],
                    resolver: 'lean-llm-fallback'
                };
            }
            catch (error) {
                logger?.warn?.('parserator-core:lean-llm-fallback-failed', {
                    field: context.step.targetKey,
                    message: error instanceof Error ? error.message : error
                });
                return {
                    value: undefined,
                    confidence: 0,
                    diagnostics: [
                        {
                            field: context.step.targetKey,
                            stage: 'extractor',
                            message: 'Lean LLM fallback failed to resolve the field',
                            severity: context.step.isRequired ? 'warning' : 'info'
                        }
                    ],
                    resolver: 'lean-llm-fallback'
                };
            }
        }
    };
}
//# sourceMappingURL=llm-resolver.js.map