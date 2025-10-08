"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectValidationType = detectValidationType;
exports.isFieldOptional = isFieldOptional;
exports.humaniseKey = humaniseKey;
exports.buildSearchInstruction = buildSearchInstruction;
exports.detectFormat = detectFormat;
exports.estimateComplexity = estimateComplexity;
exports.estimateTokenCost = estimateTokenCost;
exports.escapeRegExp = escapeRegExp;
exports.normaliseKey = normaliseKey;
exports.buildPlannerSteps = buildPlannerSteps;
function detectValidationType(key, schemaValue) {
    if (typeof schemaValue === 'string') {
        const lowered = schemaValue.toLowerCase();
        if (lowered.includes('email'))
            return 'email';
        if (lowered.includes('phone'))
            return 'phone';
        if (lowered.includes('date'))
            return 'date';
        if (lowered.includes('url'))
            return 'url';
        if (lowered.includes('number'))
            return 'number';
        if (lowered.includes('boolean'))
            return 'boolean';
    }
    const normalised = key.toLowerCase();
    if (normalised.includes('email'))
        return 'email';
    if (normalised.includes('phone'))
        return 'phone';
    if (normalised.includes('date'))
        return normalised.includes('iso') ? 'iso_date' : 'date';
    if (normalised.includes('url') || normalised.includes('link'))
        return 'url';
    if (normalised.includes('count') || normalised.includes('number') || normalised.includes('total')) {
        return 'number';
    }
    if (normalised.includes('flag') || normalised.startsWith('is_') || normalised.startsWith('has_')) {
        return 'boolean';
    }
    if (normalised.includes('ids') || normalised.includes('numbers'))
        return 'number_array';
    if (normalised.includes('list') || normalised.includes('tags'))
        return 'string_array';
    return 'string';
}
function isFieldOptional(schemaValue) {
    if (schemaValue &&
        typeof schemaValue === 'object' &&
        'optional' in schemaValue) {
        return Boolean(schemaValue.optional);
    }
    return false;
}
function humaniseKey(key) {
    return key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function buildSearchInstruction(humanKey, validationType, instructions) {
    const base = `Locate the value for "${humanKey}"`;
    const guidance = {
        email: 'Prefer RFC compliant email addresses.',
        phone: 'Return the primary phone number including country code when available.',
        date: 'Return the most relevant date mentioned (dd/mm/yyyy accepted).',
        iso_date: 'Return the ISO-8601 date representation (YYYY-MM-DD).',
        url: 'Return the main URL or link that matches the request.',
        number: 'Return a numeric value; remove formatting characters.',
        number_array: 'Return numeric values as an array.',
        string_array: 'Return textual values as an array.',
        boolean: 'Return true/false based on clear affirmative language.',
        string: 'Return the literal text response.',
        object: 'Return structured JSON describing the field.',
        custom: 'Apply custom logic described by the caller.'
    };
    const suffix = guidance[validationType] ?? guidance.string;
    const hint = instructions ? ` Consider caller instructions: ${instructions}` : '';
    return `${base}. ${suffix}${hint}`.trim();
}
function detectFormat(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return 'unknown';
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
    }
    if (/<[a-z][\s\S]*>/i.test(trimmed)) {
        return 'html';
    }
    if (trimmed.includes(',')) {
        return 'csv-like';
    }
    return 'text';
}
function estimateComplexity(fieldCount, length) {
    if (fieldCount <= 3 && length < 5000)
        return 'low';
    if (fieldCount <= 8 && length < 20000)
        return 'medium';
    return 'high';
}
function estimateTokenCost(fieldCount, length) {
    const base = Math.ceil(length / 4);
    return Math.min(2000, base + fieldCount * 32);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function normaliseKey(value) {
    return value.replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
}
function buildPlannerSteps(outputSchema, instructions, options, config) {
    return Object.keys(outputSchema).map(field => {
        const schemaValue = outputSchema[field];
        const validationType = detectValidationType(field, schemaValue);
        const isRequired = !isFieldOptional(schemaValue);
        const humanKey = humaniseKey(field);
        const searchInstruction = buildSearchInstruction(humanKey, validationType, instructions);
        return {
            targetKey: field,
            description: `Extract ${humanKey}`,
            searchInstruction,
            validationType,
            isRequired
        };
    });
}
//# sourceMappingURL=heuristics.js.map