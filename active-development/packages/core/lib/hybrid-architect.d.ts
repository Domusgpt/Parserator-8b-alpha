import { ArchitectAgent, ParseratorLeanLLMPlanRewriteOptions } from './types';
import type { PlanRewriteTelemetryEmitter } from './telemetry';
interface HybridArchitectOptions extends ParseratorLeanLLMPlanRewriteOptions {
    base: ArchitectAgent;
    emitTelemetry?: PlanRewriteTelemetryEmitter;
}
export declare function createHybridArchitect(options: HybridArchitectOptions): ArchitectAgent;
export {};
//# sourceMappingURL=hybrid-architect.d.ts.map