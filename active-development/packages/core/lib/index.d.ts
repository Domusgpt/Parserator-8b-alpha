import { ArchitectAgent, ArchitectContext, ArchitectResult, CoreLogger, ExtractorAgent, ExtractorContext, ExtractorResult, ParseRequest, ParseResponse, ParseratorCoreConfig, ParseratorCoreOptions } from './types';
export * from './types';
export declare class ParseratorCore {
    private readonly apiKey;
    private config;
    private logger;
    private architect;
    private extractor;
    constructor(options: ParseratorCoreOptions);
    /**
     * Update runtime configuration while keeping the same agents.
     */
    updateConfig(partial: Partial<ParseratorCoreConfig>): void;
    /**
     * Swap in a custom architect agent.
     */
    setArchitect(agent: ArchitectAgent): void;
    /**
     * Swap in a custom extractor agent.
     */
    setExtractor(agent: ExtractorAgent): void;
    /**
     * Execute the two-stage parse flow. The default implementation uses
     * a heuristic architect and regex-driven extractor so developers and
     * agents get useful behaviour without provisioning LLM credentials.
     */
    parse(request: ParseRequest): Promise<ParseResponse>;
    private validateRequest;
}
declare class HeuristicArchitect implements ArchitectAgent {
    private readonly logger;
    constructor(logger: CoreLogger);
    createPlan(context: ArchitectContext): Promise<ArchitectResult>;
}
declare class RegexExtractor implements ExtractorAgent {
    private readonly logger;
    constructor(logger: CoreLogger);
    execute(context: ExtractorContext): Promise<ExtractorResult>;
}
export { HeuristicArchitect, RegexExtractor };
//# sourceMappingURL=index.d.ts.map