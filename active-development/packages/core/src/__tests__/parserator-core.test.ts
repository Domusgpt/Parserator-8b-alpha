import { createHybridArchitect } from '../hybrid-architect';
import { ParseratorCore } from '../index';
import {
  ArchitectAgent,
  ArchitectContext,
  ArchitectResult,
  ExtractorAgent,
  ExtractorContext,
  ExtractorResult,
  LeanLLMFieldClient,
  LeanLLMPlanClient,
  ParseratorCoreOptions,
  ParseratorPlanRewriteEvent,
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
  public responses: { plan?: SearchPlan; confidence?: number; usage?: Record<string, unknown> }[] = [];

  constructor(
    private readonly resolver: (requestPlan: SearchPlan) => SearchPlan | undefined,
    private readonly usage?: { tokensUsed?: number; latencyMs?: number; model?: string }
  ) {}

  async rewrite(request: Parameters<LeanLLMPlanClient['rewrite']>[0]) {
    this.calls += 1;
    const plan = this.resolver(request.heuristicPlan);
    const response = plan
      ? { plan, confidence: 0.83, usage: this.usage }
      : { plan: undefined, usage: this.usage };
    this.responses.push(response);
    return response;
  }
}

class StubFieldClient implements LeanLLMFieldClient {
  public calls = 0;
  public requests: Parameters<LeanLLMFieldClient['resolve']>[] = [];

  constructor(
    private readonly values: Record<string, unknown>,
    private readonly usage?: { tokensUsed?: number; latencyMs?: number; model?: string }
  ) {}

  async resolve(request: Parameters<LeanLLMFieldClient['resolve']>[0]) {
    this.calls += 1;
    this.requests.push(request);
    return {
      values: { ...this.values },
      usage: this.usage
    };
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

  it('emits telemetry and exposes queue state for rewrite attempts', async () => {
    const base = new FixedArchitect(0.5);
    const client = new StubPlanClient(plan => plan, { tokensUsed: 32, latencyMs: 120, model: 'lean-model' });
    const telemetry: any[] = [];
    const architect = createHybridArchitect({
      base,
      client,
      minHeuristicConfidence: 0.7,
      emitTelemetry: event => telemetry.push(event)
    });

    expect(architect.getPlanRewriteState?.()?.queue.pending).toBe(0);

    await architect.createPlan({ ...noopContext, requestId: 'req-1' });

    const actions = telemetry.map(event => event.action);
    expect(actions).toEqual(['queued', 'started', 'applied']);
    const state = architect.getPlanRewriteState?.();
    expect(state?.enabled).toBe(true);
    expect(state?.lastSuccessAt).toBeDefined();
    expect(state?.queue.pending).toBe(0);
    expect(state?.queue.inFlight).toBe(0);
    expect(state?.queue.completed).toBeGreaterThanOrEqual(1);
    expect(state?.lastUsage).toEqual({ tokensUsed: 32, latencyMs: 120, model: 'lean-model' });
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
    }), { tokensUsed: 64, latencyMs: 200, model: 'lean-model' });
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

  it('emits telemetry events for plan rewrite lifecycle', async () => {
    const events: ParseratorPlanRewriteEvent[] = [];
    const client = new StubPlanClient(
      plan => ({ ...plan, metadata: { ...plan.metadata, origin: 'model' } }),
      { tokensUsed: 32, latencyMs: 120 }
    );
    const core = createCore({
      architect: new FixedArchitect(0.5),
      leanLLMPlanRewrite: { client, minHeuristicConfidence: 0.7 },
      telemetry: event => {
        if (event.type === 'plan:rewrite') {
          events.push(event);
        }
      }
    });

    await core.parse(request);

    expect(events.map(event => event.action)).toEqual(['queued', 'started', 'applied']);
    expect(events[0].source).toBe('core');
    expect(events[2].usage).toEqual({ tokensUsed: 32, latencyMs: 120 });
  });

  it('exposes lean plan rewrite state from the core', async () => {
    const client = new StubPlanClient(plan => ({ ...plan, metadata: { ...plan.metadata, origin: 'model' } }), {
      tokensUsed: 40,
      latencyMs: 150,
      model: 'lean-model'
    });
    const core = createCore({
      architect: new FixedArchitect(0.5),
      leanLLMPlanRewrite: { client, minHeuristicConfidence: 0.7 }
    });

    const initialState = core.getLeanLLMPlanRewriteState();
    expect(initialState.enabled).toBe(true);
    expect(initialState.queue.pending).toBe(0);

    await core.parse(request);

    const state = core.getLeanLLMPlanRewriteState();
    expect(state.enabled).toBe(true);
    expect(state.lastSuccessAt).toBeDefined();
    expect(state.lastUsage).toEqual({ tokensUsed: 40, latencyMs: 150, model: 'lean-model' });
    expect(state.pendingCooldown).toBe(false);

    core.disableLeanLLMPlanRewrite();
    expect(core.getLeanLLMPlanRewriteState().enabled).toBe(false);
  });
});

describe('ParseratorCore lean LLM field fallback integration', () => {
  it('resolves required fields via the lean fallback when heuristics miss', async () => {
    const client = new StubFieldClient({ total: '128.50' }, { tokensUsed: 24, latencyMs: 90, model: 'lean-field' });
    const core = new ParseratorCore({
      apiKey: 'test',
      resolvers: [],
      leanLLMFieldFallback: { client, minConfidence: 0.7 }
    });

    const response = await core.parse({
      inputData: 'Invoice total: 128.50 USD',
      outputSchema: { total: 'number' }
    });

    expect(response.success).toBe(true);
    expect(response.parsedData?.total).toBe('128.50');
    expect(client.calls).toBe(1);

    const state = core.getLeanLLMFieldFallbackState();
    expect(state.enabled).toBe(true);
    expect(state.successes).toBeGreaterThanOrEqual(1);
    expect(state.lastUsage).toEqual({ tokensUsed: 24, latencyMs: 90, model: 'lean-field' });
  });

  it('skips optional fields when configured to ignore them', async () => {
    const client = new StubFieldClient({ primary: 'fallback-value', notes: 'should-not-appear' });
    const core = new ParseratorCore({
      apiKey: 'test',
      resolvers: [],
      leanLLMFieldFallback: { client, includeOptionalFields: false }
    });

    const response = await core.parse({
      inputData: 'Primary only',
      outputSchema: {
        primary: 'string',
        notes: { type: 'string', optional: true }
      }
    });

    expect(response.success).toBe(true);
    expect(response.parsedData?.primary).toBe('fallback-value');
    expect(response.parsedData?.notes).toBeUndefined();
    expect(client.calls).toBe(1);
    expect(core.getLeanLLMFieldFallbackState().attempts).toBeGreaterThanOrEqual(1);
  });

  it('can disable the lean fallback and report a disabled state', () => {
    const client = new StubFieldClient({ total: '42.00' });
    const core = new ParseratorCore({
      apiKey: 'test',
      resolvers: [],
      leanLLMFieldFallback: { client }
    });

    expect(core.getLeanLLMFieldFallbackState().enabled).toBe(true);
    core.disableLeanLLMFieldFallback();
    const state = core.getLeanLLMFieldFallbackState();
    expect(state.enabled).toBe(false);
    expect(state.queue.pending).toBe(0);
    expect(core.listResolvers()).not.toContain('lean-llm-field-fallback');
  });
});
