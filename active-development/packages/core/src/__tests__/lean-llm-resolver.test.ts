import { LeanLLMResolver, LEAN_LLM_USAGE_KEY, PLAN_SHARED_STATE_KEY } from '../resolvers';
import { ParseratorCore } from '../index';
import {
  CoreLogger,
  FieldResolutionContext,
  LeanLLMResolverConfig,
  LeanLLMFallbackUsageSummary,
  LightweightLLMClient,
  LightweightLLMExtractionRequest,
  LightweightLLMExtractionResponse,
  ParseratorCoreConfig,
  SearchPlan
} from '../types';

describe('LeanLLMResolver', () => {
  const baseConfig: ParseratorCoreConfig = {
    maxInputLength: 120_000,
    maxSchemaFields: 64,
    minConfidence: 0.55,
    defaultStrategy: 'sequential',
    enableFieldFallbacks: true
  };

  const plan: SearchPlan = {
    id: 'plan-001',
    version: '1.0.0',
    steps: [],
    strategy: 'sequential',
    confidenceThreshold: 0.6,
    metadata: {
      detectedFormat: 'text',
      complexity: 'medium',
      estimatedTokens: 128,
      origin: 'heuristic'
    }
  };

  const logger: CoreLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const createContext = (overrides: Partial<FieldResolutionContext> = {}): FieldResolutionContext => ({
    inputData: 'Invoice Total: $123.45\nDue Date: 2024-02-01',
    step: {
      targetKey: 'invoice_total',
      description: 'Total amount due on the invoice',
      searchInstruction: 'Locate the invoice total amount.',
      validationType: 'currency',
      isRequired: true
    },
    config: baseConfig,
    logger,
    shared: new Map([[PLAN_SHARED_STATE_KEY, plan]]),
    ...overrides
  });

  class MockClient implements LightweightLLMClient {
    public readonly name: string;
    public readonly calls: LightweightLLMExtractionRequest[] = [];

    constructor(
      private readonly handler: (
        request: LightweightLLMExtractionRequest
      ) => Promise<LightweightLLMExtractionResponse>,
      name = 'mock-lean'
    ) {
      this.name = name;
    }

    async extractField(request: LightweightLLMExtractionRequest): Promise<LightweightLLMExtractionResponse> {
      this.calls.push(request);
      return this.handler(request);
    }
  }

  const createResolver = (config: Partial<LeanLLMResolverConfig> & { client: MockClient }) =>
    new LeanLLMResolver({
      client: config.client,
      allowOptionalFields: config.allowOptionalFields,
      defaultConfidence: config.defaultConfidence,
      maxInputCharacters: config.maxInputCharacters,
      name: config.name,
      requestFormatter: config.requestFormatter,
      planConfidenceGate: config.planConfidenceGate,
      maxInvocationsPerParse: config.maxInvocationsPerParse,
      maxTokensPerParse: config.maxTokensPerParse,
      logger
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves required fields via the lean LLM fallback', async () => {
    const client = new MockClient(async () => ({
      value: '$123.45',
      confidence: 0.82,
      reason: 'Identified currency token near invoice label',
      tokensUsed: 180
    }));

    const resolver = createResolver({ client });
    const context = createContext();

    const result = await resolver.resolve(context);

    expect(client.calls).toHaveLength(1);
    expect(result?.value).toBe('$123.45');
    expect(result?.confidence).toBeCloseTo(0.82);
    expect(result?.diagnostics[0].message).toContain('resolved invoice_total');
    expect(result?.diagnostics[1].message).toContain('Lean LLM rationale');

    const summary = context.shared.get(LEAN_LLM_USAGE_KEY) as LeanLLMFallbackUsageSummary;
    expect(summary.totalInvocations).toBe(1);
    expect(summary.resolvedFields).toBe(1);
    expect(summary.sharedExtractions).toBe(1);
    expect(summary.totalTokens).toBe(180);
    expect(summary.skippedByLimits).toBe(0);
    expect(summary.fields[0]).toMatchObject({ action: 'invoked', field: 'invoice_total' });
  });

  it('skips optional fields when optional fallback is disabled', async () => {
    const client = new MockClient(async () => ({ value: 'ignored' }));
    const resolver = createResolver({ client });
    const context = createContext({
      step: {
        ...createContext().step,
        isRequired: false
      }
    });

    const result = await resolver.resolve(context);

    expect(client.calls).toHaveLength(0);
    expect(result).toBeUndefined();
  });

  it('returns diagnostic when client throws an error', async () => {
    const client = new MockClient(async () => {
      throw new Error('network timeout');
    });
    const resolver = createResolver({ client });
    const context = createContext();

    const result = await resolver.resolve(context);

    expect(result?.value).toBeUndefined();
    expect(result?.confidence).toBe(0);
    expect(result?.diagnostics[0].message).toContain('failed: network timeout');

    const summary = context.shared.get(LEAN_LLM_USAGE_KEY) as LeanLLMFallbackUsageSummary;
    expect(summary.totalInvocations).toBe(1);
    expect(summary.resolvedFields).toBe(0);
    expect(summary.skippedByLimits).toBe(0);
    expect(summary.fields[0]).toMatchObject({ action: 'invoked', error: 'network timeout' });
  });

  it('only calls the client once per field and reuses the cached value', async () => {
    const client = new MockClient(async () => ({ value: 'first-pass', confidence: 0.7 }));
    const resolver = createResolver({ client });
    const context = createContext();

    const first = await resolver.resolve(context);
    const second = await resolver.resolve(context);

    expect(first?.value).toBe('first-pass');
    expect(second?.value).toBe('first-pass');
    expect(second?.diagnostics[0].message).toContain('Reused lean LLM shared extraction');
    expect(client.calls).toHaveLength(1);

    const summary = context.shared.get(LEAN_LLM_USAGE_KEY) as LeanLLMFallbackUsageSummary;
    expect(summary.totalInvocations).toBe(1);
    expect(summary.reusedResolutions).toBe(1);
    expect(summary.fields.some(field => field.action === 'reused')).toBe(true);
  });

  it('skips additional fields when maxInvocationsPerParse is reached', async () => {
    const client = new MockClient(async () => ({ value: 'first-pass', confidence: 0.7 }));
    const resolver = createResolver({ client, maxInvocationsPerParse: 1 });
    const shared = new Map([[PLAN_SHARED_STATE_KEY, plan]]);

    const firstContext = createContext({ shared });
    const secondContext = createContext({
      shared,
      step: {
        ...createContext().step,
        targetKey: 'due_date',
        description: 'Invoice due date',
        searchInstruction: 'Locate the due date for the invoice.',
        validationType: 'date'
      }
    });

    const first = await resolver.resolve(firstContext);
    const second = await resolver.resolve(secondContext);

    expect(first?.value).toBe('first-pass');
    expect(second).toBeUndefined();
    expect(client.calls).toHaveLength(1);

    const summary = shared.get(LEAN_LLM_USAGE_KEY) as LeanLLMFallbackUsageSummary;
    expect(summary.totalInvocations).toBe(1);
    expect(summary.skippedByLimits).toBe(1);
    expect(summary.fields[1]).toMatchObject({
      action: 'skipped',
      reason: 'invocation-limit',
      limitType: 'invocations',
      limit: 1
    });
  });

  it('skips when the token budget has been exhausted', async () => {
    const client = new MockClient(async () => ({ value: 'first-pass', confidence: 0.7, tokensUsed: 150 }));
    const resolver = createResolver({ client, maxTokensPerParse: 150 });
    const shared = new Map([[PLAN_SHARED_STATE_KEY, plan]]);

    const firstContext = createContext({ shared });
    const secondContext = createContext({
      shared,
      step: {
        ...createContext().step,
        targetKey: 'due_date',
        description: 'Invoice due date',
        searchInstruction: 'Locate the due date for the invoice.',
        validationType: 'date'
      }
    });

    const first = await resolver.resolve(firstContext);
    const second = await resolver.resolve(secondContext);

    expect(first?.value).toBe('first-pass');
    expect(second).toBeUndefined();
    expect(client.calls).toHaveLength(1);

    const summary = shared.get(LEAN_LLM_USAGE_KEY) as LeanLLMFallbackUsageSummary;
    expect(summary.totalTokens).toBe(150);
    expect(summary.skippedByLimits).toBe(1);
    expect(summary.fields[1]).toMatchObject({
      action: 'skipped',
      reason: 'token-budget',
      limitType: 'tokens',
      limit: 150,
      currentTokens: 150
    });
  });

  it('trims the input payload when maxInputCharacters is configured', async () => {
    const client = new MockClient(async request => ({
      value: request.input,
      confidence: 0.6
    }));

    const resolver = createResolver({ client, maxInputCharacters: 16 });
    const context = createContext({ inputData: 'A very long payload that should be truncated by the resolver.' });

    const result = await resolver.resolve(context);

    expect(result?.value).toContain('[truncated');
    expect(client.calls[0].input.length).toBeGreaterThan(16); // includes truncation marker
    expect(client.calls[0].input.startsWith('A very long pay')).toBe(true);
  });

  it('reuses shared extractions provided by the lean LLM response', async () => {
    const client = new MockClient(async () => ({
      value: '$123.45',
      confidence: 0.82,
      sharedExtractions: {
        due_date: {
          value: '2024-02-01',
          confidence: 0.7,
          reason: 'Detected due date alongside invoice total'
        }
      }
    }));

    const resolver = createResolver({ client });
    const shared = new Map<string, unknown>([[PLAN_SHARED_STATE_KEY, plan]]);

    const firstContext = createContext({ shared });
    const secondContext = createContext({
      shared,
      step: {
        ...createContext().step,
        targetKey: 'due_date',
        description: 'Invoice due date',
        searchInstruction: 'Find the invoice due date.',
        validationType: 'date'
      }
    });

    const first = await resolver.resolve(firstContext);
    const reused = await resolver.resolve(secondContext);

    expect(first?.value).toBe('$123.45');
    expect(reused?.value).toBe('2024-02-01');
    expect(reused?.diagnostics[0].message).toContain('Reused lean LLM shared extraction');
    expect(client.calls).toHaveLength(1);

    const summary = shared.get(LEAN_LLM_USAGE_KEY) as LeanLLMFallbackUsageSummary;
    expect(summary.totalInvocations).toBe(1);
    expect(summary.reusedResolutions).toBe(1);
    expect(summary.sharedExtractions).toBe(2);
    expect(summary.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'invoked', field: 'invoice_total' }),
        expect.objectContaining({ action: 'reused', field: 'due_date' })
      ])
    );
  });

  it('skips invocation when plan confidence exceeds configured gate', async () => {
    const client = new MockClient(async () => ({ value: '$999.00' }));
    const resolver = createResolver({ client, planConfidenceGate: 0.7 });
    const confidentPlan: SearchPlan = {
      ...plan,
      metadata: { ...plan.metadata, plannerConfidence: 0.9 }
    };

    const context = createContext({
      shared: new Map<string, unknown>([[PLAN_SHARED_STATE_KEY, confidentPlan]])
    });

    const result = await resolver.resolve(context);

    expect(result).toBeUndefined();
    expect(client.calls).toHaveLength(0);

    const summary = context.shared.get(LEAN_LLM_USAGE_KEY) as LeanLLMFallbackUsageSummary;
    expect(summary.totalInvocations).toBe(0);
    expect(summary.skippedByPlanConfidence).toBe(1);
    expect(summary.fields[0]).toMatchObject({
      action: 'skipped',
      gate: 0.7,
      plannerConfidence: 0.9
    });
  });

  describe('ParseratorCore integration', () => {
    const coreConfig: ParseratorCoreConfig = {
      maxInputLength: 120_000,
      maxSchemaFields: 64,
      minConfidence: 0.55,
      defaultStrategy: 'sequential',
      enableFieldFallbacks: true
    };

    const createCore = (): ParseratorCore =>
      new ParseratorCore({
        apiKey: 'test-key',
        logger,
        config: coreConfig,
        profile: 'lean-agent',
        resolvers: []
      });

    it('registers and removes lean fallback resolvers dynamically', () => {
      const core = createCore();
      const registry = (core as any).resolverRegistry;

      expect(registry.listResolvers()).toHaveLength(0);

      const client = new MockClient(async () => ({ value: 'fallback' }));
      core.configureLLMFallback({ client, name: 'mock-fallback', position: 'append' });

      expect(registry.listResolvers()).toContain('mock-fallback');

      core.configureLLMFallback(undefined);

      expect(registry.listResolvers()).not.toContain('mock-fallback');
    });

    it('replaces the existing lean fallback resolver when reconfigured', () => {
      const core = createCore();
      const registry = (core as any).resolverRegistry;

      core.configureLLMFallback({
        client: new MockClient(async () => ({ value: 'first' })),
        name: 'first-fallback',
        position: 'append'
      });

      core.configureLLMFallback({
        client: new MockClient(async () => ({ value: 'second' })),
        name: 'second-fallback',
        position: 'prepend'
      });

      const names: string[] = registry.listResolvers();
      expect(names).toContain('second-fallback');
      expect(names.filter(name => name === 'second-fallback')).toHaveLength(1);
      expect(names).not.toContain('first-fallback');
    });
  });
});
