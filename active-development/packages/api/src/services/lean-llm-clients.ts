import {
  LeanLLMPlanClient,
  LeanLLMPlanRewriteRequest,
  LeanLLMPlanRewriteResponse,
  LeanLLMFieldClient,
  LeanLLMFieldResolveRequest,
  LeanLLMFieldResolveResponse,
  ParseDiagnostic,
  ParseratorLeanLLMPlanRewriteUsage,
  SearchPlan
} from '@parserator/core';

import { GeminiService, ILLMOptions, ILLMResponse } from './llm.service';

interface BaseGeminiClientOptions {
  gemini: GeminiService;
  logger?: Console;
  defaultOptions?: ILLMOptions;
}

interface PlanRewritePayload {
  plan?: SearchPlan;
  confidence?: number;
  diagnostics?: ParseDiagnostic[];
  usage?: ParseratorLeanLLMPlanRewriteUsage;
  notes?: string;
}

interface FieldResolvePayload {
  values?: Record<string, unknown>;
  confidences?: Record<string, number>;
  confidence?: number;
  diagnostics?: ParseDiagnostic[];
  fieldDiagnostics?: Record<string, ParseDiagnostic[]>;
  usage?: ParseratorLeanLLMPlanRewriteUsage;
  error?: string;
}

const MAX_CONTEXT_LENGTH = 4000;

const ALLOWED_SEVERITIES: ParseDiagnostic['severity'][] = ['info', 'warning', 'error'];

function truncate(value: string | undefined, max = MAX_CONTEXT_LENGTH): string {
  if (!value) {
    return '';
  }

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}\n… [truncated ${value.length - max} characters]`;
}

function formatJson(value: unknown, max = MAX_CONTEXT_LENGTH): string {
  try {
    const json = JSON.stringify(value, null, 2);
    return truncate(json, max);
  } catch (error) {
    return `Unable to serialise JSON: ${(error as Error)?.message ?? 'unknown error'}`;
  }
}

function extractJson<T>(content: string): T | undefined {
  const candidates: string[] = [];
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  candidates.push(trimmed);

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    candidates.push(codeBlockMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      return JSON.parse(candidate) as T;
    } catch {
      continue;
    }
  }

  return undefined;
}

function buildUsage(response: ILLMResponse): ParseratorLeanLLMPlanRewriteUsage | undefined {
  const usage: ParseratorLeanLLMPlanRewriteUsage = {};

  if (typeof response.tokensUsed === 'number') {
    usage.tokensUsed = response.tokensUsed;
  }

  if (typeof response.responseTimeMs === 'number') {
    usage.latencyMs = response.responseTimeMs;
  }

  if (response.model) {
    usage.model = response.model;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function normaliseDiagnostics(
  value: unknown,
  fallbackStage: ParseDiagnostic['stage']
): ParseDiagnostic[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const diagnostics: ParseDiagnostic[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const message = typeof (entry as any).message === 'string' ? (entry as any).message : undefined;
    if (!message) {
      continue;
    }

    const severityCandidate = (entry as any).severity;
    const severity: ParseDiagnostic['severity'] = ALLOWED_SEVERITIES.includes(severityCandidate)
      ? severityCandidate
      : 'info';

    const stageValue = typeof (entry as any).stage === 'string' ? (entry as any).stage : fallbackStage;
    const field = typeof (entry as any).field === 'string' ? (entry as any).field : '*';

    diagnostics.push({ field, stage: stageValue, message, severity });
  }

  return diagnostics.length > 0 ? diagnostics : undefined;
}

function normaliseFieldDiagnostics(
  value: unknown,
  fallbackStage: ParseDiagnostic['stage']
): Record<string, ParseDiagnostic[]> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const result: Record<string, ParseDiagnostic[]> = {};
  for (const [field, diagnostics] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(diagnostics)) {
      continue;
    }

    const normalised = normaliseDiagnostics(diagnostics, fallbackStage);
    if (normalised?.length) {
      result[field] = normalised;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function createPlanPrompt(request: LeanLLMPlanRewriteRequest): string {
  const diagnostics = request.diagnostics?.length ? formatJson(request.diagnostics) : '[]';

  return [
    'You are the lean Parserator planning assistant. A deterministic heuristic plan is provided below along with the parse request.',
    'Your job is to decide whether a minimal rewrite is required. If you can improve it, produce a revised plan.',
    'Respond ONLY with JSON containing the keys: plan (SearchPlan structure), confidence (number between 0 and 1), and diagnostics (array).',
    '',
    'If the heuristic plan is already adequate, return the original plan and diagnostics explaining why no rewrite was required.',
    '',
    '--- Parse Request Context ---',
    `Input Data (truncated):\n${truncate(request.inputData)}`,
    '',
    `Output Schema: ${formatJson(request.outputSchema)}`,
    '',
    `Instructions: ${truncate(request.instructions) || 'None provided.'}`,
    '',
    '--- Current Heuristic Plan ---',
    formatJson(request.heuristicPlan),
    '',
    `Diagnostics: ${diagnostics}`,
    '',
    'Return strictly valid JSON. Do not include commentary or markdown.'
  ].join('\n');
}

function createFieldPrompt(request: LeanLLMFieldResolveRequest): string {
  return [
    'You are the lean Parserator field resolver. The deterministic extractor could not resolve some required fields.',
    'Review the input and return values only for the pending fields. Avoid re-stating data for fields that are not requested.',
    'Respond ONLY with JSON containing: values (object of field -> value), confidences (object of field -> number 0-1), optional confidence (number for overall), diagnostics (array), optional fieldDiagnostics (record of field -> diagnostics array), and optional error string.',
    '',
    '--- Parse Request Context ---',
    `Pending Fields: ${request.pendingFields.join(', ') || 'None'}`,
    `Profile: ${request.context.profile ?? 'not provided'}`,
    `Request ID: ${request.context.requestId ?? 'n/a'}`,
    '',
    `Input Data (truncated):\n${truncate(request.inputData)}`,
    '',
    `Output Schema: ${formatJson(request.outputSchema)}`,
    '',
    `Instructions: ${truncate(request.instructions) || 'None provided.'}`,
    '',
    '--- Planner Context ---',
    formatJson(request.plan),
    '',
    'Return strictly valid JSON with the structure described above. Do not include markdown or explanations.'
  ].join('\n');
}

function withRequestOptions(options: ILLMOptions | undefined, requestId?: string): ILLMOptions {
  return {
    ...options,
    requestId: options?.requestId ?? requestId
  };
}

function buildPlanFailureDiagnostic(message: string): ParseDiagnostic {
  return {
    field: '*',
    stage: 'architect',
    message,
    severity: 'warning'
  };
}

function buildFieldFailureDiagnostic(message: string, field: string = '*'): ParseDiagnostic {
  return {
    field,
    stage: 'extractor',
    message,
    severity: 'warning'
  };
}

export function createGeminiLeanPlanClient(options: BaseGeminiClientOptions): LeanLLMPlanClient {
  const { gemini, logger, defaultOptions } = options;

  return {
    async rewrite(request: LeanLLMPlanRewriteRequest): Promise<LeanLLMPlanRewriteResponse> {
      const prompt = createPlanPrompt(request);

      try {
        const response = await gemini.callGemini(prompt, withRequestOptions(defaultOptions, request.context.requestId));
        const usage = buildUsage(response);
        const payload = extractJson<PlanRewritePayload>(response.content);

        if (!payload?.plan) {
          const message = payload?.notes ?? 'Lean LLM plan rewrite did not return a plan';
          logger?.warn?.('parserator-api:lean-plan-client-empty-plan', {
            requestId: request.context.requestId,
            message
          });

          return {
            diagnostics: [buildPlanFailureDiagnostic(message)],
            usage,
            raw: payload ?? response.content
          };
        }

        const diagnostics = normaliseDiagnostics(payload.diagnostics, 'architect');
        return {
          plan: payload.plan,
          confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
          diagnostics,
          usage: payload.usage ?? usage,
          raw: payload
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown lean plan rewrite error';
        logger?.warn?.('parserator-api:lean-plan-client-error', {
          requestId: request.context.requestId,
          message
        });

        return {
          diagnostics: [buildPlanFailureDiagnostic(`Lean LLM plan rewrite failed: ${message}`)]
        };
      }
    }
  };
}

export function createGeminiLeanFieldClient(options: BaseGeminiClientOptions): LeanLLMFieldClient {
  const { gemini, logger, defaultOptions } = options;

  return {
    async resolve(request: LeanLLMFieldResolveRequest): Promise<LeanLLMFieldResolveResponse> {
      const prompt = createFieldPrompt(request);

      try {
        const response = await gemini.callGemini(prompt, withRequestOptions(defaultOptions, request.context.requestId));
        const usage = buildUsage(response);
        const payload = extractJson<FieldResolvePayload>(response.content);

        if (!payload) {
          const message = 'Lean LLM field fallback returned an unparseable response';
          logger?.warn?.('parserator-api:lean-field-client-parse-error', {
            requestId: request.context.requestId
          });

          return {
            error: message,
            diagnostics: [buildFieldFailureDiagnostic(message)],
            usage
          };
        }

        const diagnostics = normaliseDiagnostics(payload.diagnostics, 'extractor');
        const fieldDiagnostics = normaliseFieldDiagnostics(payload.fieldDiagnostics, 'extractor');

        return {
          values: payload.values,
          confidences: payload.confidences,
          confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
          diagnostics,
          fieldDiagnostics,
          usage: payload.usage ?? usage,
          error: typeof payload.error === 'string' ? payload.error : undefined
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown lean field fallback error';
        logger?.warn?.('parserator-api:lean-field-client-error', {
          requestId: request.context.requestId,
          message
        });

        return {
          error: message,
          diagnostics: [buildFieldFailureDiagnostic(`Lean LLM field fallback failed: ${message}`)]
        };
      }
    }
  };
}
