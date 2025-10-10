import { FieldResolver, LeanLLMClient, ParseratorLeanLLMFallbackOptions } from './types';
interface LeanLLMFallbackResolverOptions extends ParseratorLeanLLMFallbackOptions {
    client: LeanLLMClient;
}
export declare function createLeanLLMFallbackResolver(options: LeanLLMFallbackResolverOptions): FieldResolver;
export {};
//# sourceMappingURL=llm-resolver.d.ts.map