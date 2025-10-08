"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolverRegistry = void 0;
exports.createDefaultResolvers = createDefaultResolvers;
const heuristics_1 = require("./heuristics");
const utils_1 = require("./utils");
const JSON_PAYLOAD_KEY = 'resolver:json:payload';
const JSON_PAYLOAD_ERROR_KEY = 'resolver:json:error';
const JSON_PAYLOAD_DIAG_KEY = 'resolver:json:diagnosed';
const SECTION_CACHE_KEY = 'resolver:sections:cache';
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
    const candidate = lines.find(line => /^([A-Z][a-z]+\s+){0,3}[A-Z][a-z]+$/.test(line));
    if (candidate) {
        return candidate;
    }
    const namePattern = /[A-Z][a-z]+\s+[A-Z][a-z]+/;
    const match = input.match(namePattern);
    return match ? match[0] : undefined;
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