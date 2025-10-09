import { ArchitectAgent, CoreLogger, ExtractorAgent, ParseResponse, ParseratorCoreConfig, ParseratorPlanRefreshResult, ParseratorPlanState, ParseratorSessionInit, ParseratorSessionSnapshot, ParseratorTelemetry, ParseratorInterceptor, SessionParseOverrides, RefreshPlanOptions, ParseratorPlanHealth } from './types';
interface ParseratorSessionDependencies {
    architect: ArchitectAgent;
    extractor: ExtractorAgent;
    config: () => ParseratorCoreConfig;
    logger: CoreLogger;
    telemetry: ParseratorTelemetry;
    interceptors: () => ParseratorInterceptor[];
    profile?: string;
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
    private telemetry;
    private profileName?;
    private planUpdatedAt?;
    private lastSeedInput?;
    private planRuns;
    private planSuccesses;
    private planFailures;
    private planConfidenceHistory;
    private readonly maxConfidenceSamples;
    private lastSuccessAt?;
    private lastFailureAt?;
    constructor(deps: ParseratorSessionDependencies);
    parse(inputData: string, overrides?: SessionParseOverrides): Promise<ParseResponse>;
    snapshot(): ParseratorSessionSnapshot;
    getPlanHealth(): ParseratorPlanHealth;
    exportInit(overrides?: Partial<ParseratorSessionInit>): ParseratorSessionInit;
    private getInterceptors;
    private runBeforeInterceptors;
    private runAfterInterceptors;
    private runFailureInterceptors;
    private getConfig;
    private ensurePlan;
    getPlanState(options?: {
        includePlan?: boolean;
    }): ParseratorPlanState;
    refreshPlan(options?: RefreshPlanOptions): Promise<ParseratorPlanRefreshResult>;
    private clonePlan;
    private captureFailure;
    private resetPlanHealthMetrics;
    private recordPlanRun;
    private calculateConfidenceTrend;
}
export {};
//# sourceMappingURL=session.d.ts.map