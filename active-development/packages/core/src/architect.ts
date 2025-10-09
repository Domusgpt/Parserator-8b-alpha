import {
  ArchitectAgent,
  ArchitectContext,
  ArchitectResult,
  CoreLogger,
  ParseDiagnostic,
  SearchPlan
} from './types';
import {
  buildPlannerSteps,
  detectFormat,
  estimateComplexity,
  estimateTokenCost
} from './heuristics';
import { clamp } from './utils';

export class HeuristicArchitect implements ArchitectAgent {
  constructor(private readonly logger: CoreLogger) {}

  async createPlan(context: ArchitectContext): Promise<ArchitectResult> {
    const start = Date.now();
    const diagnostics: ParseDiagnostic[] = [];

    const steps = buildPlannerSteps(
      context.outputSchema,
      context.instructions,
      context.options,
      context.config
    ).map(step => {
      if (!step.isRequired) {
        diagnostics.push({
          field: step.targetKey,
          stage: 'architect',
          message: `${step.targetKey} marked as optional by schema heuristics`,
          severity: 'info'
        });
      }
      return step;
    });

    const plan: SearchPlan = {
      id: `plan_${Date.now().toString(36)}`,
      version: '1.0',
      steps,
      strategy: context.config.defaultStrategy,
      confidenceThreshold:
        context.options?.confidenceThreshold ?? context.config.minConfidence,
      metadata: {
        detectedFormat: detectFormat(context.inputData),
        complexity: estimateComplexity(steps.length, context.inputData.length),
        estimatedTokens: estimateTokenCost(steps.length, context.inputData.length),
        origin: 'heuristic'
      }
    };

    const confidence = steps.length > 0 ? clamp(0.68 + steps.length * 0.01, 0, 0.92) : 0.65;

    this.logger.debug?.('parserator-core:architect-plan', {
      fields: steps.length,
      strategy: plan.strategy,
      confidence
    });

    return {
      success: true,
      searchPlan: plan,
      tokensUsed: Math.max(48, Math.round(plan.metadata.estimatedTokens * 0.3)),
      processingTimeMs: Date.now() - start,
      confidence,
      diagnostics
    };
  }
}
