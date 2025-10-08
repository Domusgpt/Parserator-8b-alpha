import { AgenticKernel } from './kernel/agentic-kernel';
import { ParseInvocationOptions, ParseRequest, ParseResponse, ParseratorCoreOptions } from './types';
export * from './types';
export * from './kernel/agentic-kernel';
export * from './modules/architect-module';
export * from './modules/extractor-module';
export declare class ParseratorCore {
    private kernel;
    private currentOptions;
    constructor(options: ParseratorCoreOptions);
    /**
     * Rebuild the kernel with a new configuration without changing the API key.
     */
    reconfigure(config: ParseratorCoreOptions['config']): void;
    /**
     * Execute the architect-extractor pipeline via the agentic kernel.
     */
    parse(request: ParseRequest, invocation?: ParseInvocationOptions): Promise<ParseResponse>;
    /**
     * Expose the underlying kernel for advanced composition or module injection.
     */
    getKernel(): AgenticKernel;
}
//# sourceMappingURL=index.d.ts.map