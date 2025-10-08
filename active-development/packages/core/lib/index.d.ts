import { ArchitectAgent, ArchitectContext, ArchitectResult, CoreLogger, ExtractorAgent, ExtractorContext, ExtractorResult, KernelObserver, KernelPostProcessor, KernelSnapshot, ParseRequest, ParseResponse, ParseratorCoreConfig, ParseratorCoreOptions } from './types';
export * from './types';
interface KernelRunOptions {
    request: ParseRequest;
    config: ParseratorCoreConfig;
    architect: ArchitectAgent;
    extractor: ExtractorAgent;
    fallbackExtractor?: ExtractorAgent;
    enableFieldFallbacks: boolean;
    enableExtractorFallbacks: boolean;
    postProcessors: KernelPostProcessor[];
    validateRequest: (request: ParseRequest) => void;
}
interface KernelRunResult {
    response: ParseResponse;
    snapshot: KernelSnapshot;
}
declare class ParseratorKernel {
    private readonly logger;
    private readonly observers;
    private lastSnapshot?;
    constructor(logger: CoreLogger, observers?: KernelObserver[]);
    addObserver(observer: KernelObserver): () => void;
    getLastSnapshot(): KernelSnapshot | undefined;
    run(options: KernelRunOptions): Promise<KernelRunResult>;
    private emit;
}
export declare class ParseratorCore {
    private readonly apiKey;
    private config;
    private logger;
    private architect;
    private extractor;
    private fallbackExtractor?;
    private postProcessors;
    private readonly kernel;
    constructor(options: ParseratorCoreOptions);
    updateConfig(partial: Partial<ParseratorCoreConfig>): void;
    setArchitect(agent: ArchitectAgent): void;
    setExtractor(agent: ExtractorAgent): void;
    setFallbackExtractor(agent?: ExtractorAgent): void;
    registerPostProcessor(processor: KernelPostProcessor): () => void;
    addObserver(observer: KernelObserver): () => void;
    getLastSnapshot(): KernelSnapshot | undefined;
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
export { HeuristicArchitect, RegexExtractor, ParseratorKernel };
//# sourceMappingURL=index.d.ts.map