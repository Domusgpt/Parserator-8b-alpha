import { ParseOptions, ParseratorCoreConfig, SearchStep, ValidationType } from './types';
export declare function detectValidationType(key: string, schemaValue: unknown): ValidationType;
export declare function isFieldOptional(schemaValue: unknown): boolean;
export declare function humaniseKey(key: string): string;
export declare function buildSearchInstruction(humanKey: string, validationType: ValidationType, instructions?: string): string;
export declare function detectFormat(input: string): string;
export declare function estimateComplexity(fieldCount: number, length: number): 'low' | 'medium' | 'high';
export declare function estimateTokenCost(fieldCount: number, length: number): number;
export declare function escapeRegExp(value: string): string;
export declare function normaliseKey(value: string): string;
export interface StructuredSection {
    heading: string;
    startLine: number;
    lines: string[];
}
export declare function segmentStructuredText(input: string): StructuredSection[];
export declare function buildPlannerSteps(outputSchema: Record<string, unknown>, instructions: string | undefined, options: ParseOptions | undefined, config: ParseratorCoreConfig): SearchStep[];
//# sourceMappingURL=heuristics.d.ts.map