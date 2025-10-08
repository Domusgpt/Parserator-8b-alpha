import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import { ArchitectAgent, CoreLogger, ExtractorAgent, ParseRequest, ParseResponse, ParseratorCoreConfig, ParseratorCoreOptions, ParseratorSessionInit, ParseratorSessionSnapshot, SearchPlan, SessionParseOverrides } from './types';
export * from './types';
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
    createSession(init: ParseratorSessionInit): ParseratorSession;
    parse(request: ParseRequest): Promise<ParseResponse>;
    private handleArchitectFailure;
    private handleExtractorFailure;
    private attachRegistryIfSupported;
}
interface ParseratorSessionDependencies {
    architect: ArchitectAgent;
    extractor: ExtractorAgent;
    config: () => ParseratorCoreConfig;
    logger: CoreLogger;
    init: ParseratorSessionInit;
}
export declare class ParseratorSession {
    private readonly deps;
    readonly id: string;
    readonly createdAt: string;
    private plan?;
    private planDiagnostics;
    private planConfidence;
    private planTokens;
    private planProcessingTime;
    private totalArchitectTokens;
    private totalExtractorTokens;
    private parseCount;
    private lastRequestId?;
    private lastConfidence?;
    private lastDiagnostics;
    private lastResponse?;
    private defaultSeedInput?;
    constructor(deps: ParseratorSessionDependencies);
    parse(inputData: string, overrides?: SessionParseOverrides): Promise<ParseResponse>;
    getPlan(): SearchPlan | undefined;
    snapshot(): ParseratorSessionSnapshot;
    private getConfig;
    private ensurePlan;
    private clonePlan;
    private captureFailure;
}
export { HeuristicArchitect, RegexExtractor, ResolverRegistry, createDefaultResolvers };
//# sourceMappingURL=index.d.ts.map