import {
  DetectedSystemContext,
  ParseOptions,
  ParseratorCoreConfig,
  SearchStep,
  ValidationType
} from './types';

export function detectValidationType(key: string, schemaValue: unknown): ValidationType {
  if (typeof schemaValue === 'string') {
    const lowered = schemaValue.toLowerCase();
    if (lowered.includes('email')) return 'email';
    if (lowered.includes('phone')) return 'phone';
    if (lowered.includes('date')) return 'date';
    if (lowered.includes('url')) return 'url';
    if (lowered.includes('number')) return 'number';
    if (lowered.includes('boolean')) return 'boolean';
    if (lowered.includes('currency') || lowered.includes('amount')) return 'currency';
    if (lowered.includes('%') || lowered.includes('percent')) return 'percentage';
    if (lowered.includes('address')) return 'address';
    if (lowered.includes('name')) return 'name';
  }

  const normalised = key.toLowerCase();
  if (normalised.includes('email')) return 'email';
  if (normalised.includes('phone')) return 'phone';
  if (normalised.includes('date')) return normalised.includes('iso') ? 'iso_date' : 'date';
  if (normalised.includes('url') || normalised.includes('link')) return 'url';
  if (normalised.includes('count') || normalised.includes('number') || normalised.includes('total')) {
    return 'number';
  }
  if (normalised.includes('flag') || normalised.startsWith('is_') || normalised.startsWith('has_')) {
    return 'boolean';
  }
  if (normalised.includes('ids') || normalised.includes('numbers')) return 'number_array';
  if (normalised.includes('list') || normalised.includes('tags')) return 'string_array';
  if (normalised.includes('amount') || normalised.includes('price') || normalised.includes('cost')) {
    return 'currency';
  }
  if (normalised.includes('percent') || normalised.includes('ratio')) {
    return 'percentage';
  }
  if (normalised.includes('address') || normalised.includes('location')) {
    return 'address';
  }
  if (normalised.includes('name') || normalised.includes('contact')) {
    return 'name';
  }

  return 'string';
}

export function isFieldOptional(schemaValue: unknown): boolean {
  if (
    schemaValue &&
    typeof schemaValue === 'object' &&
    'optional' in (schemaValue as Record<string, unknown>)
  ) {
    return Boolean((schemaValue as Record<string, unknown>).optional);
  }

  return false;
}

export function humaniseKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchInstruction(
  humanKey: string,
  validationType: ValidationType,
  instructions?: string,
  context?: DetectedSystemContext
): string {
  const parts: string[] = [];
  parts.push(`Locate the value for "${humanKey}".`);
  const guidance = {
    email: 'Prefer RFC compliant email addresses.',
    phone: 'Return the primary phone number including country code when available.',
    date: 'Return the most relevant date mentioned (dd/mm/yyyy accepted).',
    iso_date: 'Return the ISO-8601 date representation (YYYY-MM-DD).',
    url: 'Return the main URL or link that matches the request.',
    number: 'Return a numeric value; remove formatting characters.',
    number_array: 'Return numeric values as an array.',
    string_array: 'Return textual values as an array.',
    boolean: 'Return true/false based on clear affirmative language.',
    string: 'Return the literal text response.',
    object: 'Return structured JSON describing the field.',
    custom: 'Apply custom logic described by the caller.'
  } as Record<ValidationType, string>;

  parts.push(guidance[validationType] ?? guidance.string);

  if (context) {
    const contextualHint = resolveContextualHint(context, validationType);
    if (contextualHint) {
      parts.push(contextualHint);
    } else {
      parts.push(`Optimise for ${context.label.toLowerCase()} records.`);
    }
  }

  if (instructions) {
    parts.push(`Caller instructions: ${instructions}`);
  }

  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectFormat(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return 'unknown';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return 'html';
  }
  if (trimmed.includes(',')) {
    return 'csv-like';
  }
  return 'text';
}

export function estimateComplexity(fieldCount: number, length: number): 'low' | 'medium' | 'high' {
  if (fieldCount <= 3 && length < 5_000) return 'low';
  if (fieldCount <= 8 && length < 20_000) return 'medium';
  return 'high';
}

export function estimateTokenCost(fieldCount: number, length: number): number {
  const base = Math.ceil(length / 4);
  return Math.min(2000, base + fieldCount * 32);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normaliseKey(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
}

interface ContextRule {
  id: string;
  label: string;
  schemaKeywords: string[];
  instructionKeywords?: string[];
  baseConfidence?: number;
  description?: string;
  generalHint?: string;
  validationHints?: Partial<Record<ValidationType, string>>;
}

const SYSTEM_CONTEXT_RULES: ContextRule[] = [
  {
    id: 'ecommerce',
    label: 'E-commerce Catalog',
    schemaKeywords: ['sku', 'product', 'variant', 'inventory', 'price', 'upc', 'category', 'brand'],
    instructionKeywords: ['product', 'catalog', 'cart', 'retail', 'merch', 'listing', 'shop'],
    baseConfidence: 0.32,
    description: 'Product-focused schema fields detected.',
    generalHint: 'Align answers with product catalogue terminology and include variant-specific context when available.',
    validationHints: {
      currency: 'Return pricing data and capture currency symbols when present.',
      number: 'Use inventory counts or quantity values related to the product.',
      string: 'Emphasise product names, variant labels, or merchandising descriptors.'
    }
  },
  {
    id: 'crm',
    label: 'Customer Relationship Management',
    schemaKeywords: ['lead', 'contact', 'company', 'account', 'pipeline', 'stage', 'deal', 'owner', 'opportunity'],
    instructionKeywords: ['crm', 'sales', 'pipeline', 'deal', 'lead'],
    baseConfidence: 0.3,
    description: 'Lead and account terminology found in schema.',
    generalHint: 'Surface contact-centric information suitable for CRM records and note lifecycle stage where possible.',
    validationHints: {
      name: 'Prefer full contact names or account owners referenced in the data.',
      string: 'Highlight relationship status, lifecycle stage, or next actions relevant to CRM workflows.'
    }
  },
  {
    id: 'finance',
    label: 'Financial Document',
    schemaKeywords: ['invoice', 'amount', 'balance', 'due', 'tax', 'payment', 'total', 'transaction', 'account', 'statement'],
    instructionKeywords: ['invoice', 'payment', 'billing', 'accounting', 'finance'],
    baseConfidence: 0.34,
    description: 'Financial terminology detected across schema fields.',
    generalHint: 'Prioritise monetary amounts, payment status, and billing identifiers for financial documents.',
    validationHints: {
      currency: 'Normalise monetary values with decimals and include currency codes when stated.',
      date: 'Return dates tied to billing or payment schedules such as due or issue dates.',
      string: 'Capture reference numbers (invoice, purchase order) or payment statuses verbatim.'
    }
  },
  {
    id: 'healthcare',
    label: 'Medical Record',
    schemaKeywords: ['patient', 'diagnosis', 'provider', 'treatment', 'medication', 'clinic', 'procedure', 'insurance'],
    instructionKeywords: ['medical', 'health', 'patient', 'clinical'],
    baseConfidence: 0.28,
    description: 'Medical terminology detected throughout the schema.',
    generalHint: 'Maintain medically accurate language and respect patient context when extracting values.',
    validationHints: {
      string: 'Summarise clinical information such as diagnoses, treatments, or physician notes with precision.',
      date: 'Return dates associated with care events, admissions, or treatment milestones.'
    }
  },
  {
    id: 'support',
    label: 'Support Ticket',
    schemaKeywords: ['ticket', 'issue', 'priority', 'status', 'agent', 'queue', 'resolution', 'sla', 'incident'],
    instructionKeywords: ['support', 'helpdesk', 'ticket', 'incident', 'case'],
    baseConfidence: 0.27,
    description: 'Support workflow vocabulary discovered in schema fields.',
    generalHint: 'Focus on ticket lifecycle attributes such as status, severity, owners, and resolution actions.',
    validationHints: {
      string: 'Capture concise issue statements or resolution notes that help triage the ticket.',
      boolean: 'Indicate whether the ticket has been resolved or still requires attention.'
    }
  }
];

function resolveContextualHint(
  context: DetectedSystemContext,
  validationType: ValidationType
): string | undefined {
  const rule = SYSTEM_CONTEXT_RULES.find(candidate => candidate.id === context.id);
  if (!rule) {
    return undefined;
  }

  return rule.validationHints?.[validationType] ?? rule.generalHint;
}

function tokeniseInstructionTerms(instructions?: string): string[] {
  if (!instructions) {
    return [];
  }
  const tokens = instructions
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3);
  return Array.from(new Set(tokens));
}

function extractSchemaDescriptors(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractSchemaDescriptors);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(extractSchemaDescriptors);
  }

  return [];
}

export function detectSystemContext(
  outputSchema: Record<string, unknown>,
  instructions?: string
): DetectedSystemContext | undefined {
  const schemaEntries = Object.entries(outputSchema).map(([field, descriptor]) => ({
    field,
    fieldKey: normaliseKey(field),
    descriptorTokens: extractSchemaDescriptors(descriptor).map(token => normaliseKey(token))
  }));

  const instructionTokens = tokeniseInstructionTerms(instructions);

  let bestMatch: {
    rule: ContextRule;
    matchedFields: string[];
    matchedInstructionTerms: string[];
    confidence: number;
    rationale: string[];
  } | undefined;

  for (const rule of SYSTEM_CONTEXT_RULES) {
    const matchedFields: string[] = [];
    const matchedInstructionTerms: string[] = [];

    for (const entry of schemaEntries) {
      const hasSchemaMatch = rule.schemaKeywords.some(keyword => {
        return (
          entry.fieldKey.includes(keyword) ||
          entry.descriptorTokens.some(token => token.includes(keyword))
        );
      });

      if (hasSchemaMatch) {
        matchedFields.push(entry.field);
      }
    }

    if (rule.instructionKeywords?.length) {
      instructionTokens.forEach(token => {
        if (rule.instructionKeywords!.some(keyword => token.includes(keyword))) {
          matchedInstructionTerms.push(token);
        }
      });
    }

    const uniqueFields = Array.from(new Set(matchedFields));
    const uniqueInstructionTerms = Array.from(new Set(matchedInstructionTerms));
    const totalMatches = uniqueFields.length + uniqueInstructionTerms.length;

    if (totalMatches === 0) {
      continue;
    }

    const coverage = uniqueFields.length / Math.max(schemaEntries.length, 1);
    const confidence = Math.min(
      0.95,
      (rule.baseConfidence ?? 0.25) +
        Math.min(uniqueFields.length, 5) * 0.14 +
        Math.min(uniqueInstructionTerms.length, 4) * 0.1 +
        coverage * 0.22
    );

    if (confidence < 0.45) {
      continue;
    }

    const rationale: string[] = [];
    if (uniqueFields.length) {
      rationale.push(`Schema fields matched: ${uniqueFields.join(', ')}`);
    }
    if (uniqueInstructionTerms.length) {
      rationale.push(`Instruction cues: ${uniqueInstructionTerms.join(', ')}`);
    }
    if (coverage >= 0.35) {
      rationale.push(
        `Approximately ${Math.round(coverage * 100)}% of fields align with ${rule.label.toLowerCase()} keywords.`
      );
    }
    if (rule.description) {
      rationale.push(rule.description);
    }

    if (
      !bestMatch ||
      confidence > bestMatch.confidence ||
      (confidence === bestMatch.confidence && uniqueFields.length > bestMatch.matchedFields.length)
    ) {
      bestMatch = {
        rule,
        matchedFields: uniqueFields,
        matchedInstructionTerms: uniqueInstructionTerms,
        confidence,
        rationale
      };
    }
  }

  if (!bestMatch) {
    return undefined;
  }

  return {
    id: bestMatch.rule.id,
    label: bestMatch.rule.label,
    confidence: bestMatch.confidence,
    matchedFields: bestMatch.matchedFields,
    matchedInstructionTerms: bestMatch.matchedInstructionTerms,
    rationale: bestMatch.rationale
  };
}

export interface StructuredSection {
  heading: string;
  startLine: number;
  lines: string[];
}

export function segmentStructuredText(input: string): StructuredSection[] {
  const lines = input.split(/\r?\n/);
  const sections: StructuredSection[] = [];

  let current: StructuredSection = { heading: 'root', startLine: 0, lines: [] };

  const pushCurrent = () => {
    if (current.lines.length === 0) {
      return;
    }
    if (current.heading === 'root' && !current.lines.some(line => line.trim())) {
      return;
    }
    sections.push({ ...current, lines: [...current.lines] });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      current.lines.push(line);
      return;
    }

    if (isLikelyHeading(trimmed)) {
      pushCurrent();
      current = {
        heading: trimmed.replace(/:$/, '').trim(),
        startLine: index,
        lines: []
      };
      return;
    }

    current.lines.push(line);
  });

  pushCurrent();

  return sections;
}

function isLikelyHeading(value: string): boolean {
  if (!value) {
    return false;
  }

  if (value.length > 64) {
    return false;
  }

  const withoutTrailingColon = value.replace(/:$/, '');
  const words = withoutTrailingColon.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return false;
  }

  if (value.endsWith(':') && words.length <= 8) {
    return true;
  }

  const uppercase = withoutTrailingColon.toUpperCase();
  if (uppercase === withoutTrailingColon && words.length <= 6) {
    return true;
  }

  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(withoutTrailingColon) && words.length <= 6) {
    return true;
  }

  return false;
}

export function buildPlannerSteps(
  outputSchema: Record<string, unknown>,
  instructions: string | undefined,
  options: ParseOptions | undefined,
  config: ParseratorCoreConfig,
  context?: DetectedSystemContext
): SearchStep[] {
  return Object.keys(outputSchema).map(field => {
    const schemaValue = outputSchema[field];
    const validationType = detectValidationType(field, schemaValue);
    const isRequired = !isFieldOptional(schemaValue);
    const humanKey = humaniseKey(field);

    const searchInstruction = buildSearchInstruction(
      humanKey,
      validationType,
      instructions,
      context
    );

    return {
      targetKey: field,
      description: `Extract ${humanKey}`,
      searchInstruction,
      validationType,
      isRequired
    };
  });
}
