import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import { ParseratorSession } from './session';
import { ArchitectAgent, ExtractorAgent, ParseObserver, ParseRequest, ParseResponse, ParseratorCoreConfig, ParseratorCoreOptions } from './types';
export * from './types';
export { HeuristicArchitect, RegexExtractor, ResolverRegistry, createDefaultResolvers, ParseratorSession };
export declare class ParseratorCore {
    private readonly apiKey;
    private config;
    private logger;
    private architect;
    private extractor;
    private resolverRegistry;
    private observers;
    constructor(options: ParseratorCoreOptions);
    updateConfig(partial: Partial<ParseratorCoreConfig>): void;
    getConfig(): ParseratorCoreConfig;
    setArchitect(agent: ArchitectAgent): void;
    setExtractor(agent: ExtractorAgent): void;
    registerResolver(resolver: Parameters<ResolverRegistry['register']>[0], position?: 'append' | 'prepend'): void;
    replaceResolvers(resolvers: Parameters<ResolverRegistry['register']>[0][]): void;
    listResolvers(): string[];
    parse(request: ParseRequest): Promise<ParseResponse>;
    createSession(request: ParseRequest, sessionId?: string): ParseratorSession;
    addObserver(observer: ParseObserver): () => void;
    removeObserver(observer: ParseObserver): void;
    clearObservers(): void;
    getObservers(): ParseObserver[];
    private attachRegistryIfSupported;
    private dispatch;
}
//# sourceMappingURL=index.d.ts.map