import { v4 as uuidv4 } from 'uuid';

import {
  AgenticParseJob,
  KernelDiagnostic,
  KernelModule,
  KernelModuleResult,
  KernelRuntimeContext,
  PlannerPayload,
  SearchPlan,
  ValidationType
} from '../types';

function inferValidationType(value: unknown): ValidationType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'number')) return 'number_array';
    return 'string_array';
  }
  if (value && typeof value === 'object') return 'object';
  return 'string';
}

function buildDiagnostics(job: AgenticParseJob): KernelDiagnostic[] {
  return [
    {
      stage: 'planner',
      severity: 'info',
      message: 'Architect module generated plan from schema',
      details: {
        fields: Object.keys(job.outputSchema).length,
        strategy: job.options?.confidenceThreshold ? 'custom' : 'default'
      }
    }
  ];
}

export class DefaultArchitectModule
  implements KernelModule<PlannerPayload, SearchPlan>
{
  readonly name = 'planner/default-architect';
  readonly kind = 'planner' as const;

  supports(): boolean {
    return true;
  }

  async execute(
    context: KernelRuntimeContext,
    job: PlannerPayload
  ): Promise<KernelModuleResult<SearchPlan>> {
    const entries = Object.entries(job.outputSchema ?? {});
    const steps = entries.map(([key, descriptor]) => ({
      targetKey: key,
      description: `Extract ${key} from the source payload`,
      searchInstruction: `Identify the best candidate for “${key}” given the schema expectation.`,
      validationType: inferValidationType(descriptor),
      isRequired: true
    }));

    const plan: SearchPlan = {
      id: uuidv4(),
      version: '2024.09-agentic',
      steps,
      strategy: job.options?.confidenceThreshold ? 'adaptive' : 'sequential',
      confidenceThreshold:
        job.options?.confidenceThreshold ?? context.config.minConfidence,
      metadata: {
        detectedFormat: job.inputData.trim().startsWith('{') ? 'json' : 'text',
        complexity:
          steps.length > 20 ? 'high' : steps.length > 8 ? 'medium' : 'low',
        estimatedTokens: Math.max(32, Math.round(job.inputData.length / 6)),
        origin: 'model'
      }
    };

    return {
      success: true,
      output: plan,
      metadata: {
        confidence: 0.82,
        planPreview: steps.slice(0, 3).map(step => step.targetKey)
      },
      diagnostics: buildDiagnostics(job),
      tokensUsed: Math.round(steps.length * 18 + plan.metadata.estimatedTokens * 0.15)
    };
  }
}
