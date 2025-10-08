import { ArchitectAgent, ArchitectResult, CoreLogger, ExtractorAgent, ExtractorResult, ParseLifecycleEvent, ParseRequest, ParseResponse, ParseratorCoreConfig, ParseratorSessionSnapshot, SearchPlan } from './types';
interface ParseratorSessionParams {
    requestId: string;
    request: ParseRequest;
    config: ParseratorCoreConfig;
    architect: ArchitectAgent;
    extractor: ExtractorAgent;
    logger: CoreLogger;
    notify: (event: ParseLifecycleEvent) => Promise<void>;
}
export declare class ParseratorSession {
    private readonly params;
    private readonly createdAt;
    private readonly startTime;
    private architectResult?;
    private extractorResult?;
    private validationPromise?;
    constructor(params: ParseratorSessionParams);
    get id(): string;
    getSnapshot(): ParseratorSessionSnapshot;
    run(): Promise<ParseResponse>;
    plan(): Promise<ArchitectResult>;
    extract(plan: SearchPlan): Promise<ExtractorResult>;
    private ensureValidated;
    private performValidation;
    private handleArchitectFailure;
    private handleExtractorFailure;
    private normaliseArchitectError;
    private normaliseExtractorError;
    private safeNotify;
}
export {};
//# sourceMappingURL=session.d.ts.map