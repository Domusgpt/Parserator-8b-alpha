import { buildLeanLLMPlaybook } from '../lean-llm-playbook';
import {
  LeanLLMFallbackUsageSummary,
  LeanLLMRuntimeOptions,
  SearchPlan
} from '../types';

describe('buildLeanLLMPlaybook', () => {
  const plan: SearchPlan = {
    id: 'plan-123',
    version: '1.0.0',
    strategy: 'sequential',
    steps: [
      {
        targetKey: 'invoice_total',
        description: 'Total due',
        searchInstruction: 'find total',
        validationType: 'currency',
        isRequired: true
      }
    ],
    confidenceThreshold: 0.6,
    metadata: {
      detectedFormat: 'text',
      complexity: 'medium',
      estimatedTokens: 120,
      origin: 'heuristic',
      plannerConfidence: 0.55
    }
  };

  const usage: LeanLLMFallbackUsageSummary = {
    totalInvocations: 2,
    resolvedFields: 1,
    reusedResolutions: 1,
    skippedByPlanConfidence: 1,
    skippedByLimits: 1,
    sharedExtractions: 1,
    totalTokens: 320,
    planConfidenceGate: 0.65,
    maxInvocationsPerParse: 3,
    maxTokensPerParse: 600,
    fields: [
      {
        field: 'invoice_total',
        action: 'invoked',
        confidence: 0.82,
        tokensUsed: 180,
        reason: 'Located amount near invoice label'
      },
      {
        field: 'due_date',
        action: 'skipped',
        error: 'Plan confidence gate prevented fallback',
        gate: 0.65,
        plannerConfidence: 0.72
      },
      {
        field: 'billing_name',
        action: 'reused',
        sourceField: 'invoice_total',
        sharedKeys: ['billing_name'],
        reason: 'Reused shared extraction result'
      }
    ]
  };

  const runtime: LeanLLMRuntimeOptions = {
    allowOptionalFields: true,
    defaultConfidence: 0.7,
    maxInputCharacters: 2000,
    planConfidenceGate: 0.6,
    maxInvocationsPerParse: 4,
    maxTokensPerParse: 800
  };

  it('produces a rich playbook summary', () => {
    const playbook = buildLeanLLMPlaybook({ plan, usage, runtime });

    expect(playbook.headline).toBe('Lean LLM fallback playbook');
    expect(playbook.context.planId).toBe('plan-123');
    expect(playbook.context.planOrigin).toBe('heuristic');
    expect(playbook.runtime.maxInvocationsPerParse).toBe(4);
    expect(playbook.runtime.maxTokensPerParse).toBe(800);
    expect(playbook.overview).toEqual(
      expect.arrayContaining([
        'Invoked 2 times across 3 fields.',
        '1 field resolved via the lean model.',
        '1 field reused shared extraction results.',
        '1 field skipped due to the planner confidence gate.',
        '1 field skipped because budgets were reached.',
        'Invocation budget: 2/4.',
        'Token budget: 320/800.'
      ])
    );
    expect(playbook.steps).toHaveLength(3);
    expect(playbook.steps[0]).toMatchObject({ field: 'invoice_total', status: 'resolved' });
    expect(playbook.steps[1]).toMatchObject({ field: 'due_date', status: 'skipped-plan-confidence' });
    expect(playbook.steps[2]).toMatchObject({ field: 'billing_name', status: 'reused' });
    expect(playbook.spawnCommand).toContain('--plan-id=plan-123');
    expect(playbook.spawnCommand).toContain('--plan-gate=0.6');
    expect(playbook.spawnCommand).toContain('--invocation-budget=4');
  });

  it('handles absent usage gracefully', () => {
    const playbook = buildLeanLLMPlaybook();
    expect(playbook.overview).toEqual(['Lean fallback was not invoked for this parse.']);
    expect(playbook.steps).toHaveLength(0);
    expect(playbook.budgets).toEqual({});
  });
});
