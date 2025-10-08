import { CoreLogger, ExtractorAgent, ExtractorContext, ExtractorResult } from './types';
import { ResolverRegistry } from './resolvers';
export declare class RegexExtractor implements ExtractorAgent {
    private readonly logger;
    private registry;
    constructor(logger: CoreLogger, registry?: ResolverRegistry);
    attachRegistry(registry: ResolverRegistry): void;
    execute(context: ExtractorContext): Promise<ExtractorResult>;
}
//# sourceMappingURL=extractor.d.ts.map