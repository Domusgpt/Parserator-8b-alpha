import {
  ArchitectAgent,
  ArchitectResult,
  CoreLogger,
  ExtractorAgent,
  ExtractorResult,
  ParseRequest,
  ParseResponse,
  ParseratorPlanCache,
  ParseratorPlanCacheEntry,
  ParseratorSessionInit,
  ParseratorTelemetry,
  ParseratorTelemetryEvent,
  ParseratorPlanCacheEvent,
  SearchPlan,
  SessionParseOverrides,
} from '../types';
import { ParseratorCore } from '../index';
import { ParseratorSession } from '../session';
import { createInMemoryPlanCache } from '../cache';
import { createPlanCacheKey } from '../utils';

const noopLogger: CoreLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

class FakeArchitect implements ArchitectAgent {
  public calls = 0;

  async createPlan(): Promise<ArchitectResult> {
    this.calls += 1;
    const plan = createPlan(`plan-${this.calls}`);
    return {
      success: true,
      searchPlan: plan,
      tokensUsed: 42,
      processingTimeMs: 8,
      confidence: 0.82,
      diagnostics: [],
    };
  }
}

class FakeExtractor implements ExtractorAgent {
  public calls = 0;

  async execute(context: Parameters<ExtractorAgent['execute']>[0]): Promise<ExtractorResult> {
    this.calls += 1;
    const parsed = Object.fromEntries(
      context.plan.steps.map(step => [step.targetKey, `${context.inputData}:${step.targetKey}`])
    );

    return {
      success: true,
      parsedData: parsed,
      tokensUsed: 64,
      processingTimeMs: 5,
      confidence: 0.91,
      diagnostics: [],
    };
  }
}

class FakePlanCache implements ParseratorPlanCache {
  public gets: string[] = [];
  public sets: string[] = [];
  private readonly store = new Map<string, ParseratorPlanCacheEntry>();

  async get(key: string): Promise<ParseratorPlanCacheEntry | undefined> {
    this.gets.push(key);
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    return {
      ...entry,
      plan: {
        ...entry.plan,
        steps: entry.plan.steps.map(step => ({ ...step })),
        metadata: { ...entry.plan.metadata },
      },
      diagnostics: [...entry.diagnostics],
    };
  }

  async set(key: string, entry: ParseratorPlanCacheEntry): Promise<void> {
    this.sets.push(key);
    this.store.set(key, {
      ...entry,
      plan: {
        ...entry.plan,
        steps: entry.plan.steps.map(step => ({ ...step })),
        metadata: { ...entry.plan.metadata },
      },
      diagnostics: [...entry.diagnostics],
    });
  }
}

function createTelemetryRecorder() {
  const events: ParseratorTelemetryEvent[] = [];
  const telemetry: ParseratorTelemetry = {
    emit: (event: ParseratorTelemetryEvent) => {
      events.push(event);
    },
    register: () => {
      // noop for tests
    },
    unregister: () => {
      // noop for tests
    },
    listeners: () => []
  };

  return { telemetry, events };
}

class StubSession {
  public readonly parseCalls: Array<{ input: string; overrides: SessionParseOverrides }> = [];
  private readonly responses: ParseResponse[];

  constructor(responses: ParseResponse[]) {
    this.responses = responses;
  }

  async parse(input: string, overrides: SessionParseOverrides = {}): Promise<ParseResponse> {
    this.parseCalls.push({ input, overrides });
    const index = this.parseCalls.length - 1;
    return this.responses[index];
  }
}

class SessionTrackingCore extends ParseratorCore {
  public readonly sessionInits: ParseratorSessionInit[] = [];
  constructor(
    options: ConstructorParameters<typeof ParseratorCore>[0],
    private readonly session: StubSession
  ) {
    super(options);
  }

  // Override to supply the stub session for deterministic assertions.
  createSession(init: ParseratorSessionInit): ParseratorSession {
    this.sessionInits.push(init);
    return this.session as unknown as ParseratorSession;
  }
}

class InspectableCore extends ParseratorCore {
  public lastSessionInit?: ParseratorSessionInit;

  createSession(init: ParseratorSessionInit): ParseratorSession {
    this.lastSessionInit = init;
    return super.createSession(init);
  }
}

function createPlan(id: string): SearchPlan {
  return {
    id,
    version: '1.0',
    steps: [
      {
        targetKey: 'name',
        description: 'Extract the name field',
        searchInstruction: 'Return the name value',
        validationType: 'string',
        isRequired: true,
      },
    ],
    strategy: 'sequential',
    confidenceThreshold: 0.55,
    metadata: {
      detectedFormat: 'text/plain',
      complexity: 'low',
      estimatedTokens: 100,
      origin: 'heuristic',
    },
  };
}

function createResponse(label: string): ParseResponse {
  const plan = createPlan(`plan-${label}`);
  return {
    success: true,
    parsedData: { label },
    metadata: {
      architectPlan: plan,
      confidence: 0.9,
      tokensUsed: 20,
      processingTimeMs: 10,
      architectTokens: 5,
      extractorTokens: 15,
      requestId: `req-${label}`,
      timestamp: new Date().toISOString(),
      diagnostics: [],
      stageBreakdown: {
        architect: { timeMs: 4, tokens: 5, confidence: 0.8 },
        extractor: { timeMs: 6, tokens: 15, confidence: 0.9 },
      },
    },
  };
}

function createCoreOptions() {
  return {
    apiKey: 'test-key',
    logger: noopLogger,
    preprocessors: null,
    postprocessors: null,
  } as const;
}

function createRequest(inputData: string): ParseRequest {
  return {
    inputData,
    outputSchema: { name: 'string' },
    instructions: 'Extract contact',
  };
}

async function flushAsyncOperations() {
  await new Promise<void>(resolve => setImmediate(resolve));
}

describe('ParseratorCore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reuses cached architect plans for identical schemas', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const planCache = new FakePlanCache();

    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache,
    });

    const firstResponse = await core.parse(createRequest('First document'));
    const secondResponse = await core.parse(createRequest('Second document'));

    expect(firstResponse.success).toBe(true);
    expect(secondResponse.success).toBe(true);

    expect(architect.calls).toBe(1);
    expect(extractor.calls).toBe(2);
    expect(planCache.gets.length).toBe(2);
    expect(planCache.sets.length).toBe(1);

    expect(firstResponse.metadata.architectTokens).toBeGreaterThan(0);
    expect(secondResponse.metadata.architectTokens).toBe(0);
    expect(secondResponse.metadata.architectPlan.metadata.origin).toBe('cached');
  });

  it('keeps cached plans immutable even when responses mutate their copies', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const planCache = createInMemoryPlanCache();
    const getSpy = jest.spyOn(planCache as any, 'get');
    const setSpy = jest.spyOn(planCache as any, 'set');

    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache,
    });

    const request = createRequest('Immutable check - first');
    const cacheKey = createPlanCacheKey({
      outputSchema: request.outputSchema,
      instructions: request.instructions,
      options: request.options,
      profile: core.getProfile(),
    });

    const firstResponse = await core.parse(request);
    expect(firstResponse.metadata.architectPlan.steps[0].description).toBe('Extract the name field');
    expect(setSpy).toHaveBeenCalledTimes(1);

    // Mutate the response copy that callers receive.
    firstResponse.metadata.architectPlan.steps[0].description = 'mutated downstream';

    const cachedEntry = await Promise.resolve(planCache.get(cacheKey));
    expect(cachedEntry?.plan.steps[0].description).toBe('Extract the name field');
    expect(cachedEntry?.plan.metadata.origin).toBe('heuristic');

    const secondResponse = await core.parse(createRequest('Immutable check - second'));

    expect(architect.calls).toBe(1);
    expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(secondResponse.metadata.architectPlan.steps[0].description).toBe('Extract the name field');
    expect(secondResponse.metadata.architectPlan.metadata.origin).toBe('cached');
  });

  it('uses a shared session when batching with reusePlan enabled', async () => {
    const responses = [createResponse('one'), createResponse('two'), createResponse('three')];
    const stubSession = new StubSession(responses);

    const core = new SessionTrackingCore(
      {
        ...createCoreOptions(),
        architect: new FakeArchitect(),
        extractor: new FakeExtractor(),
      },
      stubSession
    );

    const requests = [
      { ...createRequest('first'), options: { timeout: 1000 } },
      { ...createRequest('second'), options: { retries: 2 } },
      createRequest('third'),
    ];

    const result = await core.parseMany(requests, { seedInput: 'seed' });

    expect(result).toEqual(responses);
    expect(core.sessionInits).toHaveLength(1);
    expect(core.sessionInits[0]).toMatchObject({
      outputSchema: requests[0].outputSchema,
      instructions: requests[0].instructions,
      options: requests[0].options,
      seedInput: 'seed',
    });

    expect(stubSession.parseCalls).toHaveLength(3);
    expect(stubSession.parseCalls[0]).toEqual({ input: 'first', overrides: { seedInput: 'seed' } });
    expect(stubSession.parseCalls[1]).toEqual({
      input: 'second',
      overrides: { options: { retries: 2 } },
    });
    expect(stubSession.parseCalls[2]).toEqual({ input: 'third', overrides: {} });
  });

  it('falls back to individual parses when reusePlan is disabled', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache: createInMemoryPlanCache(),
    });

    const parseSpy = jest.spyOn(core, 'parse');
    const createSessionSpy = jest.spyOn(core, 'createSession');

    const requests = [createRequest('one'), createRequest('two'), createRequest('three')];
    const responses = await core.parseMany(requests, { reusePlan: false });

    expect(responses).toHaveLength(3);
    responses.forEach(response => expect(response.success).toBe(true));
    expect(parseSpy).toHaveBeenCalledTimes(3);
    expect(createSessionSpy).not.toHaveBeenCalled();
    expect(architect.calls).toBeGreaterThanOrEqual(1);
  });

  it('hydrates sessions from responses while preserving plan cache integration', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const planCache = createInMemoryPlanCache();
    const setSpy = jest.spyOn(planCache as any, 'set');

    const core = new InspectableCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache,
    });

    const request = createRequest('session-source');
    const response = await core.parse(request);

    const setCallsAfterParse = setSpy.mock.calls.length;

    const session = core.createSessionFromResponse({ request, response });
    await flushAsyncOperations();

    expect(core.lastSessionInit).toMatchObject({
      outputSchema: request.outputSchema,
      instructions: request.instructions,
      seedInput: request.inputData,
      planConfidence: response.metadata.confidence,
    });
    expect(core.lastSessionInit?.plan?.metadata.origin).toBe('heuristic');

    expect(setSpy.mock.calls.length).toBeGreaterThan(setCallsAfterParse);

    const sessionResult = await session.parse('session-follow-up');
    expect(sessionResult.success).toBe(true);
    expect(sessionResult.metadata.architectPlan.metadata.origin).toBe('cached');
    expect(architect.calls).toBe(1);
  });

  it('exposes safe copies of plan cache entries for inspection and removal', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const planCache = createInMemoryPlanCache();

    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache,
    });

    const request = createRequest('introspect');
    await core.parse(request);

    const entry = await core.getPlanCacheEntry(request);
    expect(entry).toBeDefined();
    expect(entry?.plan.metadata.origin).toBe('heuristic');

    // Mutate the returned copy and confirm cache integrity remains intact.
    if (entry) {
      entry.plan.metadata.origin = 'mutated';
      entry.diagnostics.push({ field: '*', stage: 'architect', message: 'changed', severity: 'warning' });
    }

    const freshEntry = await core.getPlanCacheEntry(request);
    expect(freshEntry?.plan.metadata.origin).toBe('heuristic');
    expect(freshEntry?.diagnostics).toHaveLength(0);

    const deleted = await core.deletePlanCacheEntry(request);
    expect(deleted).toBe(true);
    expect(await core.getPlanCacheEntry(request)).toBeUndefined();
  });

  it('clears cached plans for the active profile when supported', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const planCache = createInMemoryPlanCache();

    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache,
    });

    const request = createRequest('clear-profile');
    await core.parse(request);

    expect(await core.getPlanCacheEntry(request)).toBeDefined();

    const cleared = await core.clearPlanCache();
    expect(cleared).toBe(true);
    expect(await core.getPlanCacheEntry(request)).toBeUndefined();
  });

  it('emits plan cache telemetry across core cache operations', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const planCache = createInMemoryPlanCache();
    const { telemetry, events } = createTelemetryRecorder();

    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache,
      telemetry,
    });

    const request = createRequest('telemetry-core');

    await core.parse(request); // miss + store
    await core.parse(request); // hit

    const deleted = await core.deletePlanCacheEntry(request);
    expect(deleted).toBe(true);

    await core.parse(request); // miss + store again

    const cleared = await core.clearPlanCache();
    expect(cleared).toBe(true);

    const cacheEvents = events.filter(
      (event): event is ParseratorPlanCacheEvent => event.type === 'plan:cache'
    );

    expect(cacheEvents.length).toBeGreaterThanOrEqual(5);

    const actions = cacheEvents.map(event => event.action);
    expect(actions).toEqual(
      expect.arrayContaining(['miss', 'store', 'hit', 'delete', 'clear'])
    );

    const hitEvent = cacheEvents.find(event => event.action === 'hit' && event.source === 'core');
    expect(hitEvent?.key).toBeDefined();
    expect(hitEvent?.planId).toBeDefined();
    expect(hitEvent?.reason).toBe('parse');

    const clearEvent = cacheEvents.find(event => event.action === 'clear');
    expect(clearEvent?.scope).toBeDefined();
    expect(clearEvent?.reason).toBe('management');
  });

  it('emits plan cache telemetry when sessions reuse cached plans', async () => {
    const architect = new FakeArchitect();
    const extractor = new FakeExtractor();
    const planCache = createInMemoryPlanCache();
    const { telemetry, events } = createTelemetryRecorder();

    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect,
      extractor,
      planCache,
      telemetry,
    });

    const request = createRequest('session-telemetry');
    await core.parse(request);

    const session = core.createSession({
      outputSchema: request.outputSchema,
      instructions: request.instructions,
      seedInput: request.inputData,
    });

    const response = await session.parse('session-doc');
    expect(response.success).toBe(true);

    await flushAsyncOperations();

    const sessionEvents = events.filter(
      (event): event is ParseratorPlanCacheEvent =>
        event.type === 'plan:cache' && event.source === 'session'
    );

    expect(sessionEvents.some(event => event.action === 'hit')).toBe(true);
    expect(sessionEvents.some(event => event.action === 'store' && event.reason === 'reuse')).toBe(true);

    const hitEvent = sessionEvents.find(event => event.action === 'hit');
    expect(hitEvent?.sessionId).toBe(session.id);
    expect(hitEvent?.reason).toBe('ensure');
  });
});
