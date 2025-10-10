import { buildPlannerSteps, detectSystemContext } from '../heuristics';
import { DetectedSystemContext, ParseratorCoreConfig } from '../types';

describe('detectSystemContext', () => {
  it('identifies CRM style schemas using both fields and instruction cues', () => {
    const schema = {
      leadName: 'Primary lead contact',
      pipelineStage: 'Current pipeline stage',
      accountOwner: 'Owner of the related account'
    };

    const instructions = 'Use CRM pipeline details to keep the lead record accurate.';

    const context = detectSystemContext(schema, instructions);

    expect(context).toBeDefined();
    expect(context).toMatchObject({
      id: 'crm',
      label: 'Customer Relationship Management'
    });
    expect(context?.confidence).toBeGreaterThan(0.9);
    expect(context?.matchedFields).toEqual(
      expect.arrayContaining(['leadName', 'pipelineStage', 'accountOwner'])
    );
    expect(context?.matchedInstructionTerms).toEqual(
      expect.arrayContaining(['crm', 'pipeline', 'lead'])
    );
    expect(context?.rationale.some(entry => entry.includes('Schema fields matched'))).toBe(true);
    expect(context?.rationale.some(entry => entry.includes('Lead and account terminology'))).toBe(true);
  });
});

describe('buildPlannerSteps', () => {
  const config: ParseratorCoreConfig = {
    maxInputLength: 100_000,
    maxSchemaFields: 50,
    minConfidence: 0.6,
    defaultStrategy: 'sequential',
    enableFieldFallbacks: true
  };

  it('injects context specific hints when the context is confident', () => {
    const schema = { amountDue: 'Outstanding invoice balance' };
    const context: DetectedSystemContext = {
      id: 'finance',
      label: 'Financial Document',
      confidence: 0.72,
      matchedFields: ['amountDue'],
      matchedInstructionTerms: [],
      rationale: []
    };

    const [step] = buildPlannerSteps(schema, 'Focus on invoice totals.', undefined, config, context);

    expect(step.searchInstruction).toContain(
      'Normalise monetary values with decimals and include currency codes when stated.'
    );
    expect(step.searchInstruction).toContain('Caller instructions: Focus on invoice totals.');
  });

  it('skips contextual hints when the detected context is too weak', () => {
    const schema = { amountDue: 'Outstanding invoice balance' };
    const weakContext: DetectedSystemContext = {
      id: 'finance',
      label: 'Financial Document',
      confidence: 0.42,
      matchedFields: ['amountDue'],
      matchedInstructionTerms: [],
      rationale: []
    };

    const [step] = buildPlannerSteps(schema, 'Focus on invoice totals.', undefined, config, weakContext);

    expect(step.searchInstruction).not.toContain('Normalise monetary values with decimals');
    expect(step.searchInstruction).not.toContain('Optimise for financial document records.');
    expect(step.searchInstruction).toContain('Caller instructions: Focus on invoice totals.');
  });
});
