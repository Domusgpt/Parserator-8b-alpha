import { ArchitectAgent, ParseratorLeanLLMPlanRewriteOptions } from './types';
interface HybridArchitectOptions extends ParseratorLeanLLMPlanRewriteOptions {
    base: ArchitectAgent;
}
export declare function createHybridArchitect(options: HybridArchitectOptions): ArchitectAgent;
export {};
//# sourceMappingURL=hybrid-architect.d.ts.map