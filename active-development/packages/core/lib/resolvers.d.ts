import { CoreLogger, FieldResolutionContext, FieldResolutionResult, FieldResolver } from './types';
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
//# sourceMappingURL=resolvers.d.ts.map