import { ExecutorPayload, KernelModule, KernelModuleResult, KernelRuntimeContext } from '../types';
export declare class DefaultExtractorModule implements KernelModule<ExecutorPayload, Record<string, unknown>> {
    readonly name = "executor/default-extractor";
    readonly kind: "executor";
    supports(): boolean;
    execute(_context: KernelRuntimeContext, payload: ExecutorPayload): Promise<KernelModuleResult<Record<string, unknown>>>;
}
//# sourceMappingURL=extractor-module.d.ts.map