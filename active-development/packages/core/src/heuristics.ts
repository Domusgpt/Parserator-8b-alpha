import {
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
  instructions?: string
): string {
  const base = `Locate the value for "${humanKey}"`;
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

  const suffix = guidance[validationType] ?? guidance.string;
  const hint = instructions ? ` Consider caller instructions: ${instructions}` : '';
  return `${base}. ${suffix}${hint}`.trim();
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
  config: ParseratorCoreConfig
): SearchStep[] {
  return Object.keys(outputSchema).map(field => {
    const schemaValue = outputSchema[field];
    const validationType = detectValidationType(field, schemaValue);
    const isRequired = !isFieldOptional(schemaValue);
    const humanKey = humaniseKey(field);

    const searchInstruction = buildSearchInstruction(humanKey, validationType, instructions);

    return {
      targetKey: field,
      description: `Extract ${humanKey}`,
      searchInstruction,
      validationType,
      isRequired
    };
  });
}
