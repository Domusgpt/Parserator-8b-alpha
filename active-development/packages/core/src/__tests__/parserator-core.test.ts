import { createHybridArchitect } from '../hybrid-architect';
import { ParseratorCore } from '../index';
import {
  ArchitectAgent,
  ArchitectContext,
  ArchitectResult,
  ExtractorAgent,
  ExtractorContext,
  ExtractorResult,
  LeanLLMPlanClient,
  ParseratorCoreOptions,
  ParseRequest,
  SearchPlan
} from '../types';

const noopContext: ArchitectContext = {
  inputData: 'invoice',
  outputSchema: { total: 'number' },
  instructions: 'extract total',
  options: {},
  config: {
    maxInputLength: 120_000,
    maxSchemaFields: 64,
    minConfidence: 0.6,
    defaultStrategy: 'sequential',
    enableFieldFallbacks: true
  }
};

function createPlan(confidence: number): ArchitectResult {
  const plan: SearchPlan = {
    id: 'plan_1',
    version: '1.0',
    steps: [
      {
        targetKey: 'total',
        description: 'total amount',
        searchInstruction: 'find total',
        validationType: 'currency',
        isRequired: true
      }
    ],
    strategy: 'sequential',
    confidenceThreshold: 0.6,
    metadata: {
      detectedFormat: 'text',
      complexity: 'low',
      estimatedTokens: 120,
      origin: 'heuristic'
    }
  };

  return {
    success: true,
    searchPlan: plan,
    tokensUsed: 42,
    processingTimeMs: 15,
    confidence,
    diagnostics: []
  };
}

class FixedArchitect implements ArchitectAgent {
  constructor(private readonly confidence: number) {}

  async createPlan(): Promise<ArchitectResult> {
    return createPlan(this.confidence);
  }
}

class StubPlanClient implements LeanLLMPlanClient {
  public calls = 0;
  public responses: { plan?: SearchPlan; confidence?: number }[] = [];

  constructor(private readonly resolver: (requestPlan: SearchPlan) => SearchPlan | undefined) {}

  async rewrite(request: Parameters<LeanLLMPlanClient['rewrite']>[0]) {
    this.calls += 1;
    const plan = this.resolver(request.heuristicPlan);
    const response = plan ? { plan, confidence: 0.83 } : { plan: undefined };
    this.responses.push(response);
    return response;
  }
}

class EchoExtractor implements ExtractorAgent {
  async execute(context: ExtractorContext): Promise<ExtractorResult> {
    return {
      success: true,
      parsedData: Object.fromEntries(
        context.plan.steps.map(step => [step.targetKey, `${context.inputData}:${step.targetKey}`])
      ),
      tokensUsed: 30,
      processingTimeMs: 10,
      confidence: 0.9,
      diagnostics: []
    };
  }
}

describe('createHybridArchitect', () => {
  it('returns the heuristic plan when confidence is sufficient', async () => {
    const base = new FixedArchitect(0.8);
    const client = new StubPlanClient(() => undefined);
    const architect = createHybridArchitect({ base, client, minHeuristicConfidence: 0.7 });

    const result = await architect.createPlan(noopContext);

    expect(result.success).toBe(true);
    expect(result.searchPlan?.metadata.origin).toBe('heuristic');
    expect(client.calls).toBe(0);
  });

  it('invokes the lean client when confidence is low and adopts the rewritten plan', async () => {
    const base = new FixedArchitect(0.55);
    const client = new StubPlanClient(plan => ({
      ...plan,
      metadata: {
        ...plan.metadata,
        origin: 'model',
        detectedFormat: 'text',
        complexity: 'medium',
        estimatedTokens: 180
      }
    }));
    const architect = createHybridArchitect({ base, client, minHeuristicConfidence: 0.7 });

    const result = await architect.createPlan(noopContext);

    expect(result.success).toBe(true);
    expect(result.searchPlan?.metadata.origin).toBe('model');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(client.calls).toBe(1);
  });

  it('respects cooldowns and avoids repeated model calls', async () => {
    jest.useFakeTimers();
    const base = new FixedArchitect(0.5);
    const client = new StubPlanClient(plan => plan);
    const architect = createHybridArchitect({ base, client, minHeuristicConfidence: 0.7, cooldownMs: 10_000 });

    await architect.createPlan(noopContext);
    await architect.createPlan(noopContext);

    expect(client.calls).toBe(1);

    jest.advanceTimersByTime(10_000);
    await architect.createPlan(noopContext);

    expect(client.calls).toBe(2);
    jest.useRealTimers();
  });
});

describe('ParseratorCore lean LLM plan rewrite integration', () => {
  function createCore(options: Partial<ParseratorCoreOptions> = {}): ParseratorCore {
    const extractor = new EchoExtractor();
    return new ParseratorCore({
      apiKey: 'test',
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      extractor,
      ...options
    });
  }

  const request: ParseRequest = {
    inputData: 'Invoice total is $42',
    outputSchema: { total: 'number' },
    instructions: 'extract total'
  };

  it('can enable lean plan rewrite and parse with the hybrid architect', async () => {
    const client = new StubPlanClient(plan => ({
      ...plan,
      metadata: { ...plan.metadata, origin: 'model' }
    }));
    const core = createCore({
      architect: new FixedArchitect(0.5),
      leanLLMPlanRewrite: { client, minHeuristicConfidence: 0.7 }
    });

    const response = await core.parse(request);

    expect(response.success).toBe(true);
    expect(response.metadata.architectPlan.metadata.origin).toBe('model');
    expect(client.calls).toBe(1);
  });

  it('can disable the lean plan rewrite to restore heuristic-only planning', async () => {
    const client = new StubPlanClient(plan => ({ ...plan, metadata: { ...plan.metadata, origin: 'model' } }));
    const core = createCore({
      architect: new FixedArchitect(0.5),
      leanLLMPlanRewrite: { client, minHeuristicConfidence: 0.7 }
    });

    core.disableLeanLLMPlanRewrite();
    const response = await core.parse(request);

    expect(response.success).toBe(true);
    expect(response.metadata.architectPlan.metadata.origin).toBe('heuristic');
    expect(client.calls).toBe(0);
  });
});
