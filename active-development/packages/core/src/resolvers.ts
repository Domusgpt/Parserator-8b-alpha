import {
  CoreLogger,
  FieldResolutionContext,
  FieldResolutionResult,
  FieldResolver,
  LeanLLMClient,
  LeanLLMExtractionFieldResult,
  LeanLLMExtractionRequest,
  LeanLLMExtractionResponse,
  LeanLLMResolverOptions,
  ParseDiagnostic,
  SearchStep,
  ValidationType
} from './types';
import {
  StructuredSection,
  detectFormat,
  escapeRegExp,
  normaliseKey,
  segmentStructuredText
} from './heuristics';
import { clamp } from './utils';

const JSON_PAYLOAD_KEY = 'resolver:json:payload';
const JSON_PAYLOAD_ERROR_KEY = 'resolver:json:error';
const JSON_PAYLOAD_DIAG_KEY = 'resolver:json:diagnosed';
const SECTION_CACHE_KEY = 'resolver:sections:cache';
const LOOSE_KEY_VALUE_CACHE_KEY = 'resolver:loosekv:cache';
const LEAN_LLM_RESPONSE_KEY = 'resolver:leanllm:response';
const LEAN_LLM_ERROR_KEY = 'resolver:leanllm:error';
const LEAN_LLM_FAILURE_REPORTED_KEY = 'resolver:leanllm:reported';

export class ResolverRegistry {
  private resolvers: FieldResolver[];

  constructor(resolvers: FieldResolver[] = [], private readonly logger?: CoreLogger) {
    this.resolvers = [...resolvers];
  }

  register(resolver: FieldResolver, position: 'append' | 'prepend' = 'append'): void {
    if (position === 'prepend') {
      this.resolvers = [resolver, ...this.resolvers];
    } else {
      this.resolvers = [...this.resolvers, resolver];
    }
  }

  replaceAll(resolvers: FieldResolver[]): void {
    this.resolvers = [...resolvers];
  }

  listResolvers(): string[] {
    return this.resolvers.map(resolver => resolver.name);
  }

  async resolve(
    context: FieldResolutionContext
  ): Promise<FieldResolutionResult | undefined> {
    const diagnostics: ParseDiagnostic[] = [];
    let finalResult: FieldResolutionResult | undefined;

    for (const resolver of this.resolvers) {
      if (!resolver.supports(context.step)) {
        continue;
      }

      try {
        const result = await resolver.resolve(context);
        if (!result) {
          continue;
        }

        diagnostics.push(...(result.diagnostics ?? []));
        finalResult = {
          value: result.value,
          confidence: result.confidence,
          diagnostics: [...diagnostics],
          resolver: result.resolver ?? resolver.name
        };

        if (result.value !== undefined) {
          break;
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Resolver failed with unknown error';
        const diagnostic: ParseDiagnostic = {
          field: context.step.targetKey,
          stage: 'extractor',
          message: `${resolver.name} resolver threw: ${message}`,
          severity: 'warning'
        };
        diagnostics.push(diagnostic);
        finalResult = {
          value: undefined,
          confidence: 0,
          diagnostics: [...diagnostics],
          resolver: resolver.name
        };
        this.logger?.warn?.('parserator-core:resolver-error', {
          resolver: resolver.name,
          message,
          field: context.step.targetKey
        });
      }
    }

    if (finalResult) {
      return finalResult;
    }

    if (diagnostics.length) {
      return {
        value: undefined,
        confidence: 0,
        diagnostics: [...diagnostics],
        resolver: undefined
      };
    }

    return undefined;
  }
}

export function createDefaultResolvers(logger: CoreLogger): FieldResolver[] {
  return [
    new JsonFieldResolver(logger),
    new SectionFieldResolver(logger),
    new DefaultFieldResolver(logger)
  ];
}

export function createLooseKeyValueResolver(logger: CoreLogger): FieldResolver {
  return new LooseKeyValueResolver(logger);
}

class JsonFieldResolver implements FieldResolver {
  readonly name = 'json-field';

  constructor(private readonly logger: CoreLogger) {}

  supports(): boolean {
    return true;
  }

  resolve(context: FieldResolutionContext): FieldResolutionResult | undefined {
    if (detectFormat(context.inputData) !== 'json') {
      return undefined;
    }

    let payload = context.shared.get(JSON_PAYLOAD_KEY);
    if (payload === undefined) {
      try {
        payload = JSON.parse(context.inputData);
        context.shared.set(JSON_PAYLOAD_KEY, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown JSON parse error';
        context.shared.set(JSON_PAYLOAD_KEY, null);
        context.shared.set(JSON_PAYLOAD_ERROR_KEY, message);
        this.logger?.debug?.('parserator-core:json-resolver-parse-failed', { message });
      }
    }

    if (payload === null) {
      if (!context.shared.get(JSON_PAYLOAD_DIAG_KEY)) {
        context.shared.set(JSON_PAYLOAD_DIAG_KEY, true);
        const message = context.shared.get(JSON_PAYLOAD_ERROR_KEY) ??
          'Input resembles JSON but could not be parsed. Falling back to heuristic extraction.';
        return {
          value: undefined,
          confidence: 0,
          diagnostics: [
            {
              field: context.step.targetKey,
              stage: 'extractor',
              message: String(message),
              severity: 'info'
            }
          ],
          resolver: this.name
        };
      }
      return undefined;
    }

    const searchResult = findValueInJson(payload, context.step.targetKey);
    if (!searchResult) {
      return undefined;
    }

    const diagnostics: ParseDiagnostic[] = [
      {
        field: context.step.targetKey,
        stage: 'extractor',
        message: `Resolved via JSON path ${searchResult.path.join('.')}`,
        severity: 'info'
      }
    ];

    return {
      value: searchResult.value,
      confidence: 0.92,
      diagnostics,
      resolver: this.name
    };
  }
}

class SectionFieldResolver implements FieldResolver {
  readonly name = 'section-field';

  constructor(private readonly logger: CoreLogger) {}

  supports(): boolean {
    return true;
  }

  resolve(context: FieldResolutionContext): FieldResolutionResult | undefined {
    if (detectFormat(context.inputData) === 'json') {
      return undefined;
    }

    let sections = context.shared.get(SECTION_CACHE_KEY) as StructuredSection[] | undefined;
    if (!sections) {
      sections = segmentStructuredText(context.inputData);
      context.shared.set(SECTION_CACHE_KEY, sections);
    }

    if (!sections.length) {
      return undefined;
    }

    const match = findBestSectionMatch(sections, context.step.targetKey);
    if (!match) {
      return undefined;
    }

    const sectionText = match.section.lines.join('\n').trim();
    if (!sectionText) {
      return undefined;
    }

    let value = resolveByValidation(sectionText, context.step);
    if (value === undefined) {
      value = extractFromSectionFallback(sectionText, context.step.validationType);
    }

    const confidence = clamp(0.45 + match.score * 0.4, 0, 0.88);
    const diagnostics: ParseDiagnostic[] = [
      {
        field: context.step.targetKey,
        stage: 'extractor',
        message: value === undefined
          ? `Section "${match.section.heading}" matched (score ${match.score.toFixed(2)}) but no value extracted`
          : `Resolved from section "${match.section.heading}" (score ${match.score.toFixed(2)})`,
        severity: value === undefined ? (context.step.isRequired ? 'warning' : 'info') : 'info'
      }
    ];

    return {
      value,
      confidence: value === undefined ? confidence * 0.6 : confidence,
      diagnostics,
      resolver: this.name
    };
  }
}

class LooseKeyValueResolver implements FieldResolver {
  readonly name = 'loose-key-value';

  constructor(private readonly logger: CoreLogger) {}

  supports(): boolean {
    return true;
  }

  resolve(context: FieldResolutionContext): FieldResolutionResult | undefined {
    if (detectFormat(context.inputData) === 'json') {
      return undefined;
    }

    let cache = context.shared.get(LOOSE_KEY_VALUE_CACHE_KEY) as Map<string, string[]> | undefined;
    if (!cache) {
      cache = buildLooseKeyValueMap(context.inputData);
      context.shared.set(LOOSE_KEY_VALUE_CACHE_KEY, cache);
    }

    const normalisedKey = normaliseKey(context.step.targetKey);
    const candidates = cache.get(normalisedKey);
    if (!candidates || candidates.length === 0) {
      return undefined;
    }

    let resolved: unknown;
    let validated = false;

    for (const candidate of candidates) {
      const value = resolveByValidation(candidate, context.step);
      if (value !== undefined) {
        resolved = value;
        validated = true;
        break;
      }
    }

    if (resolved === undefined) {
      resolved = candidates[0];
    }

    if (resolved === undefined) {
      return undefined;
    }

    const base = context.step.isRequired ? 0.6 : 0.5;
    const spreadBoost = Math.min(candidates.length - 1, 2) * 0.03;
    const confidence = clamp(base + (validated ? 0.18 : 0.08) + spreadBoost, 0, 0.86);

    const diagnostics: ParseDiagnostic[] = [
      {
        field: context.step.targetKey,
        stage: 'extractor',
        message: `Resolved from loose key-value match (${candidates.length} candidate${
          candidates.length > 1 ? 's' : ''
        })`,
        severity: 'info'
      }
    ];

    this.logger?.debug?.('parserator-core:resolver-loose-hit', {
      field: context.step.targetKey,
      matches: candidates.length,
      validated
    });

    return {
      value: resolved,
      confidence,
      diagnostics,
      resolver: this.name
    };
  }
}

export class LeanLLMResolver implements FieldResolver {
  readonly name: string;

  private readonly includeOptional: boolean;
  private readonly defaultConfidence: number;

  constructor(
    private readonly client: LeanLLMClient,
    private readonly logger: CoreLogger,
    options: LeanLLMResolverOptions = {}
  ) {
    this.includeOptional = options.includeOptionalFields ?? false;
    this.defaultConfidence = clamp(options.defaultConfidence ?? 0.6, 0, 1);
    const baseName = options.name ?? this.client.name ?? 'lean-llm';
    this.name = baseName.startsWith('lean-llm') ? baseName : `lean-llm:${baseName}`;
  }

  supports(step: FieldResolutionContext['step']): boolean {
    return step.isRequired || this.includeOptional;
  }

  async resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined> {
    if (!context.config.enableFieldFallbacks) {
      return undefined;
    }

    if (!context.plan) {
      return undefined;
    }

    if (!context.step.isRequired && !this.includeOptional) {
      return undefined;
    }

    let response = context.shared.get(LEAN_LLM_RESPONSE_KEY) as
      | LeanLLMExtractionResponse
      | null
      | undefined;

    if (response === undefined) {
      const steps = this.collectSteps(context.plan.steps);
      if (!steps.length) {
        context.shared.set(LEAN_LLM_RESPONSE_KEY, null);
        return undefined;
      }

      const request: LeanLLMExtractionRequest = {
        input: context.inputData,
        steps,
        instructions: context.instructions,
        schema: context.outputSchema,
        options: context.options
      };

      try {
        const start = Date.now();
        response = await this.client.extractFields(request);
        context.shared.set(LEAN_LLM_RESPONSE_KEY, response ?? null);
        this.logger.debug?.('parserator-core:lean-llm-resolver-called', {
          client: this.client.name,
          latencyMs: Date.now() - start,
          fields: steps.map(step => step.targetKey)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown lean LLM error';
        context.shared.set(LEAN_LLM_RESPONSE_KEY, null);
        context.shared.set(LEAN_LLM_ERROR_KEY, message);
        this.logger.warn?.('parserator-core:lean-llm-resolver-error', {
          client: this.client.name,
          field: context.step.targetKey,
          message
        });

        if (context.shared.get(LEAN_LLM_FAILURE_REPORTED_KEY)) {
          return undefined;
        }

        context.shared.set(LEAN_LLM_FAILURE_REPORTED_KEY, true);

        return {
          value: undefined,
          confidence: 0,
          diagnostics: [
            {
              field: context.step.targetKey,
              stage: 'extractor',
              message: `Lean LLM (${this.client.name}) resolver failed: ${message}`,
              severity: context.step.isRequired ? 'warning' : 'info'
            }
          ],
          resolver: this.name
        };
      }
    }

    if (response === null) {
      return this.createUnavailableResult(context);
    }

    const fieldResult = this.findFieldResult(response, context.step.targetKey);

    if (!fieldResult || fieldResult.value === undefined) {
      return {
        value: undefined,
        confidence: clamp(fieldResult?.confidence ?? 0.18, 0, 0.6),
        diagnostics: [
          {
            field: context.step.targetKey,
            stage: 'extractor',
            message: `Lean LLM (${this.client.name}) could not supply ${context.step.targetKey}`,
            severity: context.step.isRequired ? 'warning' : 'info'
          }
        ],
        resolver: this.name
      };
    }

    const rationaleSuffix = fieldResult.rationale ? ` — ${fieldResult.rationale}` : '';

    return {
      value: fieldResult.value,
      confidence: clamp(fieldResult.confidence ?? this.defaultConfidence, 0, 1),
      diagnostics: [
        {
          field: context.step.targetKey,
          stage: 'extractor',
          message: `Lean LLM (${this.client.name}) fallback resolved ${context.step.targetKey}${rationaleSuffix}`,
          severity: 'info'
        }
      ],
      resolver: this.name
    };
  }

  private collectSteps(steps: SearchStep[]): SearchStep[] {
    const selected = this.includeOptional ? steps : steps.filter(step => step.isRequired);
    return selected.map(step => ({ ...step }));
  }

  private findFieldResult(
    response: LeanLLMExtractionResponse,
    targetKey: string
  ): LeanLLMExtractionFieldResult | undefined {
    const normalisedTarget = normaliseKey(targetKey);
    for (const field of response?.fields ?? []) {
      const candidates = [field.key, ...(field.alternateKeys ?? [])];
      if (
        candidates.some(candidate => {
          const normalisedCandidate = normaliseKey(String(candidate ?? ''));
          return normalisedCandidate && normalisedCandidate === normalisedTarget;
        })
      ) {
        return field;
      }
    }

    return undefined;
  }

  private createUnavailableResult(
    context: FieldResolutionContext
  ): FieldResolutionResult | undefined {
    if (context.shared.get(LEAN_LLM_FAILURE_REPORTED_KEY)) {
      return undefined;
    }

    context.shared.set(LEAN_LLM_FAILURE_REPORTED_KEY, true);
    const message = context.shared.get(LEAN_LLM_ERROR_KEY) as string | undefined;

    return {
      value: undefined,
      confidence: 0,
      diagnostics: [
        {
          field: context.step.targetKey,
          stage: 'extractor',
          message: message
            ? `Lean LLM (${this.client.name}) fallback unavailable: ${message}`
            : `Lean LLM (${this.client.name}) fallback unavailable after previous failure`,
          severity: context.step.isRequired ? 'warning' : 'info'
        }
      ],
      resolver: this.name
    };
  }
}

class DefaultFieldResolver implements FieldResolver {
  readonly name = 'default-validation';

  constructor(private readonly logger: CoreLogger) {}

  supports(): boolean {
    return true;
  }

  resolve(context: FieldResolutionContext): FieldResolutionResult {
    const diagnostics: ParseDiagnostic[] = [];
    const value = resolveByValidation(context.inputData, context.step);

    if (value === undefined) {
      if (context.step.isRequired) {
        diagnostics.push({
          field: context.step.targetKey,
          stage: 'extractor',
          message: `${context.step.targetKey} not found in input`,
          severity: 'warning'
        });
      } else {
        diagnostics.push({
          field: context.step.targetKey,
          stage: 'extractor',
          message: `${context.step.targetKey} not located but field marked optional`,
          severity: 'info'
        });
      }
    }

    if (value !== undefined) {
      this.logger?.debug?.('parserator-core:resolver-default-hit', {
        field: context.step.targetKey,
        validationType: context.step.validationType
      });
    }

    const confidence = value === undefined ? 0 : confidenceForType(context.step.validationType);

    return {
      value,
      confidence,
      diagnostics,
      resolver: this.name
    };
  }
}

function buildLooseKeyValueMap(input: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const lines = input.split(/\r?\n/);

  for (const raw of lines) {
    if (!raw) {
      continue;
    }

    const line = raw.trim();
    if (!line || line.length < 3) {
      continue;
    }

    if (/^[#>*]/.test(line) || /^[-*•]\s*$/.test(line)) {
      continue;
    }

    let match = line.match(/^\s*([^:;=\-|]+?)\s*[:=]\s*(.+?)\s*$/u);
    if (!match) {
      match = line.match(/^\s*([^:;=\-|]+?)\s*(?:-|–|—)\s+(.+?)\s*$/u);
    }

    if (!match) {
      continue;
    }

    const key = normaliseKey(match[1]);
    if (!key || key.length < 2) {
      continue;
    }

    const value = match[2]?.trim();
    if (!value) {
      continue;
    }

    const existing = map.get(key);
    if (existing) {
      if (!existing.includes(value)) {
        existing.push(value);
      }
    } else {
      map.set(key, [value]);
    }
  }

  return map;
}

function resolveByValidation(
  input: string,
  step: FieldResolutionContext['step']
): unknown {
  switch (step.validationType) {
    case 'email':
      return matchFirst(input, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    case 'phone':
      return matchFirst(
        input,
        /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)[\d\s-]{7,}/
      );
    case 'iso_date':
      return matchFirst(input, /\d{4}-\d{2}-\d{2}/);
    case 'date':
      return (
        matchFirst(input, /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/) ||
        matchFirst(
          input,
          /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i
        )
      );
    case 'url':
      return matchFirst(input, /https?:\/\/[^\s]+/i);
    case 'number':
      return matchNumber(input);
    case 'boolean':
      return matchBoolean(input);
    case 'string_array':
      return matchList(input, step.targetKey, false);
    case 'number_array':
      return matchList(input, step.targetKey, true);
    case 'currency':
      return matchCurrency(input);
    case 'percentage':
      return matchPercentage(input);
    case 'address':
      return matchAddress(input);
    case 'name':
      return matchName(input);
    default:
      return matchByLabel(input, step.targetKey);
  }
}

function confidenceForType(validationType: ValidationType): number {
  switch (validationType) {
    case 'email':
    case 'phone':
    case 'iso_date':
    case 'url':
      return 0.82;
    case 'date':
    case 'number':
      return 0.78;
    case 'boolean':
      return 0.7;
    case 'string_array':
    case 'number_array':
      return 0.74;
    case 'currency':
      return 0.8;
    case 'percentage':
      return 0.76;
    case 'address':
      return 0.72;
    case 'name':
      return 0.75;
    case 'object':
      return 0.65;
    default:
      return 0.6;
  }
}

function matchFirst(input: string, regex: RegExp): string | undefined {
  const match = input.match(regex);
  return match ? match[0].trim() : undefined;
}

function matchNumber(input: string): number | undefined {
  const match = input.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function matchBoolean(input: string): boolean | undefined {
  const lowered = input.toLowerCase();
  if (/(^|\b)(true|yes|enabled)(\b|$)/.test(lowered)) {
    return true;
  }
  if (/(^|\b)(false|no|disabled)(\b|$)/.test(lowered)) {
    return false;
  }
  return undefined;
}

function matchList(input: string, key: string, numeric: boolean): unknown[] | undefined {
  const labelPattern = new RegExp(`${escapeRegExp(key)}\\s*[:\-]?\\s*(.+)`, 'i');
  const labelMatch = input.match(labelPattern);
  const source = labelMatch ? labelMatch[1] : input;

  const items = source
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return undefined;
  }

  if (numeric) {
    const numbers = items
      .map(item => item.match(/-?\d+(?:\.\d+)?/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map(match => Number(match[0]));
    return numbers.length ? numbers : undefined;
  }

  return items;
}

function matchByLabel(input: string, key: string): string | undefined {
  const labelPattern = new RegExp(`${escapeRegExp(key)}\\s*[:\-]?\\s*(.+)`, 'i');
  const match = input.match(labelPattern);
  if (match) {
    return match[1].split(/\r?\n/)[0].trim();
  }
  return undefined;
}

function matchCurrency(input: string): string | undefined {
  const currencyPattern = /(?:[$€£¥₹]|AUD|CAD|USD|EUR|GBP)\s?-?\d{1,3}(?:[\d,]*\d)?(?:\.\d+)?/i;
  const match = input.match(currencyPattern);
  if (match) {
    return match[0].replace(/\s{2,}/g, ' ').trim();
  }
  const standaloneNumber = input.match(/-?\d{1,3}(?:[\d,]*\d)?(?:\.\d+)?/);
  if (standaloneNumber && /amount|price|cost|total/i.test(input)) {
    return standaloneNumber[0];
  }
  return undefined;
}

function matchPercentage(input: string): string | undefined {
  const percentPattern = /-?\d+(?:\.\d+)?\s?(?:%|percent)/i;
  const match = input.match(percentPattern);
  return match ? match[0].replace(/\s+/g, ' ').trim() : undefined;
}

function matchAddress(input: string): string | undefined {
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const addressPattern = /\d{1,6}\s+[A-Za-z0-9.'\s]+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir)\b/i;
  for (const line of lines) {
    const match = line.match(addressPattern);
    if (match) {
      return match[0];
    }
  }
  if (lines.length >= 2) {
    const combined = lines.slice(0, 2).join(', ');
    if (/\d/.test(combined) && /(Street|St|Road|Rd|Ave|Avenue|Boulevard|Blvd|Drive|Dr)/i.test(combined)) {
      return combined;
    }
  }
  return undefined;
}

function matchName(input: string): string | undefined {
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  const csvCandidate = extractNameFromCsv(lines);
  if (csvCandidate) {
    return csvCandidate;
  }

  const labelledMatch = input.match(/(?:^|\b)(?:name|customer|contact)\s*[:\-]\s*([^\n\r]+)/i);
  if (labelledMatch) {
    const value = labelledMatch[1].split(/[\r\n,]/)[0]?.trim();
    if (value) {
      return value;
    }
  }

  const introductionMatch = input.match(/\bmy name is\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})/i);
  if (introductionMatch) {
    return introductionMatch[1].trim();
  }

  const multiWordLine = lines.find(line => /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(line));
  if (multiWordLine) {
    return multiWordLine;
  }

  const multiWordMatches = input.match(/[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)+/g);
  if (multiWordMatches && multiWordMatches.length) {
    return multiWordMatches.sort((a, b) => b.length - a.length)[0].trim();
  }

  const singleWordLine = lines.find(line => /^[A-Z][a-z]+$/.test(line));
  return singleWordLine ?? undefined;
}

function extractNameFromCsv(lines: string[]): string | undefined {
  if (lines.length < 2 || !lines.some(line => line.includes(','))) {
    return undefined;
  }

  const [headerLine, ...dataLines] = lines;
  if (!headerLine.includes(',')) {
    return undefined;
  }

  const headers = headerLine.split(',').map(part => part.trim()).filter(Boolean);
  const nameIndex = headers.findIndex(header => {
    const normalised = normaliseKey(header);
    return normalised === 'name' || normalised.includes('name');
  });

  if (nameIndex === -1) {
    return undefined;
  }

  for (const line of dataLines) {
    if (!line.includes(',')) {
      continue;
    }

    const values = line.split(',').map(part => part.trim());
    const value = values[nameIndex];
    if (!value) {
      continue;
    }

    if (/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(value)) {
      return value;
    }

    if (value) {
      return value;
    }
  }

  return undefined;
}

function findBestSectionMatch(
  sections: StructuredSection[],
  targetKey: string
): { section: StructuredSection; score: number } | undefined {
  const target = normaliseKey(targetKey);
  if (!target) {
    return undefined;
  }

  let best: { section: StructuredSection; score: number } | undefined;

  for (const section of sections) {
    const score = scoreSection(section, targetKey, target);
    if (score <= 0.3) {
      continue;
    }

    if (!best || score > best.score) {
      best = { section, score };
    }
  }

  return best;
}

function scoreSection(
  section: StructuredSection,
  targetKey: string,
  normalisedTarget: string
): number {
  if (!section.heading) {
    return section.lines.some(line => lineContainsLabel(line, targetKey)) ? 0.45 : 0.25;
  }

  const heading = normaliseKey(section.heading);
  let score = 0;

  if (heading === normalisedTarget) {
    score = 1;
  } else if (heading.includes(normalisedTarget) || normalisedTarget.includes(heading)) {
    score = 0.85;
  } else {
    const headingParts = new Set(heading.split(' ').filter(Boolean));
    const targetParts = new Set(normalisedTarget.split(' ').filter(Boolean));
    const shared = [...headingParts].filter(part => targetParts.has(part));
    if (shared.length) {
      score = Math.max(score, 0.5 + Math.min(shared.length / Math.max(targetParts.size, 1), 0.4));
    }
  }

  if (section.lines.some(line => lineContainsLabel(line, targetKey))) {
    score = Math.max(score, 0.7);
  }

  return score;
}

function lineContainsLabel(line: string, key: string): boolean {
  const pattern = new RegExp(`${escapeRegExp(key)}\\s*[:\-]`, 'i');
  return pattern.test(line);
}

function extractFromSectionFallback(value: string, validationType: ValidationType): unknown {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) {
    return undefined;
  }

  switch (validationType) {
    case 'string_array':
      return lines;
    case 'number_array': {
      const numbers = lines
        .map(line => line.match(/-?\d+(?:\.\d+)?/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map(match => Number(match[0]));
      return numbers.length ? numbers : undefined;
    }
    case 'address':
      return matchAddress(value);
    case 'name':
      return matchName(value);
    default:
      return lines[0];
  }
}

interface JsonSearchResult {
  value: unknown;
  path: string[];
}

function findValueInJson(payload: unknown, targetKey: string): JsonSearchResult | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const normalisedTarget = normaliseKey(targetKey);
  const candidateKeys = buildCandidateKeys(targetKey);

  const queue: Array<{ value: unknown; path: string[] }> = [
    { value: payload, path: [] }
  ];

  while (queue.length) {
    const current = queue.shift()!;
    if (Array.isArray(current.value)) {
      current.value.forEach((item, index) => {
        queue.push({ value: item, path: [...current.path, String(index)] });
      });
      continue;
    }

    if (current.value && typeof current.value === 'object') {
      for (const [key, value] of Object.entries(current.value)) {
        const normalisedKey = normaliseKey(key);
        if (normalisedKey === normalisedTarget || candidateKeys.has(normalisedKey)) {
          return { value, path: [...current.path, key] };
        }
        queue.push({ value, path: [...current.path, key] });
      }
    }
  }

  return undefined;
}

function buildCandidateKeys(targetKey: string): Set<string> {
  const candidates = new Set<string>();
  const base = normaliseKey(targetKey);
  candidates.add(base);

  const collapsed = targetKey.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (collapsed) {
    candidates.add(collapsed);
  }

  const pieces = normaliseKey(targetKey).split(' ');
  if (pieces.length > 1) {
    candidates.add(pieces.join(''));
    candidates.add(pieces.join('_'));
  }

  return candidates;
}
