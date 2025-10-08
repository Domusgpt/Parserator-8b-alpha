"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listParseratorProfiles = listParseratorProfiles;
exports.resolveProfile = resolveProfile;
exports.getProfileByName = getProfileByName;
const architect_1 = require("./architect");
const extractor_1 = require("./extractor");
const resolvers_1 = require("./resolvers");
const BUILT_IN_PROFILES = {
    'lean-agent': {
        name: 'lean-agent',
        summary: 'Default heuristics tuned for lean agent workflows and SDK parity.',
        description: 'Ships with the standard heuristic architect, resolver registry, and extractor so downstream agents inherit the same defaults as the SaaS API without extra wiring.',
        tags: ['default', 'agents', 'sdk'],
        configure: ({ logger }) => ({
            config: {
                minConfidence: 0.55,
                defaultStrategy: 'sequential',
                enableFieldFallbacks: true
            },
            architect: new architect_1.HeuristicArchitect(logger),
            extractor: new extractor_1.RegexExtractor(logger),
            resolvers: (0, resolvers_1.createDefaultResolvers)(logger)
        })
    },
    'vibe-coder': {
        name: 'vibe-coder',
        summary: 'Loose, schema-flexible setup for prototypes, hack nights, and vibe coding.',
        description: 'Lowers the confidence guardrails, adds a key-value resolver for messy transcripts, and keeps fallbacks enabled so builders get quick wins without tuning.',
        tags: ['prototype', 'builders', 'hack'],
        configure: ({ logger }) => ({
            config: {
                minConfidence: 0.5,
                defaultStrategy: 'adaptive',
                enableFieldFallbacks: true
            },
            architect: new architect_1.HeuristicArchitect(logger),
            extractor: new extractor_1.RegexExtractor(logger),
            resolvers: [(0, resolvers_1.createLooseKeyValueResolver)(logger), ...(0, resolvers_1.createDefaultResolvers)(logger)]
        })
    },
    'sensor-grid': {
        name: 'sensor-grid',
        summary: 'High-signal profile for deterministic, high-volume sensor ingestion.',
        description: 'Raises confidence thresholds, widens input limits, and defaults to a parallel strategy so telemetry-heavy pipelines can stay deterministic while still using heuristics.',
        tags: ['sensors', 'enterprise', 'deterministic'],
        configure: ({ logger }) => ({
            config: {
                maxInputLength: 240000,
                minConfidence: 0.65,
                defaultStrategy: 'parallel',
                enableFieldFallbacks: false
            },
            architect: new architect_1.HeuristicArchitect(logger),
            extractor: new extractor_1.RegexExtractor(logger),
            resolvers: (0, resolvers_1.createDefaultResolvers)(logger)
        })
    }
};
function listParseratorProfiles() {
    return Object.values(BUILT_IN_PROFILES);
}
function resolveProfile(option, context) {
    if (!option) {
        return undefined;
    }
    const profile = typeof option === 'string' ? BUILT_IN_PROFILES[option] : option;
    if (!profile) {
        throw new Error(`Unknown Parserator profile: ${typeof option === 'string' ? option : option.name}`);
    }
    const configuration = profile.configure(context) ?? {};
    return {
        profile,
        config: configuration.config ? { ...configuration.config } : undefined,
        architect: configuration.architect,
        extractor: configuration.extractor,
        resolvers: configuration.resolvers ? [...configuration.resolvers] : undefined
    };
}
function getProfileByName(name) {
    return BUILT_IN_PROFILES[name];
}
//# sourceMappingURL=profiles.js.map