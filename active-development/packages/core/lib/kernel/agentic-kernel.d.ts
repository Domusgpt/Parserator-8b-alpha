import { AgenticParseJob, KernelConfig, KernelModule, KernelRunSummary } from '../types';
export declare class AgenticKernel {
    private readonly config;
    private readonly logger;
    private modules;
    constructor(config?: Partial<KernelConfig>, logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>);
    registerModule(module: KernelModule): void;
    clearModules(): void;
    run(job: AgenticParseJob): Promise<KernelRunSummary>;
    private createRuntime;
    private validate;
    private resolvePlanner;
    private resolveExecutor;
    private invokePlanner;
    private invokeExecutor;
    private composeSuccess;
    private composeFailure;
    private createEmptyPlan;
}
//# sourceMappingURL=agentic-kernel.d.ts.map