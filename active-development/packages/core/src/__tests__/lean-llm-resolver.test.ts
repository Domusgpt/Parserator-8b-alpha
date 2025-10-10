import { LeanLLMResolver } from '../resolvers';
import {
  CoreLogger,
  FieldResolutionContext,
  LeanLLMClient,
  LeanLLMExtractionRequest,
  ParseratorCoreConfig,
  SearchPlan
} from '../types';

const logger: CoreLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const baseConfig: ParseratorCoreConfig = {
  maxInputLength: 120_000,
  maxSchemaFields: 64,
  minConfidence: 0.55,
  defaultStrategy: 'sequential',
  enableFieldFallbacks: true
};

const basePlan: SearchPlan = {
  id: 'plan-1',
  version: '1.0',
  steps: [
    {
      targetKey: 'order_id',
      description: 'Order identifier',
      searchInstruction: 'Return the order id',
      validationType: 'string',
      isRequired: true
    },
    {
      targetKey: 'customer_email',
      description: 'Customer email',
      searchInstruction: 'Return the email',
      validationType: 'email',
      isRequired: true
    }
  ],
  strategy: 'sequential',
  confidenceThreshold: 0.55,
  metadata: {
    detectedFormat: 'text/plain',
    complexity: 'medium',
    estimatedTokens: 120,
    origin: 'heuristic'
  }
};

class FakeLeanClient implements LeanLLMClient {
  public readonly calls: LeanLLMExtractionRequest[] = [];
  readonly name = 'test-client';

  async extractFields(request: LeanLLMExtractionRequest) {
    this.calls.push(request);
    return {
      fields: [
        { key: 'order_id', value: 'ORD-123', confidence: 0.84 },
        {
          key: 'customer_email',
          value: 'customer@example.com',
          confidence: 0.73,
          rationale: 'Located in billing section'
        }
      ]
    };
  }
}

class FailingLeanClient implements LeanLLMClient {
  readonly name = 'failing';

  async extractFields(): Promise<never> {
    throw new Error('network down');
  }
}

function createContext(stepIndex: number, overrides: Partial<FieldResolutionContext> = {}) {
  const step = basePlan.steps[stepIndex];
  return {
    inputData: 'Raw email transcript with hidden values',
    step,
    config: baseConfig,
    logger,
    shared: overrides.shared ?? new Map<string, unknown>(),
    plan: basePlan,
    instructions: 'Parse the order receipt accurately',
    outputSchema: {
      order_id: { type: 'string' },
      customer_email: { type: 'string' }
    },
    options: undefined,
    ...overrides
  } satisfies FieldResolutionContext;
}

describe('LeanLLMResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves required fields via the lean LLM client only once', async () => {
    const client = new FakeLeanClient();
    const resolver = new LeanLLMResolver(client, logger);
    const shared = new Map<string, unknown>();

    const first = await resolver.resolve(createContext(0, { shared }));
    expect(first?.value).toBe('ORD-123');
    expect(first?.diagnostics[0]?.message).toContain('Lean LLM (test-client) fallback resolved order_id');
    expect(client.calls).toHaveLength(1);

    const second = await resolver.resolve(createContext(1, { shared }));
    expect(second?.value).toBe('customer@example.com');
    expect(client.calls).toHaveLength(1);
    expect(second?.diagnostics[0]?.message).toContain('Lean LLM (test-client) fallback resolved customer_email');
  });

  it('skips optional fields by default', () => {
    const client = new FakeLeanClient();
    const resolver = new LeanLLMResolver(client, logger);
    const optionalStep = {
      ...basePlan.steps[0],
      targetKey: 'notes',
      isRequired: false
    };

    expect(resolver.supports(optionalStep)).toBe(false);
  });

  it('emits a single diagnostic when the lean LLM client fails', async () => {
    const client = new FailingLeanClient();
    const resolver = new LeanLLMResolver(client, logger);
    const shared = new Map<string, unknown>();

    const first = await resolver.resolve(createContext(0, { shared }));
    expect(first?.value).toBeUndefined();
    expect(first?.diagnostics[0]?.message).toContain('resolver failed: network down');

    const second = await resolver.resolve(createContext(1, { shared }));
    expect(second).toBeUndefined();
  });
});
