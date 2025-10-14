"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiLeanPlanClient = createGeminiLeanPlanClient;
exports.createGeminiLeanFieldClient = createGeminiLeanFieldClient;
const MAX_CONTEXT_LENGTH = 4000;
const ALLOWED_SEVERITIES = ['info', 'warning', 'error'];
function truncate(value, max = MAX_CONTEXT_LENGTH) {
    if (!value) {
        return '';
    }
    if (value.length <= max) {
        return value;
    }
    return `${value.slice(0, max)}\n… [truncated ${value.length - max} characters]`;
}
function formatJson(value, max = MAX_CONTEXT_LENGTH) {
    try {
        const json = JSON.stringify(value, null, 2);
        return truncate(json, max);
    }
    catch (error) {
        return `Unable to serialise JSON: ${error?.message ?? 'unknown error'}`;
    }
}
function extractJson(content) {
    const candidates = [];
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    candidates.push(trimmed);
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch?.[1]) {
        candidates.push(codeBlockMatch[1].trim());
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }
        try {
            return JSON.parse(candidate);
        }
        catch {
            continue;
        }
    }
    return undefined;
}
function buildUsage(response) {
    const usage = {};
    if (typeof response.tokensUsed === 'number') {
        usage.tokensUsed = response.tokensUsed;
    }
    if (typeof response.responseTimeMs === 'number') {
        usage.latencyMs = response.responseTimeMs;
    }
    if (response.model) {
        usage.model = response.model;
    }
    return Object.keys(usage).length > 0 ? usage : undefined;
}
function normaliseDiagnostics(value, fallbackStage) {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const diagnostics = [];
    for (const entry of value) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const message = typeof entry.message === 'string' ? entry.message : undefined;
        if (!message) {
            continue;
        }
        const severityCandidate = entry.severity;
        const severity = ALLOWED_SEVERITIES.includes(severityCandidate)
            ? severityCandidate
            : 'info';
        const stageValue = typeof entry.stage === 'string' ? entry.stage : fallbackStage;
        const field = typeof entry.field === 'string' ? entry.field : '*';
        diagnostics.push({ field, stage: stageValue, message, severity });
    }
    return diagnostics.length > 0 ? diagnostics : undefined;
}
function normaliseFieldDiagnostics(value, fallbackStage) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const result = {};
    for (const [field, diagnostics] of Object.entries(value)) {
        if (!Array.isArray(diagnostics)) {
            continue;
        }
        const normalised = normaliseDiagnostics(diagnostics, fallbackStage);
        if (normalised?.length) {
            result[field] = normalised;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
function createPlanPrompt(request) {
    const diagnostics = request.diagnostics?.length ? formatJson(request.diagnostics) : '[]';
    return [
        'You are the lean Parserator planning assistant. A deterministic heuristic plan is provided below along with the parse request.',
        'Your job is to decide whether a minimal rewrite is required. If you can improve it, produce a revised plan.',
        'Respond ONLY with JSON containing the keys: plan (SearchPlan structure), confidence (number between 0 and 1), and diagnostics (array).',
        '',
        'If the heuristic plan is already adequate, return the original plan and diagnostics explaining why no rewrite was required.',
        '',
        '--- Parse Request Context ---',
        `Input Data (truncated):\n${truncate(request.inputData)}`,
        '',
        `Output Schema: ${formatJson(request.outputSchema)}`,
        '',
        `Instructions: ${truncate(request.instructions) || 'None provided.'}`,
        '',
        '--- Current Heuristic Plan ---',
        formatJson(request.heuristicPlan),
        '',
        `Diagnostics: ${diagnostics}`,
        '',
        'Return strictly valid JSON. Do not include commentary or markdown.'
    ].join('\n');
}
function createFieldPrompt(request) {
    return [
        'You are the lean Parserator field resolver. The deterministic extractor could not resolve some required fields.',
        'Review the input and return values only for the pending fields. Avoid re-stating data for fields that are not requested.',
        'Respond ONLY with JSON containing: values (object of field -> value), confidences (object of field -> number 0-1), optional confidence (number for overall), diagnostics (array), optional fieldDiagnostics (record of field -> diagnostics array), and optional error string.',
        '',
        '--- Parse Request Context ---',
        `Pending Fields: ${request.pendingFields.join(', ') || 'None'}`,
        `Profile: ${request.context.profile ?? 'not provided'}`,
        `Request ID: ${request.context.requestId ?? 'n/a'}`,
        '',
        `Input Data (truncated):\n${truncate(request.inputData)}`,
        '',
        `Output Schema: ${formatJson(request.outputSchema)}`,
        '',
        `Instructions: ${truncate(request.instructions) || 'None provided.'}`,
        '',
        '--- Planner Context ---',
        formatJson(request.plan),
        '',
        'Return strictly valid JSON with the structure described above. Do not include markdown or explanations.'
    ].join('\n');
}
function withRequestOptions(options, requestId) {
    return {
        ...options,
        requestId: options?.requestId ?? requestId
    };
}
function buildPlanFailureDiagnostic(message) {
    return {
        field: '*',
        stage: 'architect',
        message,
        severity: 'warning'
    };
}
function buildFieldFailureDiagnostic(message, field = '*') {
    return {
        field,
        stage: 'extractor',
        message,
        severity: 'warning'
    };
}
function createGeminiLeanPlanClient(options) {
    const { gemini, logger, defaultOptions } = options;
    return {
        async rewrite(request) {
            const prompt = createPlanPrompt(request);
            try {
                const response = await gemini.callGemini(prompt, withRequestOptions(defaultOptions, request.context.requestId));
                const usage = buildUsage(response);
                const payload = extractJson(response.content);
                if (!payload?.plan) {
                    const message = payload?.notes ?? 'Lean LLM plan rewrite did not return a plan';
                    logger?.warn?.('parserator-api:lean-plan-client-empty-plan', {
                        requestId: request.context.requestId,
                        message
                    });
                    return {
                        diagnostics: [buildPlanFailureDiagnostic(message)],
                        usage,
                        raw: payload ?? response.content
                    };
                }
                const diagnostics = normaliseDiagnostics(payload.diagnostics, 'architect');
                return {
                    plan: payload.plan,
                    confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
                    diagnostics,
                    usage: payload.usage ?? usage,
                    raw: payload
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown lean plan rewrite error';
                logger?.warn?.('parserator-api:lean-plan-client-error', {
                    requestId: request.context.requestId,
                    message
                });
                return {
                    diagnostics: [buildPlanFailureDiagnostic(`Lean LLM plan rewrite failed: ${message}`)]
                };
            }
        }
    };
}
function createGeminiLeanFieldClient(options) {
    const { gemini, logger, defaultOptions } = options;
    return {
        async resolve(request) {
            const prompt = createFieldPrompt(request);
            try {
                const response = await gemini.callGemini(prompt, withRequestOptions(defaultOptions, request.context.requestId));
                const usage = buildUsage(response);
                const payload = extractJson(response.content);
                if (!payload) {
                    const message = 'Lean LLM field fallback returned an unparseable response';
                    logger?.warn?.('parserator-api:lean-field-client-parse-error', {
                        requestId: request.context.requestId
                    });
                    return {
                        error: message,
                        diagnostics: [buildFieldFailureDiagnostic(message)],
                        usage
                    };
                }
                const diagnostics = normaliseDiagnostics(payload.diagnostics, 'extractor');
                const fieldDiagnostics = normaliseFieldDiagnostics(payload.fieldDiagnostics, 'extractor');
                return {
                    values: payload.values,
                    confidences: payload.confidences,
                    confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
                    diagnostics,
                    fieldDiagnostics,
                    usage: payload.usage ?? usage,
                    error: typeof payload.error === 'string' ? payload.error : undefined
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown lean field fallback error';
                logger?.warn?.('parserator-api:lean-field-client-error', {
                    requestId: request.context.requestId,
                    message
                });
                return {
                    error: message,
                    diagnostics: [buildFieldFailureDiagnostic(`Lean LLM field fallback failed: ${message}`)]
                };
            }
        }
    };
}
//# sourceMappingURL=lean-llm-clients.js.map