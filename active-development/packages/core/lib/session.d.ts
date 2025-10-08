import { ArchitectAgent, CoreLogger, ExtractorAgent, ParseResponse, ParseratorCoreConfig, ParseratorSessionInit, ParseratorSessionSnapshot, SessionParseOverrides } from './types';
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
    snapshot(): ParseratorSessionSnapshot;
    private getConfig;
    private ensurePlan;
    private clonePlan;
    private captureFailure;
}
export {};
//# sourceMappingURL=session.d.ts.map