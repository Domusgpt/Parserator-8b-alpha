import { FieldResolver, ParseratorLeanLLMFieldFallbackOptions, ParseratorLeanLLMFieldFallbackState } from './types';
import type { FieldFallbackTelemetryEmitter } from './telemetry';
interface LeanLLMFieldResolverOptions extends ParseratorLeanLLMFieldFallbackOptions {
    emitTelemetry?: FieldFallbackTelemetryEmitter;
}
export interface LeanLLMFieldResolver extends FieldResolver {
    getState(): ParseratorLeanLLMFieldFallbackState;
}
export declare function createLeanLLMFieldResolver(options: LeanLLMFieldResolverOptions): LeanLLMFieldResolver;
export {};
//# sourceMappingURL=lean-llm-field-resolver.d.ts.map