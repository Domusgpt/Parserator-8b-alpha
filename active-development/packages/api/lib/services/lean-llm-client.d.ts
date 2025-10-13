import { LightweightLLMClient, LightweightLLMExtractionRequest, LightweightLLMExtractionResponse } from '@parserator/core';
import { GeminiService } from './llm.service';
export interface LeanLLMClientOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    promptPreamble?: string;
}
export declare class LeanLLMClient implements LightweightLLMClient {
    private readonly geminiService;
    private readonly options;
    private readonly logger;
    readonly name: string;
    constructor(geminiService: GeminiService, options?: LeanLLMClientOptions, logger?: Console, name?: string);
    extractField(request: LightweightLLMExtractionRequest): Promise<LightweightLLMExtractionResponse>;
    private buildPrompt;
    private parseResponse;
    private extractJsonPayload;
    private normaliseConfidence;
    private parseSharedExtractions;
}
//# sourceMappingURL=lean-llm-client.d.ts.map