import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import { ParseratorSession } from './session';
import { ArchitectAgent, ExtractorAgent, ParseRequest, ParseResponse, ParseratorCoreConfig, ParseratorCoreOptions, ParseratorProfileOption, ParseratorSessionInit } from './types';
export * from './types';
export * from './profiles';
export { ParseratorSession } from './session';
export declare class ParseratorCore {
    private readonly apiKey;
    private config;
    private logger;
    private architect;
    private extractor;
    private resolverRegistry;
    private profileName?;
    private profileOverrides;
    private configOverrides;
    constructor(options: ParseratorCoreOptions);
    updateConfig(partial: Partial<ParseratorCoreConfig>): void;
    getConfig(): ParseratorCoreConfig;
    getProfile(): string | undefined;
    applyProfile(profile: ParseratorProfileOption): void;
    static profiles(): import("./types").ParseratorProfile[];
    setArchitect(agent: ArchitectAgent): void;
    setExtractor(agent: ExtractorAgent): void;
    registerResolver(resolver: Parameters<ResolverRegistry['register']>[0], position?: 'append' | 'prepend'): void;
    replaceResolvers(resolvers: Parameters<ResolverRegistry['register']>[0][]): void;
    listResolvers(): string[];
    createSession(init: ParseratorSessionInit): ParseratorSession;
    private composeConfig;
    parse(request: ParseRequest): Promise<ParseResponse>;
    private handleArchitectFailure;
    private handleExtractorFailure;
    private attachRegistryIfSupported;
}
export { HeuristicArchitect, RegexExtractor, ResolverRegistry, createDefaultResolvers };
//# sourceMappingURL=index.d.ts.map