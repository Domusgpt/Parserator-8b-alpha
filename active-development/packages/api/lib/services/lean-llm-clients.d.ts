import { LeanLLMPlanClient, LeanLLMFieldClient } from '@parserator/core';
import { GeminiService, ILLMOptions } from './llm.service';
interface BaseGeminiClientOptions {
    gemini: GeminiService;
    logger?: Console;
    defaultOptions?: ILLMOptions;
}
export declare function createGeminiLeanPlanClient(options: BaseGeminiClientOptions): LeanLLMPlanClient;
export declare function createGeminiLeanFieldClient(options: BaseGeminiClientOptions): LeanLLMFieldClient;
export {};
//# sourceMappingURL=lean-llm-clients.d.ts.map