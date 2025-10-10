import {
  ArchitectAgent,
  ArchitectResult,
  CoreLogger,
  ExtractorAgent,
  ExtractorResult,
  LeanLLMClient,
  LeanLLMExtractionRequest,
  LeanLLMExtractionResponse,
  ParseRequest,
  ParseResponse,
  ParseratorPlanCache,
  ParseratorPlanCacheEntry,
  ParseratorPlanAutoRefreshEvent,
  ParseratorPlanRefreshResult,
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
import { createPlanCacheTelemetryEmitter } from '../telemetry';

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

class RecordingLeanLLMClient implements LeanLLMClient {
  public calls: LeanLLMExtractionRequest[] = [];

  constructor(
    private readonly responder: (
      request: LeanLLMExtractionRequest
    ) => LeanLLMExtractionResponse | Promise<LeanLLMExtractionResponse>
  ) {}

  async infer(request: LeanLLMExtractionRequest): Promise<LeanLLMExtractionResponse> {
    this.calls.push(request);
    return await this.responder(request);
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

class PausingPlanCache extends FakePlanCache {
  constructor(private readonly gate: ReturnType<typeof createDeferred<void>>) {
    super();
  }

  async set(key: string, entry: ParseratorPlanCacheEntry): Promise<void> {
    await super.set(key, entry);
    await this.gate.promise;
  }
}

class FlakyPlanCache extends FakePlanCache {
  private failuresRemaining: number;

  constructor(private readonly errorMessage: string, failureCount = 1) {
    super();
    this.failuresRemaining = failureCount;
  }

  async set(key: string, entry: ParseratorPlanCacheEntry): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error(this.errorMessage);
    }

    await super.set(key, entry);
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function getAutoRefreshEvents(
  events: ParseratorTelemetryEvent[]
): ParseratorPlanAutoRefreshEvent[] {
  return events.filter(
    (event): event is ParseratorPlanAutoRefreshEvent => event.type === 'plan:auto-refresh'
  );
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

class StaticPlanArchitect implements ArchitectAgent {
  constructor(private readonly plan: SearchPlan) {}

  async createPlan(): Promise<ArchitectResult> {
    return {
      success: true,
      searchPlan: {
        ...this.plan,
        steps: this.plan.steps.map(step => ({ ...step })),
        metadata: { ...this.plan.metadata },
      },
      tokensUsed: 18,
      processingTimeMs: 7,
      confidence: 0.74,
      diagnostics: [],
    };
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

function createLeanFallbackPlan(): SearchPlan {
  return {
    id: 'lean-fallback-plan',
    version: '1.0',
    steps: [
      {
        targetKey: 'primaryEmail',
        description: 'Primary contact email',
        searchInstruction: 'Locate the primary email address in the document.',
        validationType: 'email',
        isRequired: true,
      },
      {
        targetKey: 'secondaryEmail',
        description: 'Secondary contact email',
        searchInstruction: 'Locate any backup email address.',
        validationType: 'email',
        isRequired: true,
      },
      {
        targetKey: 'notes',
        description: 'Optional notes',
        searchInstruction: 'Capture any additional notes if present.',
        validationType: 'string',
        isRequired: false,
      },
    ],
    strategy: 'sequential',
    confidenceThreshold: 0.6,
    metadata: {
      detectedFormat: 'text/plain',
      complexity: 'medium',
      estimatedTokens: 160,
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
    await session.waitForIdleTasks();

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

    await session.waitForIdleTasks();

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

describe('createPlanCacheTelemetryEmitter', () => {
  it('emits plan cache events with resolved defaults and normalised errors', () => {
    const { telemetry, events } = createTelemetryRecorder();
    const emitter = createPlanCacheTelemetryEmitter({
      telemetry,
      source: 'session',
      resolveProfile: () => 'profile-x',
      resolveSessionId: () => 'session-x',
      resolveKey: () => 'key-x',
      resolvePlanId: () => 'plan-x',
      requestIdFactory: () => 'req-x'
    });

    emitter({ action: 'miss', reason: 'parse', error: { code: 'E' } });

    expect(events).toHaveLength(1);
    const event = events[0] as ParseratorPlanCacheEvent;
    expect(event).toMatchObject({
      type: 'plan:cache',
      source: 'session',
      requestId: 'req-x',
      profile: 'profile-x',
      sessionId: 'session-x',
      key: 'key-x',
      planId: 'plan-x',
      reason: 'parse',
      action: 'miss',
      error: '{"code":"E"}'
    });
    expect(typeof event.timestamp).toBe('string');
  });

  it('logs and continues when resolver accessors throw', () => {
    const warn = jest.fn();
    const logger: CoreLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn,
      error: jest.fn()
    };
    const { telemetry, events } = createTelemetryRecorder();
    const emitter = createPlanCacheTelemetryEmitter({
      telemetry,
      source: 'core',
      resolveProfile: () => {
        throw new Error('profile-failure');
      },
      resolveKey: () => {
        throw new Error('key-failure');
      },
      requestIdFactory: () => 'req-y',
      logger
    });

    emitter({ action: 'clear', scope: 'all' });

    expect(warn).toHaveBeenCalledWith('parserator-core:plan-cache-telemetry-resolve-failed', {
      error: 'profile-failure',
      source: 'core',
      field: 'profile'
    });
    expect(warn).toHaveBeenCalledWith('parserator-core:plan-cache-telemetry-resolve-failed', {
      error: 'key-failure',
      source: 'core',
      field: 'key'
    });
    expect(events).toHaveLength(1);
    const event = events[0] as ParseratorPlanCacheEvent;
    expect(event).toMatchObject({
      type: 'plan:cache',
      source: 'core',
      requestId: 'req-y',
      key: undefined,
      scope: 'all',
      action: 'clear'
    });
  });
});

describe('ParseratorSession auto refresh telemetry', () => {
  function createAutoRefreshSession(telemetry: ParseratorTelemetry) {
    const core = new ParseratorCore({
      apiKey: 'test-key',
      logger: noopLogger,
      architect: new FakeArchitect(),
      extractor: new FakeExtractor(),
      telemetry
    });

    return core.createSession({
      outputSchema: { foo: 'string' },
      seedInput: 'seed-input',
      autoRefresh: { maxParses: 1, minIntervalMs: 10_000 }
    });
  }

  it('queues auto refresh asynchronously and emits lifecycle telemetry', async () => {
    const { telemetry, events } = createTelemetryRecorder();
    const session = createAutoRefreshSession(telemetry);

    const deferred = createDeferred<ParseratorPlanRefreshResult>();
    const refreshSpy = jest
      .spyOn(session, 'refreshPlan')
      .mockImplementation(() => deferred.promise);

    const firstResponse = await session.parse('value-1');
    const firstRequestId = firstResponse.metadata.requestId;

    expect(session.snapshot().autoRefresh?.pending).toBe(true);

    const secondResponse = await session.parse('value-2');
    const secondRequestId = secondResponse.metadata.requestId;

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(session.snapshot().autoRefresh?.pending).toBe(true);

    let autoEvents = getAutoRefreshEvents(events);
    const queuedFirst = autoEvents.filter(
      event => event.requestId === firstRequestId && event.action === 'queued'
    );
    expect(queuedFirst).toHaveLength(1);
    expect(queuedFirst[0].reason).toBe('usage');

    const triggeredFirst = autoEvents.filter(
      event => event.requestId === firstRequestId && event.action === 'triggered'
    );
    expect(triggeredFirst).toHaveLength(1);
    expect(triggeredFirst[0].pending).toBe(true);

    const pendingSkip = autoEvents.filter(
      event => event.requestId === secondRequestId && event.action === 'skipped'
    );
    expect(pendingSkip).toHaveLength(1);
    expect(pendingSkip[0].skipReason).toBe('pending');

    deferred.resolve({
      success: true,
      state: session.getPlanState()
    });
    await session.waitForIdleTasks();

    expect(session.snapshot().autoRefresh?.pending).toBe(false);

    autoEvents = getAutoRefreshEvents(events);
    const completedFirst = autoEvents.filter(
      event => event.requestId === firstRequestId && event.action === 'completed'
    );
    expect(completedFirst).toHaveLength(1);
    expect(completedFirst[0].pending).toBe(false);

    expect(
      autoEvents.filter(
        event => event.requestId === secondRequestId && event.action === 'triggered'
      )
    ).toHaveLength(0);

    refreshSpy.mockRestore();
  });

  it('emits cooldown skip telemetry when refresh is throttled', async () => {
    const { telemetry, events } = createTelemetryRecorder();
    const session = createAutoRefreshSession(telemetry);

    const refreshSpy = jest
      .spyOn(session, 'refreshPlan')
      .mockImplementation(() =>
        Promise.resolve<ParseratorPlanRefreshResult>({
          success: true,
          state: session.getPlanState()
        })
      );

    const firstResponse = await session.parse('value-1');
    await session.waitForIdleTasks();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(session.snapshot().autoRefresh?.pending).toBe(false);

    const secondResponse = await session.parse('value-2');
    await session.waitForIdleTasks();

    const autoEvents = getAutoRefreshEvents(events);

    const completedFirst = autoEvents.filter(
      event => event.requestId === firstResponse.metadata.requestId && event.action === 'completed'
    );
    expect(completedFirst).toHaveLength(1);

    const cooldownSkip = autoEvents.filter(
      event => event.requestId === secondResponse.metadata.requestId && event.action === 'skipped'
    );
    expect(cooldownSkip).toHaveLength(1);
    expect(cooldownSkip[0].skipReason).toBe('cooldown');
    expect(cooldownSkip[0].cooldownMs).toBe(10_000);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    refreshSpy.mockRestore();
  });

  it('emits failure telemetry when refresh plan rejects', async () => {
    const { telemetry, events } = createTelemetryRecorder();
    const session = createAutoRefreshSession(telemetry);

    const refreshSpy = jest
      .spyOn(session, 'refreshPlan')
      .mockImplementation(() => Promise.reject(new Error('refresh-broken')));

    const response = await session.parse('value-1');
    await session.waitForIdleTasks();

    const autoEvents = getAutoRefreshEvents(events);
    const failures = autoEvents.filter(
      event => event.requestId === response.metadata.requestId && event.action === 'failed'
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe('refresh-broken');
    expect(session.snapshot().autoRefresh?.pending).toBe(false);

    refreshSpy.mockRestore();
  });
});

describe('ParseratorSession background activity reporting', () => {
  it('tracks plan cache queue progress during asynchronous persistence', async () => {
    const deferred = createDeferred<void>();
    const planCache = new PausingPlanCache(deferred);
    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect: new FakeArchitect(),
      extractor: new FakeExtractor(),
      planCache,
    });

    const session = core.createSession({
      outputSchema: { foo: 'string' },
      seedInput: 'seed-doc',
    });

    await session.parse('document-1');

    const inFlight = session.getBackgroundTaskState();
    expect(inFlight.planCache.pendingWrites).toBe(1);
    expect(inFlight.planCache.pending).toBe(0);
    expect(inFlight.planCache.inFlight).toBe(1);
    expect(inFlight.planCache.completed).toBe(0);
    expect(inFlight.planCache.failed).toBe(0);
    expect(inFlight.planCache.attempts).toBe(1);
    expect(inFlight.planCache.idle).toBe(false);
    expect(inFlight.planCache.lastAttemptAt).toBeDefined();
    expect(inFlight.planCache.lastPersistAt).toBeUndefined();
    expect(inFlight.planCache.lastPersistReason).toBe('ensure');

    deferred.resolve();
    await session.waitForIdleTasks();

    const settled = session.getBackgroundTaskState();
    expect(settled.planCache.pendingWrites).toBe(0);
    expect(settled.planCache.pending).toBe(0);
    expect(settled.planCache.inFlight).toBe(0);
    expect(settled.planCache.completed).toBe(1);
    expect(settled.planCache.failed).toBe(0);
    expect(settled.planCache.attempts).toBe(1);
    expect(settled.planCache.idle).toBe(true);
    expect(settled.planCache.lastPersistAt).toBeDefined();
    expect(settled.planCache.lastPersistReason).toBe('ensure');
    expect(settled.planCache.lastPersistError).toBeUndefined();
    expect(settled.planCache.lastPersistDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('records last plan cache error and clears after recovery', async () => {
    const planCache = new FlakyPlanCache('persist-failure');
    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect: new FakeArchitect(),
      extractor: new FakeExtractor(),
      planCache,
    });

    const session = core.createSession({
      outputSchema: { foo: 'string' },
      seedInput: 'seed-doc',
    });

    await session.parse('document-1');
    await session.waitForIdleTasks();

    const afterFailure = session.getBackgroundTaskState();
    expect(afterFailure.planCache.pendingWrites).toBe(0);
    expect(afterFailure.planCache.pending).toBe(0);
    expect(afterFailure.planCache.inFlight).toBe(0);
    expect(afterFailure.planCache.completed).toBe(0);
    expect(afterFailure.planCache.failed).toBe(1);
    expect(afterFailure.planCache.attempts).toBe(1);
    expect(afterFailure.planCache.lastPersistError).toBe('persist-failure');
    expect(afterFailure.planCache.lastPersistAt).toBeUndefined();
    expect(afterFailure.planCache.lastPersistReason).toBe('ensure');
    expect(afterFailure.planCache.lastPersistDurationMs).toBeGreaterThanOrEqual(0);

    const refresh = await session.refreshPlan({ force: true, seedInput: 'seed-doc' });
    expect(refresh.success).toBe(true);
    await session.waitForIdleTasks();

    const afterRecovery = session.getBackgroundTaskState();
    expect(afterRecovery.planCache.pendingWrites).toBe(0);
    expect(afterRecovery.planCache.pending).toBe(0);
    expect(afterRecovery.planCache.inFlight).toBe(0);
    expect(afterRecovery.planCache.completed).toBe(1);
    expect(afterRecovery.planCache.failed).toBe(1);
    expect(afterRecovery.planCache.attempts).toBe(2);
    expect(afterRecovery.planCache.lastPersistError).toBeUndefined();
    expect(afterRecovery.planCache.lastPersistReason).toBe('refresh');
    expect(afterRecovery.planCache.lastPersistAt).toBeDefined();
    expect(afterRecovery.planCache.lastPersistDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('exposes auto refresh in-flight tasks for diagnostics', async () => {
    const { telemetry } = createTelemetryRecorder();
    const core = new ParseratorCore({
      ...createCoreOptions(),
      architect: new FakeArchitect(),
      extractor: new FakeExtractor(),
      telemetry,
    });

    const session = core.createSession({
      outputSchema: { foo: 'string' },
      seedInput: 'seed-doc',
      autoRefresh: { maxParses: 1 },
    });

    const deferred = createDeferred<ParseratorPlanRefreshResult>();
    const refreshSpy = jest
      .spyOn(session, 'refreshPlan')
      .mockImplementation(() => deferred.promise);

    await session.parse('document-1');

    const pending = session.getBackgroundTaskState();
    expect(pending.autoRefresh?.pending).toBe(true);
    expect(pending.autoRefresh?.inFlight).toBe(1);

    deferred.resolve({ success: true, state: session.getPlanState() });
    await session.waitForIdleTasks();

    const settled = session.getBackgroundTaskState();
    expect(settled.autoRefresh?.pending).toBe(false);
    expect(settled.autoRefresh?.inFlight).toBe(0);

    refreshSpy.mockRestore();
  });

  describe('lean LLM fallback resolver', () => {
    it('resolves missing required fields with a single fallback call', async () => {
      const plan = createLeanFallbackPlan();
      const client = new RecordingLeanLLMClient(async () => ({
        fields: {
          primaryEmail: { value: 'primary@example.com', confidence: 0.64 },
          secondaryEmail: { value: 'secondary@example.com', confidence: 0.6 },
        },
        usage: { tokensUsed: 12, latencyMs: 180 },
      }));

      const core = new ParseratorCore({
        ...createCoreOptions(),
        architect: new StaticPlanArchitect(plan),
        leanLLMFallback: { client },
      });

      const response = await core.parse({
        inputData: 'No emails present in this fragment.',
        outputSchema: {
          primaryEmail: 'string',
          secondaryEmail: 'string',
        },
        instructions: 'Return the contact emails.',
      });

      expect(response.success).toBe(true);
      expect(response.parsedData?.primaryEmail).toBe('primary@example.com');
      expect(response.parsedData?.secondaryEmail).toBe('secondary@example.com');
      expect(client.calls).toHaveLength(1);
      expect(client.calls[0].targetFields.map(field => field.targetKey)).toEqual([
        'primaryEmail',
        'secondaryEmail',
      ]);
      expect(client.calls[0].targetFields.every(field => field.isRequired)).toBe(true);
      expect(client.calls[0].targetFields.some(field => field.targetKey === 'notes')).toBe(false);
      expect(
        response.metadata.diagnostics.filter(diagnostic =>
          diagnostic.message.includes('Value supplied by lean LLM fallback resolver')
        ).length
      ).toBeGreaterThan(0);
    });

    it('opts into optional field fallback when configured', async () => {
      const plan = createLeanFallbackPlan();
      const client = new RecordingLeanLLMClient(async request => ({
        fields: {
          primaryEmail: { value: 'primary@example.com' },
          secondaryEmail: { value: 'secondary@example.com' },
          notes: request.targetFields.some(field => field.targetKey === 'notes')
            ? { value: 'Captured by fallback' }
            : {},
        },
      }));

      const core = new ParseratorCore({
        ...createCoreOptions(),
        architect: new StaticPlanArchitect(plan),
        leanLLMFallback: { client, allowOptionalFields: true },
      });

      const response = await core.parse({
        inputData: 'There are no obvious email markers here either.',
        outputSchema: {
          primaryEmail: 'string',
          secondaryEmail: 'string',
          notes: 'string',
        },
        instructions: 'Collect the contact details and any notes.',
      });

      expect(response.success).toBe(true);
      expect(client.calls).toHaveLength(1);
      expect(client.calls[0].targetFields.map(field => field.targetKey)).toEqual([
        'primaryEmail',
        'secondaryEmail',
        'notes',
      ]);
      expect(response.parsedData?.notes).toBe('Captured by fallback');
    });
  });
});
