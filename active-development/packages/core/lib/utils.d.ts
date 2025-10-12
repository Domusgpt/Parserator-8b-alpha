import { ParseDiagnostic, ParseError, ParseMetadata, ParseRequest, ParseResponse, ParserFallbackSummary, ParseratorCoreConfig, ParseratorPlanCacheKeyInput, SearchPlan } from './types';
export declare function clamp(value: number, min: number, max: number): number;
export declare function createEmptyPlan(request: ParseRequest, config: ParseratorCoreConfig): SearchPlan;
export declare function clonePlan(plan: SearchPlan, originOverride?: SearchPlan['metadata']['origin']): SearchPlan;
export interface FailureResponseOptions {
    error: ParseError;
    plan: SearchPlan;
    requestId: string;
    diagnostics: ParseDiagnostic[];
    tokensUsed?: number;
    processingTimeMs?: number;
    architectTokens?: number;
    extractorTokens?: number;
    stageBreakdown?: ParseMetadata['stageBreakdown'];
    fallbackSummary?: ParserFallbackSummary;
}
export declare function createFailureResponse(options: FailureResponseOptions): ParseResponse;
export declare function toParseError(error: unknown, stage: ParseError['stage']): ParseError;
export declare function isParseError(error: unknown): error is ParseError;
export declare function stableStringify(value: unknown): string;
export declare function createPlanCacheKey(input: ParseratorPlanCacheKeyInput): string;
export declare function validateParseRequest(request: ParseRequest, config: ParseratorCoreConfig): void;
//# sourceMappingURL=utils.d.ts.map