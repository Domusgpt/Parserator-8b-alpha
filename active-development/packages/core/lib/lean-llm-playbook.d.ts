import { LeanLLMFallbackUsageSummary, LeanLLMRuntimeOptions, SearchPlan, LeanLLMPlaybook } from './types';
interface BuildPlaybookOptions {
    plan?: SearchPlan;
    usage?: LeanLLMFallbackUsageSummary;
    runtime?: LeanLLMRuntimeOptions;
}
export declare function buildLeanLLMPlaybook(options?: BuildPlaybookOptions): LeanLLMPlaybook;
export {};
//# sourceMappingURL=lean-llm-playbook.d.ts.map