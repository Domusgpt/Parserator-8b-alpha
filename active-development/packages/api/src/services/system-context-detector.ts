import { ISystemContext, SystemContextType } from '../interfaces/search-plan.interface';

export interface SystemContextDefinition {
  keywords: string[];
  summary: string;
}

export interface SystemContextDetectorOptions {
  /** Allow callers to override the built-in context definitions */
  definitions?: Partial<Record<SystemContextType, SystemContextDefinition>>;
  /** Minimum score required before a non-generic context is considered valid */
  minimumScore?: number;
  /** How much to boost the hinted context score when provided */
  hintBoost?: number;
  /** Minimum delta between the top two contexts to be considered unambiguous */
  ambiguityDelta?: number;
  /** Optional logger for debug output */
  logger?: Pick<Console, 'debug'>;
}

interface ContextScore {
  score: number;
  signals: Map<string, number>;
}

interface DetectionInput {
  schemaFields: string[];
  instructions?: string;
  sample: string;
  domainHints?: string[];
  systemContextHint?: SystemContextType;
}

const DEFAULT_CONTEXT_DEFINITIONS: Record<SystemContextType, SystemContextDefinition> = {
  generic: {
    keywords: [],
    summary: 'General-purpose parsing without downstream system specialization.'
  },
  crm: {
    keywords: [
      'crm',
      'customer',
      'lead',
      'contact',
      'account',
      'opportunity',
      'pipeline',
      'salesforce',
      'hubspot'
    ],
    summary: 'Optimized for CRM and customer-data systems focused on contacts, leads, and account lifecycle.'
  },
  ecommerce: {
    keywords: [
      'order',
      'cart',
      'sku',
      'product',
      'inventory',
      'shipment',
      'checkout',
      'purchase',
      'shopify'
    ],
    summary: 'Optimized for e-commerce flows involving products, orders, fulfillment, and post-purchase data.'
  },
  finance: {
    keywords: [
      'invoice',
      'amount',
      'transaction',
      'accounting',
      'balance',
      'payment',
      'tax',
      'ledger',
      'bank'
    ],
    summary: 'Optimized for financial documents, invoices, and transaction records that require numeric precision.'
  },
  healthcare: {
    keywords: [
      'patient',
      'diagnosis',
      'medical',
      'appointment',
      'clinic',
      'provider',
      'medication',
      'record',
      'health'
    ],
    summary: 'Optimized for healthcare records where patient safety, compliance, and terminology accuracy matter.'
  },
  legal: {
    keywords: [
      'case',
      'court',
      'contract',
      'legal',
      'compliance',
      'evidence',
      'claim',
      'statute',
      'attorney'
    ],
    summary: 'Optimized for legal documents that emphasize case details, compliance, and contractual obligations.'
  },
  logistics: {
    keywords: [
      'shipment',
      'tracking',
      'warehouse',
      'delivery',
      'carrier',
      'freight',
      'logistics',
      'route',
      'bill of lading'
    ],
    summary: 'Optimized for logistics and supply-chain workflows involving shipments, tracking, and routing events.'
  },
  marketing: {
    keywords: [
      'campaign',
      'utm',
      'conversion',
      'click',
      'impression',
      'ad',
      'marketing',
      'funnel',
      'segment'
    ],
    summary: 'Optimized for marketing analytics where campaign attribution and engagement metrics are critical.'
  },
  real_estate: {
    keywords: [
      'property',
      'listing',
      'mls',
      'agent',
      'tenant',
      'lease',
      'square footage',
      'closing',
      'escrow'
    ],
    summary: 'Optimized for real-estate operations managing properties, listings, and transaction timelines.'
  }
};

const DEFAULT_MINIMUM_SCORE = 1;
const DEFAULT_HINT_BOOST = 1.25;
const DEFAULT_AMBIGUITY_DELTA = 1;

const SOURCE_WEIGHTS = {
  schema: 1.25,
  instructions: 1.5,
  sample: 1,
  hint: 2.5
} as const;

const SIGNAL_SOURCE_PREFIX: Record<keyof typeof SOURCE_WEIGHTS, string> = {
  schema: 'schema',
  instructions: 'instructions',
  sample: 'sample',
  hint: 'hint'
};

function normalize(text: string): string {
  return text.toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(needle.toLowerCase())}\\b`, 'g');
  return (haystack.match(pattern) || []).length;
}

export class SystemContextDetector {
  private readonly definitions: Record<SystemContextType, SystemContextDefinition>;
  private readonly minimumScore: number;
  private readonly hintBoost: number;
  private readonly ambiguityDelta: number;
  private readonly logger?: Pick<Console, 'debug'>;

  constructor(options: SystemContextDetectorOptions = {}) {
    this.definitions = {
      ...DEFAULT_CONTEXT_DEFINITIONS,
      ...options.definitions
    } as Record<SystemContextType, SystemContextDefinition>;

    this.minimumScore = options.minimumScore ?? DEFAULT_MINIMUM_SCORE;
    this.hintBoost = options.hintBoost ?? DEFAULT_HINT_BOOST;
    this.ambiguityDelta = options.ambiguityDelta ?? DEFAULT_AMBIGUITY_DELTA;
    this.logger = options.logger;
  }

  createDefaultContext(overrides: Partial<ISystemContext> = {}): ISystemContext {
    const type = overrides.type ?? 'generic';
    return {
      type,
      confidence: overrides.confidence ?? 0.1,
      signals: overrides.signals ?? [],
      summary: overrides.summary ?? this.getSummary(type),
      alternatives: overrides.alternatives ?? []
    };
  }

  getSummary(context: SystemContextType): string {
    return this.definitions[context]?.summary ?? this.definitions.generic.summary;
  }

  detect(input: DetectionInput): ISystemContext {
    const normalizedSample = normalize(input.sample);
    const normalizedInstructions = normalize(input.instructions ?? '');
    const normalizedSchema = normalize(input.schemaFields.join(' '));

    const contextScores = new Map<SystemContextType, ContextScore>();
    (Object.keys(this.definitions) as SystemContextType[]).forEach(context => {
      contextScores.set(context, { score: 0, signals: new Map<string, number>() });
    });

    const updateContextScore = (
      context: SystemContextType,
      amount: number,
      signal: string,
      source: keyof typeof SOURCE_WEIGHTS
    ): void => {
      const contextScore = contextScores.get(context);
      if (!contextScore || amount <= 0) {
        return;
      }

      contextScore.score += amount;
      const prefixedSignal = `${SIGNAL_SOURCE_PREFIX[source]}:${signal}`;
      const existing = contextScore.signals.get(prefixedSignal) ?? 0;
      contextScore.signals.set(prefixedSignal, existing + amount);
    };

    const evaluateTextSource = (
      context: SystemContextType,
      text: string,
      weight: number,
      source: keyof typeof SOURCE_WEIGHTS
    ): void => {
      if (!text.trim()) {
        return;
      }

      const normalizedText = normalize(text);
      this.definitions[context].keywords.forEach(keyword => {
        const occurrences = countOccurrences(normalizedText, keyword);
        if (occurrences > 0) {
          updateContextScore(context, occurrences * weight, keyword, source);
        }
      });
    };

    (Object.keys(this.definitions) as SystemContextType[]).forEach(context => {
      if (context === 'generic') {
        return;
      }

      evaluateTextSource(context, normalizedSchema, SOURCE_WEIGHTS.schema, 'schema');
      evaluateTextSource(context, normalizedInstructions, SOURCE_WEIGHTS.instructions, 'instructions');
      evaluateTextSource(context, normalizedSample, SOURCE_WEIGHTS.sample, 'sample');
    });

    if (input.domainHints?.length) {
      input.domainHints.forEach(hint => {
        const normalizedHint = normalize(hint);
        (Object.keys(this.definitions) as SystemContextType[]).forEach(context => {
          if (context === 'generic') {
            return;
          }

          const matchesContextName = normalizedHint.includes(context.replace('_', ' '));
          const matchesKeyword = this.definitions[context].keywords.some(keyword =>
            normalizedHint.includes(keyword)
          );

          if (matchesContextName || matchesKeyword) {
            updateContextScore(context, SOURCE_WEIGHTS.hint, hint, 'hint');
          }
        });
      });
    }

    if (input.systemContextHint && input.systemContextHint !== 'generic') {
      updateContextScore(
        input.systemContextHint,
        this.hintBoost,
        input.systemContextHint,
        'hint'
      );
    }

    const rankedContexts = Array.from(contextScores.entries())
      .filter(([context]) => context !== 'generic')
      .map(([context, data]) => ({
        context,
        score: Number(data.score.toFixed(2)),
        signals: data.signals
      }))
      .sort((a, b) => b.score - a.score);

    const best = rankedContexts[0];
    const second = rankedContexts[1];

    if (!best || best.score < this.minimumScore) {
      return this.createDefaultContext({
        summary: `${this.getSummary('generic')} No strong signals detected.`
      });
    }

    if (second && best.score - second.score < this.ambiguityDelta) {
      this.logger?.debug?.('System context ambiguous', {
        best,
        second
      });
      return this.createDefaultContext({
        summary: `${this.getSummary('generic')} Signals were too evenly distributed across contexts.`
      });
    }

    const signals = Array.from(best.signals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([signal]) => signal);

    const alternatives = rankedContexts
      .slice(1, 4)
      .filter(candidate => candidate.score > 0)
      .map(candidate => ({
        type: candidate.context,
        confidence: this.toConfidence(candidate.score)
      }));

    const summarySignals = signals.length
      ? `Signals: ${signals.slice(0, 5).join(', ')}.`
      : 'Signals were sparse but pointed to this domain.';

    return {
      type: best.context,
      confidence: this.toConfidence(best.score),
      signals: signals.slice(0, 20),
      summary: `${this.getSummary(best.context)} ${summarySignals}`.trim(),
      alternatives
    };
  }

  private toConfidence(score: number): number {
    if (score <= 0) {
      return 0.1;
    }

    const confidence = Math.min(0.95, 0.35 + Math.log2(1 + score));
    return Number(confidence.toFixed(2));
  }
}

export const SYSTEM_CONTEXT_DEFINITIONS = DEFAULT_CONTEXT_DEFINITIONS;
