import { CoreLogger, FieldResolutionContext, FieldResolutionResult, FieldResolver, LeanLLMResolverConfig } from './types';
export declare const LEAN_LLM_USAGE_KEY = "resolver:leanllm:usage";
export declare const PLAN_SHARED_STATE_KEY = "parserator:plan:active";
type LeanLLMResolverOptions = Omit<LeanLLMResolverConfig, 'position'> & {
    logger?: CoreLogger;
};
export declare class ResolverRegistry {
    private readonly logger?;
    private resolvers;
    constructor(resolvers?: FieldResolver[], logger?: CoreLogger | undefined);
    register(resolver: FieldResolver, position?: 'append' | 'prepend'): void;
    unregister(resolver: FieldResolver | string): boolean;
    replaceAll(resolvers: FieldResolver[]): void;
    listResolvers(): string[];
    resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined>;
}
export declare function createDefaultResolvers(logger: CoreLogger): FieldResolver[];
export declare function createLooseKeyValueResolver(logger: CoreLogger): FieldResolver;
export declare class LeanLLMResolver implements FieldResolver {
    private readonly options;
    readonly name: string;
    private readonly logger;
    private readonly client;
    private readonly allowOptionalFields;
    private readonly defaultConfidence;
    private readonly maxInputCharacters?;
    private readonly clientName;
    private readonly planConfidenceGate?;
    private readonly maxInvocationsPerParse?;
    private readonly maxTokensPerParse?;
    private readonly requestFormatter?;
    constructor(options: LeanLLMResolverOptions);
    supports(): boolean;
    private resolveRuntimeConfig;
    resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined>;
    private buildRequest;
    private toResolution;
    private composeOutcomeMessage;
    private shouldInvoke;
    private tryReuseSharedExtraction;
    private storeSharedResults;
    private extractSharedExtractions;
    private extractMetadataSharedExtractions;
    private normaliseSharedExtractionEntry;
    private ensureUsageSummary;
    private applySummaryConfigMetadata;
    private recordPlanGateSkip;
    private recordLimitSkip;
    private recordInvocationOutcome;
    private recordInvocationError;
    private recordReuse;
    private ensureSharedExtractionsMap;
    private ensureAttemptedSet;
    private trimInput;
}
export {};
//# sourceMappingURL=resolvers.d.ts.map