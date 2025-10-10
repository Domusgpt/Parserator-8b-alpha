"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeanLLMClient = void 0;
class LeanLLMClient {
    constructor(geminiService, options = {}, logger = console, name = 'gemini-lean') {
        this.geminiService = geminiService;
        this.options = options;
        this.logger = logger;
        this.name = name;
    }
    async extractField(request) {
        const prompt = this.buildPrompt(request);
        try {
            const response = await this.geminiService.callGemini(prompt, {
                model: this.options.model,
                maxTokens: this.options.maxTokens,
                temperature: this.options.temperature
            });
            const parsed = this.parseResponse(response, request);
            return {
                ...parsed,
                tokensUsed: response.tokensUsed,
                metadata: {
                    model: response.model,
                    finishReason: response.finishReason
                }
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown lean LLM error';
            this.logger.warn('LeanLLMClient call failed', {
                field: request.field,
                model: this.options.model,
                message
            });
            throw error;
        }
    }
    buildPrompt(request) {
        const preamble = this.options.promptPreamble ??
            'You are a lightweight extraction function. Return concise JSON values only.';
        const lines = [
            preamble,
            '',
            `Field: ${request.field}`,
            `Description: ${request.description}`,
            `Validation: ${request.validationType}`,
            `Instruction: ${request.instruction}`
        ];
        if (request.plan) {
            lines.push(`Plan ID: ${request.plan.id} (v${request.plan.version}, ${request.plan.strategy})`, `Plan origin: ${request.plan.origin}`);
            if (request.plan.systemContext) {
                lines.push(`Detected context: ${request.plan.systemContext.label} (${request.plan.systemContext.id})`);
            }
        }
        lines.push('', 'Return strictly valid JSON containing the keys "value", "confidence", and "reason".', 'You may also include an optional "sharedExtractions" object that maps additional field names to {"value": <any>, "confidence": <number between 0 and 1>, "reason": "<optional explanation>"}.', 'Do not include Markdown fences or additional commentary.', '', 'Document:', '"""', request.input, '"""');
        return lines.join('\n');
    }
    parseResponse(response, request) {
        const payload = this.extractJsonPayload(response.content);
        if (!payload) {
            this.logger.warn('LeanLLMClient received response without JSON payload', {
                field: request.field,
                model: response.model
            });
            return {
                value: undefined,
                reason: 'Lean LLM response did not include a JSON payload.'
            };
        }
        try {
            const parsed = JSON.parse(payload);
            const confidence = this.normaliseConfidence(parsed.confidence);
            const sharedExtractions = this.parseSharedExtractions(parsed.sharedExtractions ?? parsed.shared_extractions);
            return {
                value: parsed.value,
                confidence,
                reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
                sharedExtractions
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid JSON';
            this.logger.warn('LeanLLMClient could not parse response JSON', {
                field: request.field,
                model: response.model,
                message
            });
            return {
                value: undefined,
                confidence: undefined,
                reason: 'Lean LLM response JSON could not be parsed.'
            };
        }
    }
    extractJsonPayload(content) {
        if (!content) {
            return undefined;
        }
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = codeBlockMatch ? codeBlockMatch[1] : content;
        const braceMatch = candidate.match(/\{[\s\S]*\}/);
        return braceMatch ? braceMatch[0] : undefined;
    }
    normaliseConfidence(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return clampConfidence(value);
        }
        if (typeof value === 'string') {
            const parsed = Number(value.trim());
            if (!Number.isNaN(parsed)) {
                return clampConfidence(parsed);
            }
        }
        return undefined;
    }
    parseSharedExtractions(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return undefined;
        }
        const result = {};
        for (const [key, value] of Object.entries(raw)) {
            if (value === undefined || value === null) {
                continue;
            }
            if (typeof value !== 'object' || Array.isArray(value)) {
                result[key] = { value };
                continue;
            }
            const record = value;
            const entryValue = record.value !== undefined
                ? record.value
                : record.result !== undefined
                    ? record.result
                    : record;
            const entryConfidence = this.normaliseConfidence(record.confidence);
            const reason = typeof record.reason === 'string' ? record.reason : undefined;
            const tokensUsed = typeof record.tokensUsed === 'number' && Number.isFinite(record.tokensUsed)
                ? record.tokensUsed
                : undefined;
            const sourceField = typeof record.sourceField === 'string' && record.sourceField.trim().length > 0
                ? record.sourceField
                : undefined;
            result[key] = {
                value: entryValue,
                confidence: entryConfidence,
                reason,
                tokensUsed,
                sourceField
            };
        }
        return Object.keys(result).length > 0 ? result : undefined;
    }
}
exports.LeanLLMClient = LeanLLMClient;
function clampConfidence(value) {
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}
//# sourceMappingURL=lean-llm-client.js.map