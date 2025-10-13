import { CoreLogger, ParseratorPreprocessContext, ParseratorPreprocessor, ParseratorPreprocessExecutionResult } from './types';
export declare function executePreprocessors(preprocessors: ParseratorPreprocessor[], context: Omit<ParseratorPreprocessContext, 'shared'> & {
    shared?: Map<string, unknown>;
}): Promise<ParseratorPreprocessExecutionResult>;
export declare function createDefaultPreprocessors(logger: CoreLogger): ParseratorPreprocessor[];
//# sourceMappingURL=preprocessors.d.ts.map