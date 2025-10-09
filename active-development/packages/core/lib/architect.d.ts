import { ArchitectAgent, ArchitectContext, ArchitectResult, CoreLogger } from './types';
export declare class HeuristicArchitect implements ArchitectAgent {
    private readonly logger;
    constructor(logger: CoreLogger);
    createPlan(context: ArchitectContext): Promise<ArchitectResult>;
}
//# sourceMappingURL=architect.d.ts.map