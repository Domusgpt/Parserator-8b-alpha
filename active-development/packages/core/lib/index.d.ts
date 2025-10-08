import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import { ArchitectAgent, ExtractorAgent, ParseRequest, ParseResponse, ParseratorCoreConfig, ParseratorCoreOptions } from './types';
export * from './types';
export { HeuristicArchitect, RegexExtractor, ResolverRegistry, createDefaultResolvers };
export declare class ParseratorCore {
    private readonly apiKey;
    private config;
    private logger;
    private architect;
    private extractor;
    private resolverRegistry;
    constructor(options: ParseratorCoreOptions);
    updateConfig(partial: Partial<ParseratorCoreConfig>): void;
    getConfig(): ParseratorCoreConfig;
    setArchitect(agent: ArchitectAgent): void;
    setExtractor(agent: ExtractorAgent): void;
    registerResolver(resolver: Parameters<ResolverRegistry['register']>[0], position?: 'append' | 'prepend'): void;
    replaceResolvers(resolvers: Parameters<ResolverRegistry['register']>[0][]): void;
    listResolvers(): string[];
    parse(request: ParseRequest): Promise<ParseResponse>;
    private handleArchitectFailure;
    private handleExtractorFailure;
    private validateRequest;
    private attachRegistryIfSupported;
}
//# sourceMappingURL=index.d.ts.map