import { KernelModule, KernelModuleResult, KernelRuntimeContext, PlannerPayload, SearchPlan } from '../types';
export declare class DefaultArchitectModule implements KernelModule<PlannerPayload, SearchPlan> {
    readonly name = "planner/default-architect";
    readonly kind: "planner";
    supports(): boolean;
    execute(context: KernelRuntimeContext, job: PlannerPayload): Promise<KernelModuleResult<SearchPlan>>;
}
//# sourceMappingURL=architect-module.d.ts.map