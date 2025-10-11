"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeanLLMResolver = exports.ResolverRegistry = exports.PLAN_SHARED_STATE_KEY = exports.LEAN_LLM_USAGE_KEY = void 0;
exports.createDefaultResolvers = createDefaultResolvers;
exports.createLooseKeyValueResolver = createLooseKeyValueResolver;
const heuristics_1 = require("./heuristics");
const utils_1 = require("./utils");
const logger_1 = require("./logger");
const JSON_PAYLOAD_KEY = 'resolver:json:payload';
const JSON_PAYLOAD_ERROR_KEY = 'resolver:json:error';
const JSON_PAYLOAD_DIAG_KEY = 'resolver:json:diagnosed';
const SECTION_CACHE_KEY = 'resolver:sections:cache';
const LOOSE_KEY_VALUE_CACHE_KEY = 'resolver:loosekv:cache';
const LEAN_LLM_ATTEMPTED_KEY = 'resolver:leanllm:attempted';
const LEAN_LLM_SHARED_RESULTS_KEY = 'resolver:leanllm:shared-results';
exports.LEAN_LLM_USAGE_KEY = 'resolver:leanllm:usage';
exports.PLAN_SHARED_STATE_KEY = 'parserator:plan:active';
class ResolverRegistry {
    constructor(resolvers = [], logger) {
        this.logger = logger;
        this.resolvers = [...resolvers];
    }
    register(resolver, position = 'append') {
        if (position === 'prepend') {
            this.resolvers = [resolver, ...this.resolvers];
        }
        else {
            this.resolvers = [...this.resolvers, resolver];
        }
    }
    unregister(resolver) {
        const originalLength = this.resolvers.length;
        if (typeof resolver !== 'string') {
            this.resolvers = this.resolvers.filter(existing => existing !== resolver);
            if (this.resolvers.length !== originalLength) {
                return true;
            }
            resolver = resolver.name;
        }
        this.resolvers = this.resolvers.filter(existing => existing.name !== resolver);
        return this.resolvers.length !== originalLength;
    }
    replaceAll(resolvers) {
        this.resolvers = [...resolvers];
    }
    listResolvers() {
        return this.resolvers.map(resolver => resolver.name);
    }
    async resolve(context) {
        const diagnostics = [];
        let finalResult;
        for (const resolver of this.resolvers) {
            if (!resolver.supports(context.step)) {
                continue;
            }
            try {
                const result = await resolver.resolve(context);
                if (!result) {
                    continue;
                }
                diagnostics.push(...(result.diagnostics ?? []));
                finalResult = {
                    value: result.value,
                    confidence: result.confidence,
                    diagnostics: [...diagnostics],
                    resolver: result.resolver ?? resolver.name
                };
                if (result.value !== undefined) {
                    break;
                }
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Resolver failed with unknown error';
                const diagnostic = {
                    field: context.step.targetKey,
                    stage: 'extractor',
                    message: `${resolver.name} resolver threw: ${message}`,
                    severity: 'warning'
                };
                diagnostics.push(diagnostic);
                finalResult = {
                    value: undefined,
                    confidence: 0,
                    diagnostics: [...diagnostics],
                    resolver: resolver.name
                };
                this.logger?.warn?.('parserator-core:resolver-error', {
                    resolver: resolver.name,
                    message,
                    field: context.step.targetKey
                });
            }
        }
        if (finalResult) {
            return finalResult;
        }
        if (diagnostics.length) {
            return {
                value: undefined,
                confidence: 0,
                diagnostics: [...diagnostics],
                resolver: undefined
            };
        }
        return undefined;
    }
}
exports.ResolverRegistry = ResolverRegistry;
function createDefaultResolvers(logger) {
    return [
        new JsonFieldResolver(logger),
        new SectionFieldResolver(logger),
        new DefaultFieldResolver(logger)
    ];
}
function createLooseKeyValueResolver(logger) {
    return new LooseKeyValueResolver(logger);
}
class JsonFieldResolver {
    constructor(logger) {
        this.logger = logger;
        this.name = 'json-field';
    }
    supports() {
        return true;
    }
    resolve(context) {
        if ((0, heuristics_1.detectFormat)(context.inputData) !== 'json') {
            return undefined;
        }
        let payload = context.shared.get(JSON_PAYLOAD_KEY);
        if (payload === undefined) {
            try {
                payload = JSON.parse(context.inputData);
                context.shared.set(JSON_PAYLOAD_KEY, payload);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'unknown JSON parse error';
                context.shared.set(JSON_PAYLOAD_KEY, null);
                context.shared.set(JSON_PAYLOAD_ERROR_KEY, message);
                this.logger?.debug?.('parserator-core:json-resolver-parse-failed', { message });
            }
        }
        if (payload === null) {
            if (!context.shared.get(JSON_PAYLOAD_DIAG_KEY)) {
                context.shared.set(JSON_PAYLOAD_DIAG_KEY, true);
                const message = context.shared.get(JSON_PAYLOAD_ERROR_KEY) ??
                    'Input resembles JSON but could not be parsed. Falling back to heuristic extraction.';
                return {
                    value: undefined,
                    confidence: 0,
                    diagnostics: [
                        {
                            field: context.step.targetKey,
                            stage: 'extractor',
                            message: String(message),
                            severity: 'info'
                        }
                    ],
                    resolver: this.name
                };
            }
            return undefined;
        }
        const searchResult = findValueInJson(payload, context.step.targetKey);
        if (!searchResult) {
            return undefined;
        }
        const diagnostics = [
            {
                field: context.step.targetKey,
                stage: 'extractor',
                message: `Resolved via JSON path ${searchResult.path.join('.')}`,
                severity: 'info'
            }
        ];
        return {
            value: searchResult.value,
            confidence: 0.92,
            diagnostics,
            resolver: this.name
        };
    }
}
class SectionFieldResolver {
    constructor(logger) {
        this.logger = logger;
        this.name = 'section-field';
    }
    supports() {
        return true;
    }
    resolve(context) {
        if ((0, heuristics_1.detectFormat)(context.inputData) === 'json') {
            return undefined;
        }
        let sections = context.shared.get(SECTION_CACHE_KEY);
        if (!sections) {
            sections = (0, heuristics_1.segmentStructuredText)(context.inputData);
            context.shared.set(SECTION_CACHE_KEY, sections);
        }
        if (!sections.length) {
            return undefined;
        }
        const match = findBestSectionMatch(sections, context.step.targetKey);
        if (!match) {
            return undefined;
        }
        const sectionText = match.section.lines.join('\n').trim();
        if (!sectionText) {
            return undefined;
        }
        let value = resolveByValidation(sectionText, context.step);
        if (value === undefined) {
            value = extractFromSectionFallback(sectionText, context.step.validationType);
        }
        const confidence = (0, utils_1.clamp)(0.45 + match.score * 0.4, 0, 0.88);
        const diagnostics = [
            {
                field: context.step.targetKey,
                stage: 'extractor',
                message: value === undefined
                    ? `Section "${match.section.heading}" matched (score ${match.score.toFixed(2)}) but no value extracted`
                    : `Resolved from section "${match.section.heading}" (score ${match.score.toFixed(2)})`,
                severity: value === undefined ? (context.step.isRequired ? 'warning' : 'info') : 'info'
            }
        ];
        return {
            value,
            confidence: value === undefined ? confidence * 0.6 : confidence,
            diagnostics,
            resolver: this.name
        };
    }
}
class LooseKeyValueResolver {
    constructor(logger) {
        this.logger = logger;
        this.name = 'loose-key-value';
    }
    supports() {
        return true;
    }
    resolve(context) {
        if ((0, heuristics_1.detectFormat)(context.inputData) === 'json') {
            return undefined;
        }
        let cache = context.shared.get(LOOSE_KEY_VALUE_CACHE_KEY);
        if (!cache) {
            cache = buildLooseKeyValueMap(context.inputData);
            context.shared.set(LOOSE_KEY_VALUE_CACHE_KEY, cache);
        }
        const normalisedKey = (0, heuristics_1.normaliseKey)(context.step.targetKey);
        const candidates = cache.get(normalisedKey);
        if (!candidates || candidates.length === 0) {
            return undefined;
        }
        let resolved;
        let validated = false;
        for (const candidate of candidates) {
            const value = resolveByValidation(candidate, context.step);
            if (value !== undefined) {
                resolved = value;
                validated = true;
                break;
            }
        }
        if (resolved === undefined) {
            resolved = candidates[0];
        }
        if (resolved === undefined) {
            return undefined;
        }
        const base = context.step.isRequired ? 0.6 : 0.5;
        const spreadBoost = Math.min(candidates.length - 1, 2) * 0.03;
        const confidence = (0, utils_1.clamp)(base + (validated ? 0.18 : 0.08) + spreadBoost, 0, 0.86);
        const diagnostics = [
            {
                field: context.step.targetKey,
                stage: 'extractor',
                message: `Resolved from loose key-value match (${candidates.length} candidate${candidates.length > 1 ? 's' : ''})`,
                severity: 'info'
            }
        ];
        this.logger?.debug?.('parserator-core:resolver-loose-hit', {
            field: context.step.targetKey,
            matches: candidates.length,
            validated
        });
        return {
            value: resolved,
            confidence,
            diagnostics,
            resolver: this.name
        };
    }
}
class DefaultFieldResolver {
    constructor(logger) {
        this.logger = logger;
        this.name = 'default-validation';
    }
    supports() {
        return true;
    }
    resolve(context) {
        const diagnostics = [];
        const value = resolveByValidation(context.inputData, context.step);
        if (value === undefined) {
            if (context.step.isRequired) {
                diagnostics.push({
                    field: context.step.targetKey,
                    stage: 'extractor',
                    message: `${context.step.targetKey} not found in input`,
                    severity: 'warning'
                });
            }
            else {
                diagnostics.push({
                    field: context.step.targetKey,
                    stage: 'extractor',
                    message: `${context.step.targetKey} not located but field marked optional`,
                    severity: 'info'
                });
            }
        }
        if (value !== undefined) {
            this.logger?.debug?.('parserator-core:resolver-default-hit', {
                field: context.step.targetKey,
                validationType: context.step.validationType
            });
        }
        const confidence = value === undefined ? 0 : confidenceForType(context.step.validationType);
        return {
            value,
            confidence,
            diagnostics,
            resolver: this.name
        };
    }
}
class LeanLLMResolver {
    constructor(options) {
        this.options = options;
        this.logger = options.logger ?? (0, logger_1.createDefaultLogger)();
        this.client = options.client;
        this.allowOptionalFields = options.allowOptionalFields ?? false;
        this.defaultConfidence = options.defaultConfidence ?? 0.6;
        this.maxInputCharacters = options.maxInputCharacters;
        this.requestFormatter = options.requestFormatter;
        this.clientName = this.client.name ?? 'lean-llm';
        this.planConfidenceGate = options.planConfidenceGate;
        this.maxInvocationsPerParse = options.maxInvocationsPerParse;
        this.maxTokensPerParse = options.maxTokensPerParse;
        this.name = options.name ?? `${this.clientName}-fallback`;
        if (!options.client) {
            throw new Error('LeanLLMResolver requires a client implementation');
        }
    }
    supports() {
        return true;
    }
    async resolve(context) {
        if (!context.config.enableFieldFallbacks) {
            return undefined;
        }
        if (!this.allowOptionalFields && !context.step.isRequired) {
            return undefined;
        }
        const reused = this.tryReuseSharedExtraction(context);
        if (reused) {
            return reused;
        }
        const plan = context.shared.get(exports.PLAN_SHARED_STATE_KEY);
        if (!this.shouldInvoke(context, plan)) {
            return undefined;
        }
        const attempted = this.ensureAttemptedSet(context.shared);
        if (attempted.has(context.step.targetKey)) {
            return undefined;
        }
        attempted.add(context.step.targetKey);
        context.shared.set(LEAN_LLM_ATTEMPTED_KEY, attempted);
        const inputData = this.trimInput(context.inputData);
        const request = this.buildRequest({ plan, step: context.step, inputData }, context);
        this.logger.debug?.('parserator-core:lean-llm-resolver-invoked', {
            field: context.step.targetKey,
            required: context.step.isRequired,
            client: this.clientName,
            planId: plan?.id
        });
        try {
            const response = await this.client.extractField(request);
            const result = this.toResolution(context, response);
            const sharedKeys = this.storeSharedResults(context, response, result.confidence);
            this.recordInvocationOutcome(context, response, result.confidence, sharedKeys);
            this.logger.info?.('parserator-core:lean-llm-resolver-complete', {
                field: context.step.targetKey,
                resolved: response.value !== undefined,
                confidence: result.confidence,
                client: this.clientName,
                tokensUsed: response.tokensUsed
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown lean LLM error';
            this.logger.warn?.('parserator-core:lean-llm-resolver-error', {
                field: context.step.targetKey,
                client: this.clientName,
                error: message
            });
            this.recordInvocationError(context, message);
            return {
                value: undefined,
                confidence: 0,
                diagnostics: [
                    {
                        field: context.step.targetKey,
                        stage: 'extractor',
                        message: `Lean LLM fallback ${this.clientName} failed: ${message}`,
                        severity: 'warning'
                    }
                ],
                resolver: this.name
            };
        }
    }
    buildRequest(context, resolutionContext) {
        if (this.requestFormatter) {
            return this.requestFormatter(context);
        }
        return {
            field: resolutionContext.step.targetKey,
            description: resolutionContext.step.description,
            instruction: resolutionContext.step.searchInstruction,
            validationType: resolutionContext.step.validationType,
            input: context.inputData,
            plan: context.plan
                ? {
                    id: context.plan.id,
                    version: context.plan.version,
                    strategy: context.plan.strategy,
                    origin: context.plan.metadata.origin,
                    systemContext: context.plan.metadata.context
                }
                : undefined
        };
    }
    toResolution(context, response) {
        const baseConfidence = (0, utils_1.clamp)(response.confidence ?? this.defaultConfidence, 0, 1);
        const confidence = response.value === undefined ? Math.min(baseConfidence, 0.45) : baseConfidence;
        const diagnostics = [
            {
                field: context.step.targetKey,
                stage: 'extractor',
                message: this.composeOutcomeMessage(context.step.targetKey, response, confidence),
                severity: response.value === undefined ? 'warning' : 'info'
            }
        ];
        if (response.reason) {
            diagnostics.push({
                field: context.step.targetKey,
                stage: 'extractor',
                message: `Lean LLM rationale: ${response.reason}`,
                severity: 'info'
            });
        }
        return {
            value: response.value,
            confidence,
            diagnostics,
            resolver: this.name
        };
    }
    composeOutcomeMessage(field, response, confidence) {
        const outcome = response.value === undefined ? 'examined' : 'resolved';
        let message = `Lean LLM fallback ${this.clientName} ${outcome} ${field}`;
        if (!Number.isNaN(confidence)) {
            message += ` (confidence ${confidence.toFixed(2)})`;
        }
        if (typeof response.tokensUsed === 'number') {
            message += ` using ${response.tokensUsed} tokens`;
        }
        return message;
    }
    shouldInvoke(context, plan) {
        const summary = this.ensureUsageSummary(context.shared);
        if (this.planConfidenceGate !== undefined) {
            const plannerConfidence = typeof plan?.metadata?.plannerConfidence === 'number'
                ? plan.metadata.plannerConfidence
                : undefined;
            if (plannerConfidence !== undefined && plannerConfidence >= this.planConfidenceGate) {
                this.recordPlanGateSkip(context, plannerConfidence);
                this.logger.debug?.('parserator-core:lean-llm-resolver-skipped-confidence', {
                    field: context.step.targetKey,
                    planConfidence: plannerConfidence,
                    gate: this.planConfidenceGate,
                    planId: plan?.id
                });
                return false;
            }
        }
        if (this.maxInvocationsPerParse !== undefined &&
            summary.totalInvocations >= this.maxInvocationsPerParse) {
            this.recordLimitSkip(context, 'invocations', this.maxInvocationsPerParse, summary.totalInvocations);
            this.logger.debug?.('parserator-core:lean-llm-resolver-skipped-limit', {
                field: context.step.targetKey,
                type: 'invocations',
                limit: this.maxInvocationsPerParse,
                totalInvocations: summary.totalInvocations
            });
            return false;
        }
        if (this.maxTokensPerParse !== undefined && summary.totalTokens >= this.maxTokensPerParse) {
            this.recordLimitSkip(context, 'tokens', this.maxTokensPerParse, summary.totalTokens);
            this.logger.debug?.('parserator-core:lean-llm-resolver-skipped-limit', {
                field: context.step.targetKey,
                type: 'tokens',
                limit: this.maxTokensPerParse,
                totalTokens: summary.totalTokens
            });
            return false;
        }
        return true;
    }
    tryReuseSharedExtraction(context) {
        const shared = context.shared.get(LEAN_LLM_SHARED_RESULTS_KEY);
        if (!(shared instanceof Map)) {
            return undefined;
        }
        const existing = shared.get(context.step.targetKey);
        if (!existing) {
            return undefined;
        }
        const confidence = (0, utils_1.clamp)(existing.confidence ?? this.defaultConfidence, 0, 1);
        const diagnostics = [
            {
                field: context.step.targetKey,
                stage: 'extractor',
                message: `Reused lean LLM shared extraction from ${existing.sourceField ?? 'lean fallback'}`,
                severity: 'info'
            }
        ];
        if (existing.reason) {
            diagnostics.push({
                field: context.step.targetKey,
                stage: 'extractor',
                message: `Lean LLM rationale: ${existing.reason}`,
                severity: 'info'
            });
        }
        this.logger.debug?.('parserator-core:lean-llm-resolver-reuse', {
            field: context.step.targetKey,
            sourceField: existing.sourceField ?? context.step.targetKey
        });
        this.recordReuse(context, existing, confidence);
        return {
            value: existing.value,
            confidence,
            diagnostics,
            resolver: this.name
        };
    }
    storeSharedResults(context, response, confidence) {
        const extras = this.extractSharedExtractions(response, context.step.targetKey, confidence);
        if (response.value !== undefined) {
            extras.set(context.step.targetKey, {
                value: response.value,
                confidence,
                reason: response.reason,
                tokensUsed: response.tokensUsed,
                sourceField: context.step.targetKey
            });
        }
        if (extras.size === 0) {
            return [];
        }
        const shared = this.ensureSharedExtractionsMap(context.shared);
        const keys = [];
        for (const [key, entry] of extras.entries()) {
            shared.set(key, entry);
            keys.push(key);
        }
        this.logger.debug?.('parserator-core:lean-llm-resolver-shared', {
            field: context.step.targetKey,
            sharedKeys: keys
        });
        return keys;
    }
    extractSharedExtractions(response, sourceField, fallbackConfidence) {
        const raw = response.sharedExtractions ?? this.extractMetadataSharedExtractions(response.metadata);
        if (!raw) {
            return new Map();
        }
        const extras = new Map();
        for (const [key, value] of Object.entries(raw)) {
            const normalised = this.normaliseSharedExtractionEntry(value, {
                confidence: fallbackConfidence,
                reason: response.reason,
                tokensUsed: response.tokensUsed,
                sourceField
            });
            if (normalised) {
                extras.set(key, normalised);
            }
        }
        return extras;
    }
    extractMetadataSharedExtractions(metadata) {
        if (!metadata) {
            return undefined;
        }
        const camel = metadata.sharedExtractions;
        if (camel && typeof camel === 'object' && !Array.isArray(camel)) {
            return camel;
        }
        const snake = metadata['shared_extractions'];
        if (snake && typeof snake === 'object' && !Array.isArray(snake)) {
            return snake;
        }
        return undefined;
    }
    normaliseSharedExtractionEntry(raw, fallback) {
        if (raw === undefined || raw === null) {
            return undefined;
        }
        if (typeof raw !== 'object' || Array.isArray(raw)) {
            return {
                value: raw,
                confidence: (0, utils_1.clamp)(fallback.confidence, 0, 1),
                reason: fallback.reason,
                tokensUsed: fallback.tokensUsed,
                sourceField: fallback.sourceField
            };
        }
        const record = raw;
        const value = 'value' in record
            ? record.value
            : 'result' in record
                ? record.result
                : record;
        const confidence = typeof record.confidence === 'number'
            ? (0, utils_1.clamp)(record.confidence, 0, 1)
            : (0, utils_1.clamp)(fallback.confidence, 0, 1);
        const reason = typeof record.reason === 'string' && record.reason.trim().length > 0
            ? record.reason
            : fallback.reason;
        const tokensUsed = typeof record.tokensUsed === 'number' && Number.isFinite(record.tokensUsed)
            ? record.tokensUsed
            : fallback.tokensUsed;
        const sourceField = typeof record.sourceField === 'string' && record.sourceField.trim().length > 0
            ? record.sourceField
            : fallback.sourceField;
        return {
            value,
            confidence,
            reason,
            tokensUsed,
            sourceField
        };
    }
    ensureUsageSummary(shared) {
        const existing = shared.get(exports.LEAN_LLM_USAGE_KEY);
        if (existing &&
            typeof existing === 'object' &&
            'fields' in existing) {
            const summary = existing;
            if (typeof summary.skippedByLimits !== 'number') {
                summary.skippedByLimits = 0;
            }
            this.applySummaryConfigMetadata(summary);
            return summary;
        }
        const summary = {
            totalInvocations: 0,
            resolvedFields: 0,
            reusedResolutions: 0,
            skippedByPlanConfidence: 0,
            skippedByLimits: 0,
            sharedExtractions: 0,
            totalTokens: 0,
            fields: []
        };
        this.applySummaryConfigMetadata(summary);
        shared.set(exports.LEAN_LLM_USAGE_KEY, summary);
        return summary;
    }
    applySummaryConfigMetadata(summary) {
        if (this.planConfidenceGate !== undefined) {
            summary.planConfidenceGate = this.planConfidenceGate;
        }
        else if (summary.planConfidenceGate !== undefined) {
            delete summary.planConfidenceGate;
        }
        if (this.maxInvocationsPerParse !== undefined) {
            summary.maxInvocationsPerParse = this.maxInvocationsPerParse;
        }
        else if (summary.maxInvocationsPerParse !== undefined) {
            delete summary.maxInvocationsPerParse;
        }
        if (this.maxTokensPerParse !== undefined) {
            summary.maxTokensPerParse = this.maxTokensPerParse;
        }
        else if (summary.maxTokensPerParse !== undefined) {
            delete summary.maxTokensPerParse;
        }
    }
    recordPlanGateSkip(context, plannerConfidence) {
        const summary = this.ensureUsageSummary(context.shared);
        if (this.planConfidenceGate !== undefined && summary.planConfidenceGate === undefined) {
            summary.planConfidenceGate = this.planConfidenceGate;
        }
        summary.skippedByPlanConfidence += 1;
        const entry = {
            field: context.step.targetKey,
            action: 'skipped',
            resolved: false,
            plannerConfidence,
            gate: this.planConfidenceGate,
            reason: 'plan-confidence-gate'
        };
        summary.fields.push(entry);
    }
    recordLimitSkip(context, type, limit, currentValue) {
        const summary = this.ensureUsageSummary(context.shared);
        summary.skippedByLimits += 1;
        const entry = {
            field: context.step.targetKey,
            action: 'skipped',
            resolved: false,
            reason: type === 'invocations' ? 'invocation-limit' : 'token-budget',
            limitType: type,
            limit,
            currentInvocations: type === 'invocations' ? currentValue : summary.totalInvocations,
            currentTokens: type === 'tokens' ? currentValue : summary.totalTokens
        };
        summary.fields.push(entry);
    }
    recordInvocationOutcome(context, response, confidence, sharedKeys) {
        const summary = this.ensureUsageSummary(context.shared);
        if (this.planConfidenceGate !== undefined && summary.planConfidenceGate === undefined) {
            summary.planConfidenceGate = this.planConfidenceGate;
        }
        summary.totalInvocations += 1;
        const resolved = response.value !== undefined;
        if (resolved) {
            summary.resolvedFields += 1;
        }
        if (typeof response.tokensUsed === 'number' && Number.isFinite(response.tokensUsed)) {
            summary.totalTokens += response.tokensUsed;
        }
        if (sharedKeys.length) {
            summary.sharedExtractions += sharedKeys.length;
        }
        const entry = {
            field: context.step.targetKey,
            action: 'invoked',
            resolved,
            confidence: Number.isFinite(confidence) ? (0, utils_1.clamp)(confidence, 0, 1) : undefined,
            tokensUsed: typeof response.tokensUsed === 'number' && Number.isFinite(response.tokensUsed)
                ? response.tokensUsed
                : undefined,
            reason: response.reason,
            sharedKeys: sharedKeys.length ? sharedKeys : undefined
        };
        summary.fields.push(entry);
    }
    recordInvocationError(context, message) {
        const summary = this.ensureUsageSummary(context.shared);
        if (this.planConfidenceGate !== undefined && summary.planConfidenceGate === undefined) {
            summary.planConfidenceGate = this.planConfidenceGate;
        }
        summary.totalInvocations += 1;
        const entry = {
            field: context.step.targetKey,
            action: 'invoked',
            resolved: false,
            error: message
        };
        summary.fields.push(entry);
    }
    recordReuse(context, extraction, confidence) {
        const summary = this.ensureUsageSummary(context.shared);
        if (this.planConfidenceGate !== undefined && summary.planConfidenceGate === undefined) {
            summary.planConfidenceGate = this.planConfidenceGate;
        }
        summary.reusedResolutions += 1;
        const entry = {
            field: context.step.targetKey,
            action: 'reused',
            resolved: extraction.value !== undefined,
            confidence: Number.isFinite(confidence) ? (0, utils_1.clamp)(confidence, 0, 1) : undefined,
            tokensUsed: typeof extraction.tokensUsed === 'number' && Number.isFinite(extraction.tokensUsed)
                ? extraction.tokensUsed
                : undefined,
            reason: extraction.reason,
            sourceField: extraction.sourceField ?? context.step.targetKey
        };
        summary.fields.push(entry);
    }
    ensureSharedExtractionsMap(shared) {
        const existing = shared.get(LEAN_LLM_SHARED_RESULTS_KEY);
        if (existing instanceof Map) {
            return existing;
        }
        const created = new Map();
        shared.set(LEAN_LLM_SHARED_RESULTS_KEY, created);
        return created;
    }
    ensureAttemptedSet(shared) {
        const existing = shared.get(LEAN_LLM_ATTEMPTED_KEY);
        if (existing instanceof Set) {
            return existing;
        }
        const created = new Set();
        shared.set(LEAN_LLM_ATTEMPTED_KEY, created);
        return created;
    }
    trimInput(input) {
        if (!this.maxInputCharacters || input.length <= this.maxInputCharacters) {
            return input;
        }
        const slice = input.slice(0, this.maxInputCharacters);
        return `${slice}\n... [truncated ${input.length - slice.length} chars]`;
    }
}
exports.LeanLLMResolver = LeanLLMResolver;
function buildLooseKeyValueMap(input) {
    const map = new Map();
    const lines = input.split(/\r?\n/);
    for (const raw of lines) {
        if (!raw) {
            continue;
        }
        const line = raw.trim();
        if (!line || line.length < 3) {
            continue;
        }
        if (/^[#>*]/.test(line) || /^[-*•]\s*$/.test(line)) {
            continue;
        }
        let match = line.match(/^\s*([^:;=\-|]+?)\s*[:=]\s*(.+?)\s*$/u);
        if (!match) {
            match = line.match(/^\s*([^:;=\-|]+?)\s*(?:-|–|—)\s+(.+?)\s*$/u);
        }
        if (!match) {
            continue;
        }
        const key = (0, heuristics_1.normaliseKey)(match[1]);
        if (!key || key.length < 2) {
            continue;
        }
        const value = match[2]?.trim();
        if (!value) {
            continue;
        }
        const existing = map.get(key);
        if (existing) {
            if (!existing.includes(value)) {
                existing.push(value);
            }
        }
        else {
            map.set(key, [value]);
        }
    }
    return map;
}
function resolveByValidation(input, step) {
    switch (step.validationType) {
        case 'email':
            return matchFirst(input, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        case 'phone':
            return matchFirst(input, /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)[\d\s-]{7,}/);
        case 'iso_date':
            return matchFirst(input, /\d{4}-\d{2}-\d{2}/);
        case 'date':
            return (matchFirst(input, /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/) ||
                matchFirst(input, /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i));
        case 'url':
            return matchFirst(input, /https?:\/\/[^\s]+/i);
        case 'number':
            return matchNumber(input);
        case 'boolean':
            return matchBoolean(input);
        case 'string_array':
            return matchList(input, step.targetKey, false);
        case 'number_array':
            return matchList(input, step.targetKey, true);
        case 'currency':
            return matchCurrency(input);
        case 'percentage':
            return matchPercentage(input);
        case 'address':
            return matchAddress(input);
        case 'name':
            return matchName(input);
        default:
            return matchByLabel(input, step.targetKey);
    }
}
function confidenceForType(validationType) {
    switch (validationType) {
        case 'email':
        case 'phone':
        case 'iso_date':
        case 'url':
            return 0.82;
        case 'date':
        case 'number':
            return 0.78;
        case 'boolean':
            return 0.7;
        case 'string_array':
        case 'number_array':
            return 0.74;
        case 'currency':
            return 0.8;
        case 'percentage':
            return 0.76;
        case 'address':
            return 0.72;
        case 'name':
            return 0.75;
        case 'object':
            return 0.65;
        default:
            return 0.6;
    }
}
function matchFirst(input, regex) {
    const match = input.match(regex);
    return match ? match[0].trim() : undefined;
}
function matchNumber(input) {
    const match = input.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
}
function matchBoolean(input) {
    const lowered = input.toLowerCase();
    if (/(^|\b)(true|yes|enabled)(\b|$)/.test(lowered)) {
        return true;
    }
    if (/(^|\b)(false|no|disabled)(\b|$)/.test(lowered)) {
        return false;
    }
    return undefined;
}
function matchList(input, key, numeric) {
    const labelPattern = new RegExp(`${(0, heuristics_1.escapeRegExp)(key)}\\s*[:\-]?\\s*(.+)`, 'i');
    const labelMatch = input.match(labelPattern);
    const source = labelMatch ? labelMatch[1] : input;
    const items = source
        .split(/[\n,;]+/)
        .map(item => item.trim())
        .filter(Boolean);
    if (items.length === 0) {
        return undefined;
    }
    if (numeric) {
        const numbers = items
            .map(item => item.match(/-?\d+(?:\.\d+)?/))
            .filter((match) => !!match)
            .map(match => Number(match[0]));
        return numbers.length ? numbers : undefined;
    }
    return items;
}
function matchByLabel(input, key) {
    const labelPattern = new RegExp(`${(0, heuristics_1.escapeRegExp)(key)}\\s*[:\-]?\\s*(.+)`, 'i');
    const match = input.match(labelPattern);
    if (match) {
        return match[1].split(/\r?\n/)[0].trim();
    }
    return undefined;
}
function matchCurrency(input) {
    const currencyPattern = /(?:[$€£¥₹]|AUD|CAD|USD|EUR|GBP)\s?-?\d{1,3}(?:[\d,]*\d)?(?:\.\d+)?/i;
    const match = input.match(currencyPattern);
    if (match) {
        return match[0].replace(/\s{2,}/g, ' ').trim();
    }
    const standaloneNumber = input.match(/-?\d{1,3}(?:[\d,]*\d)?(?:\.\d+)?/);
    if (standaloneNumber && /amount|price|cost|total/i.test(input)) {
        return standaloneNumber[0];
    }
    return undefined;
}
function matchPercentage(input) {
    const percentPattern = /-?\d+(?:\.\d+)?\s?(?:%|percent)/i;
    const match = input.match(percentPattern);
    return match ? match[0].replace(/\s+/g, ' ').trim() : undefined;
}
function matchAddress(input) {
    const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const addressPattern = /\d{1,6}\s+[A-Za-z0-9.'\s]+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir)\b/i;
    for (const line of lines) {
        const match = line.match(addressPattern);
        if (match) {
            return match[0];
        }
    }
    if (lines.length >= 2) {
        const combined = lines.slice(0, 2).join(', ');
        if (/\d/.test(combined) && /(Street|St|Road|Rd|Ave|Avenue|Boulevard|Blvd|Drive|Dr)/i.test(combined)) {
            return combined;
        }
    }
    return undefined;
}
function matchName(input) {
    const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const csvCandidate = extractNameFromCsv(lines);
    if (csvCandidate) {
        return csvCandidate;
    }
    const labelledMatch = input.match(/(?:^|\b)(?:name|customer|contact)\s*[:\-]\s*([^\n\r]+)/i);
    if (labelledMatch) {
        const value = labelledMatch[1].split(/[\r\n,]/)[0]?.trim();
        if (value) {
            return value;
        }
    }
    const introductionMatch = input.match(/\bmy name is\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})/i);
    if (introductionMatch) {
        return introductionMatch[1].trim();
    }
    const multiWordLine = lines.find(line => /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(line));
    if (multiWordLine) {
        return multiWordLine;
    }
    const multiWordMatches = input.match(/[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)+/g);
    if (multiWordMatches && multiWordMatches.length) {
        return multiWordMatches.sort((a, b) => b.length - a.length)[0].trim();
    }
    const singleWordLine = lines.find(line => /^[A-Z][a-z]+$/.test(line));
    return singleWordLine ?? undefined;
}
function extractNameFromCsv(lines) {
    if (lines.length < 2 || !lines.some(line => line.includes(','))) {
        return undefined;
    }
    const [headerLine, ...dataLines] = lines;
    if (!headerLine.includes(',')) {
        return undefined;
    }
    const headers = headerLine.split(',').map(part => part.trim()).filter(Boolean);
    const nameIndex = headers.findIndex(header => {
        const normalised = (0, heuristics_1.normaliseKey)(header);
        return normalised === 'name' || normalised.includes('name');
    });
    if (nameIndex === -1) {
        return undefined;
    }
    for (const line of dataLines) {
        if (!line.includes(',')) {
            continue;
        }
        const values = line.split(',').map(part => part.trim());
        const value = values[nameIndex];
        if (!value) {
            continue;
        }
        if (/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(value)) {
            return value;
        }
        if (value) {
            return value;
        }
    }
    return undefined;
}
function findBestSectionMatch(sections, targetKey) {
    const target = (0, heuristics_1.normaliseKey)(targetKey);
    if (!target) {
        return undefined;
    }
    let best;
    for (const section of sections) {
        const score = scoreSection(section, targetKey, target);
        if (score <= 0.3) {
            continue;
        }
        if (!best || score > best.score) {
            best = { section, score };
        }
    }
    return best;
}
function scoreSection(section, targetKey, normalisedTarget) {
    if (!section.heading) {
        return section.lines.some(line => lineContainsLabel(line, targetKey)) ? 0.45 : 0.25;
    }
    const heading = (0, heuristics_1.normaliseKey)(section.heading);
    let score = 0;
    if (heading === normalisedTarget) {
        score = 1;
    }
    else if (heading.includes(normalisedTarget) || normalisedTarget.includes(heading)) {
        score = 0.85;
    }
    else {
        const headingParts = new Set(heading.split(' ').filter(Boolean));
        const targetParts = new Set(normalisedTarget.split(' ').filter(Boolean));
        const shared = [...headingParts].filter(part => targetParts.has(part));
        if (shared.length) {
            score = Math.max(score, 0.5 + Math.min(shared.length / Math.max(targetParts.size, 1), 0.4));
        }
    }
    if (section.lines.some(line => lineContainsLabel(line, targetKey))) {
        score = Math.max(score, 0.7);
    }
    return score;
}
function lineContainsLabel(line, key) {
    const pattern = new RegExp(`${(0, heuristics_1.escapeRegExp)(key)}\\s*[:\-]`, 'i');
    return pattern.test(line);
}
function extractFromSectionFallback(value, validationType) {
    const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) {
        return undefined;
    }
    switch (validationType) {
        case 'string_array':
            return lines;
        case 'number_array': {
            const numbers = lines
                .map(line => line.match(/-?\d+(?:\.\d+)?/))
                .filter((match) => Boolean(match))
                .map(match => Number(match[0]));
            return numbers.length ? numbers : undefined;
        }
        case 'address':
            return matchAddress(value);
        case 'name':
            return matchName(value);
        default:
            return lines[0];
    }
}
function findValueInJson(payload, targetKey) {
    if (!payload || typeof payload !== 'object') {
        return undefined;
    }
    const normalisedTarget = (0, heuristics_1.normaliseKey)(targetKey);
    const candidateKeys = buildCandidateKeys(targetKey);
    const queue = [
        { value: payload, path: [] }
    ];
    while (queue.length) {
        const current = queue.shift();
        if (Array.isArray(current.value)) {
            current.value.forEach((item, index) => {
                queue.push({ value: item, path: [...current.path, String(index)] });
            });
            continue;
        }
        if (current.value && typeof current.value === 'object') {
            for (const [key, value] of Object.entries(current.value)) {
                const normalisedKey = (0, heuristics_1.normaliseKey)(key);
                if (normalisedKey === normalisedTarget || candidateKeys.has(normalisedKey)) {
                    return { value, path: [...current.path, key] };
                }
                queue.push({ value, path: [...current.path, key] });
            }
        }
    }
    return undefined;
}
function buildCandidateKeys(targetKey) {
    const candidates = new Set();
    const base = (0, heuristics_1.normaliseKey)(targetKey);
    candidates.add(base);
    const collapsed = targetKey.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (collapsed) {
        candidates.add(collapsed);
    }
    const pieces = (0, heuristics_1.normaliseKey)(targetKey).split(' ');
    if (pieces.length > 1) {
        candidates.add(pieces.join(''));
        candidates.add(pieces.join('_'));
    }
    return candidates;
}
//# sourceMappingURL=resolvers.js.map