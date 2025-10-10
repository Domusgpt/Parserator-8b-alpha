import { CoreLogger, FieldResolutionContext, FieldResolutionResult, FieldResolver, LeanLLMClient, LeanLLMResolverOptions } from './types';
export declare class ResolverRegistry {
    private readonly logger?;
    private resolvers;
    constructor(resolvers?: FieldResolver[], logger?: CoreLogger | undefined);
    register(resolver: FieldResolver, position?: 'append' | 'prepend'): void;
    replaceAll(resolvers: FieldResolver[]): void;
    listResolvers(): string[];
    resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined>;
}
export declare function createDefaultResolvers(logger: CoreLogger): FieldResolver[];
export declare function createLooseKeyValueResolver(logger: CoreLogger): FieldResolver;
export declare class LeanLLMResolver implements FieldResolver {
    private readonly client;
    private readonly logger;
    readonly name: string;
    private readonly includeOptional;
    private readonly defaultConfidence;
    constructor(client: LeanLLMClient, logger: CoreLogger, options?: LeanLLMResolverOptions);
    supports(step: FieldResolutionContext['step']): boolean;
    resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined>;
    private collectSteps;
    private findFieldResult;
    private createUnavailableResult;
}
//# sourceMappingURL=resolvers.d.ts.map