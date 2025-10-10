import { LeanLLMResolver, LEAN_LLM_USAGE_KEY, PLAN_SHARED_STATE_KEY } from '../resolvers';
import {
  CoreLogger,
  FieldResolutionContext,
  LeanLLMResolverConfig,
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

  const getUsage = (context: FieldResolutionContext) =>
    context.shared.get(LEAN_LLM_USAGE_KEY) as
      | {
          fields: Set<string>;
          resolvers: Set<string>;
          tokensUsed: number;
          calls: number;
          successful: number;
        }
      | undefined;

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
    expect(result?.tokensUsed).toBe(180);

    const usage = getUsage(context);
    expect(usage?.calls).toBe(1);
    expect(usage?.successful).toBe(1);
    expect(usage?.tokensUsed).toBe(180);
    expect(Array.from(usage?.fields ?? [])).toContain('invoice_total');
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

    const usage = getUsage(context);
    expect(usage?.calls).toBe(1);
    expect(usage?.successful).toBe(0);
  });

  it('only attempts extraction once per field', async () => {
    const client = new MockClient(async () => ({ value: 'first-pass', confidence: 0.7 }));
    const resolver = createResolver({ client });
    const context = createContext();

    const first = await resolver.resolve(context);
    const second = await resolver.resolve(context);

    expect(first?.value).toBe('first-pass');
    expect(second).toBeUndefined();
    expect(client.calls).toHaveLength(1);

    const usage = getUsage(context);
    expect(usage?.calls).toBe(1);
    expect(Array.from(usage?.fields ?? [])).toEqual(['invoice_total']);
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

  it('tracks fallback usage even when value is undefined', async () => {
    const client = new MockClient(async () => ({
      value: undefined,
      confidence: 0.4,
      tokensUsed: 90,
      reason: 'No amount present'
    }));

    const resolver = createResolver({ client });
    const context = createContext();

    const result = await resolver.resolve(context);

    expect(result?.value).toBeUndefined();
    expect(result?.tokensUsed).toBe(90);

    const usage = getUsage(context);
    expect(usage?.calls).toBe(1);
    expect(usage?.successful).toBe(0);
    expect(usage?.tokensUsed).toBe(90);
  });
});
