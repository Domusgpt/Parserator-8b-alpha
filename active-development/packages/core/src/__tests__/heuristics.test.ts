import { buildPlannerSteps } from '../heuristics';
import { ParseratorCoreConfig } from '../types';

const defaultConfig: ParseratorCoreConfig = {
  maxInputLength: 120_000,
  maxSchemaFields: 64,
  minConfidence: 0.55,
  defaultStrategy: 'sequential',
  enableFieldFallbacks: true
};

describe('buildPlannerSteps instruction hints', () => {
  it('adds field-specific guidance when instructions target a field', () => {
    const schema = {
      invoice_total: { optional: false }
    };

    const instructions = `
General tips: Provide accurate data.
- Invoice Total: Use the final amount due.
`;

    const [step] = buildPlannerSteps(schema, instructions, undefined, defaultConfig);

    expect(step.searchInstruction).toContain(
      'Field-specific guidance: Use the final amount due.'
    );
    expect(step.searchInstruction).toContain('Caller instructions: General tips: Provide accurate data.');
  });

  it('merges continuation lines into the field-specific guidance', () => {
    const schema = {
      invoice_total: { optional: false }
    };

    const instructions = `
Invoice Total: Use the summary amount.
  Include currency if available.
`;

    const [step] = buildPlannerSteps(schema, instructions, undefined, defaultConfig);

    expect(step.searchInstruction).toContain(
      'Field-specific guidance: Use the summary amount. Include currency if available.'
    );
  });

  it('matches human-readable field names from instructions', () => {
    const schema = {
      customer_name: { optional: false }
    };

    const instructions = `Customer Name - Prefer the full legal name from the contact record.`;

    const [step] = buildPlannerSteps(schema, instructions, undefined, defaultConfig);

    expect(step.searchInstruction).toContain(
      'Field-specific guidance: Prefer the full legal name from the contact record.'
    );
  });
});
