import { CoreLogger, ParseratorPostprocessContext, ParseratorPostprocessExecutionResult, ParseratorPostprocessor } from './types';
export declare function executePostprocessors(postprocessors: ParseratorPostprocessor[], context: Omit<ParseratorPostprocessContext, 'shared'> & {
    shared?: Map<string, unknown>;
}): Promise<ParseratorPostprocessExecutionResult>;
export declare function createDefaultPostprocessors(logger: CoreLogger): ParseratorPostprocessor[];
//# sourceMappingURL=postprocessors.d.ts.map