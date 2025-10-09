import {
  ParseratorProfile,
  ParseratorProfileConfig,
  ParseratorProfileContext,
  ParseratorProfileOption
} from './types';
import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultResolvers, createLooseKeyValueResolver } from './resolvers';

export interface ResolvedProfile extends ParseratorProfileConfig {
  profile: ParseratorProfile;
}

const BUILT_IN_PROFILES: Record<string, ParseratorProfile> = {
  'lean-agent': {
    name: 'lean-agent',
    summary: 'Default heuristics tuned for lean agent workflows and SDK parity.',
    description:
      'Ships with the standard heuristic architect, resolver registry, and extractor so downstream agents inherit the same defaults as the SaaS API without extra wiring.',
    tags: ['default', 'agents', 'sdk'],
    configure: ({ logger }: ParseratorProfileContext): ParseratorProfileConfig => ({
      config: {
        minConfidence: 0.55,
        defaultStrategy: 'sequential',
        enableFieldFallbacks: true
      },
      architect: new HeuristicArchitect(logger),
      extractor: new RegexExtractor(logger),
      resolvers: createDefaultResolvers(logger)
    })
  },
  'vibe-coder': {
    name: 'vibe-coder',
    summary: 'Loose, schema-flexible setup for prototypes, hack nights, and vibe coding.',
    description:
      'Lowers the confidence guardrails, adds a key-value resolver for messy transcripts, and keeps fallbacks enabled so builders get quick wins without tuning.',
    tags: ['prototype', 'builders', 'hack'],
    configure: ({ logger }: ParseratorProfileContext): ParseratorProfileConfig => ({
      config: {
        minConfidence: 0.5,
        defaultStrategy: 'adaptive',
        enableFieldFallbacks: true
      },
      architect: new HeuristicArchitect(logger),
      extractor: new RegexExtractor(logger),
      resolvers: [createLooseKeyValueResolver(logger), ...createDefaultResolvers(logger)]
    })
  },
  'sensor-grid': {
    name: 'sensor-grid',
    summary: 'High-signal profile for deterministic, high-volume sensor ingestion.',
    description:
      'Raises confidence thresholds, widens input limits, and defaults to a parallel strategy so telemetry-heavy pipelines can stay deterministic while still using heuristics.',
    tags: ['sensors', 'enterprise', 'deterministic'],
    configure: ({ logger }: ParseratorProfileContext): ParseratorProfileConfig => ({
      config: {
        maxInputLength: 240_000,
        minConfidence: 0.65,
        defaultStrategy: 'parallel',
        enableFieldFallbacks: false
      },
      architect: new HeuristicArchitect(logger),
      extractor: new RegexExtractor(logger),
      resolvers: createDefaultResolvers(logger)
    })
  }
};

export function listParseratorProfiles(): ParseratorProfile[] {
  return Object.values(BUILT_IN_PROFILES);
}

export function resolveProfile(
  option: ParseratorProfileOption | undefined,
  context: ParseratorProfileContext
): ResolvedProfile | undefined {
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

export function getProfileByName(name: string): ParseratorProfile | undefined {
  return BUILT_IN_PROFILES[name];
}
