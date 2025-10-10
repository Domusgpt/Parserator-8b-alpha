import {
  LightweightLLMClient,
  LightweightLLMExtractionRequest,
  LightweightLLMExtractionResponse
} from '@parserator/core';

import { GeminiService, ILLMResponse } from './llm.service';

export interface LeanLLMClientOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  promptPreamble?: string;
}

export class LeanLLMClient implements LightweightLLMClient {
  readonly name: string;

  constructor(
    private readonly geminiService: GeminiService,
    private readonly options: LeanLLMClientOptions = {},
    private readonly logger: Console = console,
    name: string = 'gemini-lean'
  ) {
    this.name = name;
  }

  async extractField(
    request: LightweightLLMExtractionRequest
  ): Promise<LightweightLLMExtractionResponse> {
    const prompt = this.buildPrompt(request);

    try {
      const response = await this.geminiService.callGemini(prompt, {
        model: this.options.model,
        maxTokens: this.options.maxTokens,
        temperature: this.options.temperature
      });

      const parsed = this.parseResponse(response, request);
      return {
        ...parsed,
        tokensUsed: response.tokensUsed,
        metadata: {
          model: response.model,
          finishReason: response.finishReason
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown lean LLM error';
      this.logger.warn('LeanLLMClient call failed', {
        field: request.field,
        model: this.options.model,
        message
      });
      throw error;
    }
  }

  private buildPrompt(request: LightweightLLMExtractionRequest): string {
    const preamble =
      this.options.promptPreamble ??
      'You are a lightweight extraction function. Return concise JSON values only.';

    const lines = [
      preamble,
      '',
      `Field: ${request.field}`,
      `Description: ${request.description}`,
      `Validation: ${request.validationType}`,
      `Instruction: ${request.instruction}`
    ];

    if (request.plan) {
      lines.push(
        `Plan ID: ${request.plan.id} (v${request.plan.version}, ${request.plan.strategy})`,
        `Plan origin: ${request.plan.origin}`
      );
      if (request.plan.systemContext) {
        lines.push(
          `Detected context: ${request.plan.systemContext.label} (${request.plan.systemContext.id})`
        );
      }
    }

    lines.push(
      '',
      'Return strictly valid JSON with the following shape:',
      '{"value": <any>, "confidence": <number between 0 and 1>, "reason": "<short explanation>"}',
      'Do not include Markdown fences or additional commentary.',
      '',
      'Document:',
      '"""',
      request.input,
      '"""'
    );

    return lines.join('\n');
  }

  private parseResponse(
    response: ILLMResponse,
    request: LightweightLLMExtractionRequest
  ): LightweightLLMExtractionResponse {
    const payload = this.extractJsonPayload(response.content);
    if (!payload) {
      this.logger.warn('LeanLLMClient received response without JSON payload', {
        field: request.field,
        model: response.model
      });
      return {
        value: undefined,
        reason: 'Lean LLM response did not include a JSON payload.'
      };
    }

    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const confidence = this.normaliseConfidence(parsed.confidence);
      return {
        value: parsed.value,
        confidence,
        reason: typeof parsed.reason === 'string' ? parsed.reason : undefined
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      this.logger.warn('LeanLLMClient could not parse response JSON', {
        field: request.field,
        model: response.model,
        message
      });
      return {
        value: undefined,
        confidence: undefined,
        reason: 'Lean LLM response JSON could not be parsed.'
      };
    }
  }

  private extractJsonPayload(content: string): string | undefined {
    if (!content) {
      return undefined;
    }

    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = codeBlockMatch ? codeBlockMatch[1] : content;
    const braceMatch = candidate.match(/\{[\s\S]*\}/);
    return braceMatch ? braceMatch[0] : undefined;
  }

  private normaliseConfidence(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return clampConfidence(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (!Number.isNaN(parsed)) {
        return clampConfidence(parsed);
      }
    }

    return undefined;
  }
}

function clampConfidence(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
