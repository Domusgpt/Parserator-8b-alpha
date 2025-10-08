"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultExtractorModule = void 0;
function safeParse(input) {
    try {
        const candidate = JSON.parse(input);
        if (candidate && typeof candidate === 'object') {
            return candidate;
        }
        return null;
    }
    catch {
        return null;
    }
}
function lookupValue(source, key) {
    if (key in source) {
        return source[key];
    }
    const normalisedKey = key.toLowerCase();
    for (const [candidateKey, value] of Object.entries(source)) {
        if (candidateKey.toLowerCase() === normalisedKey) {
            return value;
        }
    }
    return undefined;
}
function extractFromText(text, key) {
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`${escapedKey}[:\-\s]+([^\n\r]+)`, 'i');
    const match = regex.exec(text);
    if (match && match[1]) {
        return match[1].trim();
    }
    return undefined;
}
function buildDiagnostics(payload, confidence) {
    return [
        {
            stage: 'executor',
            severity: confidence >= 0.75 ? 'info' : 'warning',
            message: 'Extractor module executed heuristic data capture',
            details: {
                planSteps: payload.plan.steps.length,
                estimatedConfidence: confidence
            }
        }
    ];
}
class DefaultExtractorModule {
    constructor() {
        this.name = 'executor/default-extractor';
        this.kind = 'executor';
    }
    supports() {
        return true;
    }
    async execute(_context, payload) {
        const jsonCandidate = safeParse(payload.job.inputData);
        const output = {};
        let hits = 0;
        for (const step of payload.plan.steps) {
            let value;
            if (jsonCandidate) {
                value = lookupValue(jsonCandidate, step.targetKey);
            }
            if (value === undefined) {
                value = extractFromText(payload.job.inputData, step.targetKey);
            }
            if (value !== undefined) {
                output[step.targetKey] = value;
                hits += 1;
            }
        }
        const completionRatio = payload.plan.steps.length
            ? hits / payload.plan.steps.length
            : 1;
        const confidence = Math.min(0.98, 0.55 + completionRatio * 0.35);
        return {
            success: true,
            output,
            metadata: {
                confidence,
                completionRatio
            },
            diagnostics: buildDiagnostics(payload, confidence),
            tokensUsed: Math.round(payload.job.inputData.length / 4)
        };
    }
}
exports.DefaultExtractorModule = DefaultExtractorModule;
//# sourceMappingURL=extractor-module.js.map