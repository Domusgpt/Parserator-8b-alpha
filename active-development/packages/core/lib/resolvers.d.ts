import { CoreLogger, FieldResolutionContext, FieldResolutionResult, FieldResolver, LeanLLMResolverConfig } from './types';
export declare const LEAN_LLM_USAGE_KEY = "resolver:leanllm:usage";
export declare const PLAN_SHARED_STATE_KEY = "parserator:plan:active";
export declare const LEAN_LLM_RUNTIME_CONFIG_KEY = "resolver:leanllm:runtime-config";
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
    private readonly baseAllowOptionalFields;
    private readonly baseDefaultConfidence;
    private readonly baseMaxInputCharacters?;
    private readonly clientName;
    private readonly basePlanConfidenceGate?;
    private readonly baseMaxInvocationsPerParse?;
    private readonly baseMaxTokensPerParse?;
    private readonly requestFormatter?;
    constructor(options: LeanLLMResolverOptions);
    supports(): boolean;
    resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined>;
    private resolveEffectiveConfig;
    private mergeRuntimeOptions;
    private extractRuntimeOptions;
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