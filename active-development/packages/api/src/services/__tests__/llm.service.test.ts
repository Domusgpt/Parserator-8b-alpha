import type { GenerativeModel } from '@google/generative-ai';

import { GeminiService } from '../llm.service';

describe('GeminiService timeout handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears the timeout when the LLM responds before the deadline', async () => {
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as Console;

    const service = Object.create(GeminiService.prototype) as GeminiService;
    (service as unknown as { logger: Console }).logger = logger;

    const generateContentMock = jest.fn().mockResolvedValue({
      response: {
        text: () => 'OK',
        candidates: [{ finishReason: 'STOP', safetyRatings: [] }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }
      }
    });

    const model = { generateContent: generateContentMock } as unknown as GenerativeModel;

    const config = {
      maxTokens: 128,
      temperature: 0.1,
      topP: 0.8,
      topK: 40,
      stopSequences: [],
      timeoutMs: 5000,
      model: 'test-model'
    } as const;

    const unhandledRejections: unknown[] = [];
    const handler = (reason: unknown) => {
      unhandledRejections.push(reason);
    };

    process.on('unhandledRejection', handler);

    try {
      const result = await (service as any).executeLLMCall(
        model,
        'Hello world',
        config,
        'test-request'
      );

      expect(result.content).toBe('OK');

      await Promise.resolve();
      jest.runOnlyPendingTimers();

      expect(unhandledRejections).toHaveLength(0);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      process.off('unhandledRejection', handler);
    }
  });
});
