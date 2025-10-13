import { ParseService, IParseRequest, ILeanLLMConfig } from '../parse.service';
import type { GeminiService } from '../llm.service';
import { ILLMOptions, ILLMResponse } from '../llm.service';

interface LeanResponseConfig {
  payload: Record<string, unknown>;
  tokensUsed?: number;
  model?: string;
  finishReason?: string;
  responseTimeMs?: number;
}

class RecordingGeminiService {
  public readonly calls: Array<{ prompt: string; options: ILLMOptions }>;
  private readonly responses: Record<string, LeanResponseConfig | undefined>;

  constructor(responses: Record<string, LeanResponseConfig | undefined> = {}) {
    this.responses = responses;
    this.calls = [];
  }

  async callGemini(prompt: string, options: ILLMOptions = {}): Promise<ILLMResponse> {
    this.calls.push({ prompt, options });

    const field = this.extractFieldFromPrompt(prompt);
    const response = this.responses[field] ?? this.responses.default ?? {
      payload: {
        value: `${field}-value`,
        confidence: 0.72,
        reason: 'fallback-default'
      },
      tokensUsed: 32,
      model: 'lean-test'
    };

    return {
      content: JSON.stringify(response.payload),
      tokensUsed: response.tokensUsed ?? 32,
      model: response.model ?? 'lean-test',
      finishReason: response.finishReason ?? 'STOP',
      responseTimeMs: response.responseTimeMs ?? 25,
      metadata: { source: 'recording-gemini-service' }
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  private extractFieldFromPrompt(prompt: string): string {
    const match = prompt.match(/Field:\s*(.+)/);
    return match ? match[1].trim() : 'unknown';
  }
}

describe('ParseService lean LLM integration', () => {
  const createService = (
    gemini: RecordingGeminiService,
    leanOverrides: Partial<ILeanLLMConfig> = {}
  ): ParseService => {
    const leanConfig: ILeanLLMConfig = {
      enabled: true,
      model: 'gemini-1.5-flash',
      maxTokens: 256,
      temperature: 0.2,
      allowOptionalFields: true,
      maxInputCharacters: 2400,
      defaultConfidence: 0.64,
      resolverName: 'lean-llm-test',
      resolverPosition: 'append',
      planConfidenceGate: 0.9,
      maxInvocationsPerParse: 4,
      maxTokensPerParse: 2048,
      ...leanOverrides
    };

    return new ParseService(
      gemini as unknown as GeminiService,
      { leanLLM: leanConfig },
      console
    );
  };

  it('invokes the lean fallback when heuristics fail and reuses shared extractions across fields', async () => {
    const gemini = new RecordingGeminiService({
      mysteryCode: {
        payload: {
          value: 'ZX-42',
          confidence: 0.83,
          reason: 'LLM extracted code',
          sharedExtractions: {
            secondaryCode: {
              value: 'ZX-42-secondary',
              confidence: 0.79,
              reason: 'Shared from primary'
            }
          }
        },
        tokensUsed: 58,
        model: 'lean-test'
      }
    });

    const service = createService(gemini);

    const request: IParseRequest = {
      inputData: 'Encoded value :: ZX-42',
      outputSchema: {
        mysteryCode: 'string',
        secondaryCode: 'string'
      },
      instructions: 'Extract the special codes even if not labelled explicitly.'
    };

    const result = await service.parse(request);

    expect(result.success).toBe(true);
    expect(result.parsedData.mysteryCode).toBe('ZX-42');
    expect(result.parsedData.secondaryCode).toBe('ZX-42-secondary');

    expect(gemini.calls).toHaveLength(1);

    const fallback = result.metadata.fallback?.leanLLM;
    expect(fallback).toBeDefined();
    expect(fallback?.totalInvocations).toBe(1);
    expect(fallback?.resolvedFields).toBe(1);
    expect(fallback?.sharedExtractions).toBe(2);
    expect(fallback?.reusedResolutions).toBe(1);

    const fields = fallback?.fields ?? [];
    const reuseEntry = fields.find(entry => entry.field === 'secondaryCode' && entry.action === 'reused');
    expect(reuseEntry).toBeDefined();
    expect(reuseEntry?.sourceField).toBe('mysteryCode');
    expect(reuseEntry?.reason).toBe('Shared from primary');

    const invocationEntry = fields.find(entry => entry.field === 'mysteryCode' && entry.action === 'invoked');
    expect(invocationEntry?.tokensUsed).toBe(58);
    expect(invocationEntry?.reason).toBe('LLM extracted code');

    expect(result.metadata.fallback?.leanLLMPlaybook).toBeDefined();
  });

  it('respects invocation budgets and records skip reasons when limits are reached', async () => {
    const gemini = new RecordingGeminiService();
    const service = createService(gemini, {
      maxInvocationsPerParse: 0,
      planConfidenceGate: 0.95
    });

    const request: IParseRequest = {
      inputData: 'There is no obvious reference to the optional summary.',
      outputSchema: {
        optionalSummary: { optional: true }
      },
      instructions: 'Return any summary if present.'
    };

    const result = await service.parse(request);

    expect(result.success).toBe(true);
    expect(result.parsedData.optionalSummary).toBeUndefined();
    expect(gemini.calls).toHaveLength(0);

    const fallback = result.metadata.fallback?.leanLLM;
    expect(fallback).toBeDefined();
    expect(fallback?.totalInvocations).toBe(0);
    expect(fallback?.skippedByLimits).toBeGreaterThanOrEqual(1);

    const skipEntry = fallback?.fields.find(
      entry => entry.field === 'optionalSummary' && entry.action === 'skipped'
    );
    expect(skipEntry).toBeDefined();
    expect(skipEntry?.reason).toBe('invocation-limit');
    expect(skipEntry?.limitType).toBe('invocations');
    expect(skipEntry?.limit).toBe(0);
  });
});
