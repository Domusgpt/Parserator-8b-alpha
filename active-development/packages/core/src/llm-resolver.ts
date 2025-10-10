import {
  FieldResolutionContext,
  FieldResolutionResult,
  FieldResolver,
  LeanLLMClient,
  LeanLLMExtractionFieldContext,
  LeanLLMExtractionFieldResult,
  LeanLLMExtractionRequest,
  LeanLLMExtractionResponse,
  ParseDiagnostic,
  ParseratorLeanLLMFallbackOptions
} from './types';
import { clamp } from './utils';
import { createAsyncTaskQueue } from './async-queue';
import {
  SHARED_INSTRUCTIONS_KEY,
  SHARED_LEAN_LLM_LAST_CALL_KEY,
  SHARED_LEAN_LLM_LAST_ERROR_KEY,
  SHARED_LEAN_LLM_PENDING_KEY,
  SHARED_LEAN_LLM_RESULTS_KEY,
  SHARED_PLAN_KEY,
  SHARED_PROFILE_KEY,
  SHARED_REQUEST_ID_KEY,
  SHARED_RESOLVED_FIELD_PREFIX,
  SHARED_SCHEMA_KEY,
  SHARED_SESSION_ID_KEY
} from './resolver-constants';

interface CachedFieldResult {
  value?: unknown;
  confidence?: number;
  diagnostics: ParseDiagnostic[];
}

interface LeanLLMFallbackResolverOptions extends ParseratorLeanLLMFallbackOptions {
  client: LeanLLMClient;
}

const DEFAULT_CONFIDENCE_FLOOR = 0.5;
const DEFAULT_REQUEST_STRATEGY: Required<ParseratorLeanLLMFallbackOptions>['requestStrategy'] = 'missing-required';
const DEFAULT_COOLDOWN_MS = 2500;

function toFieldContext(step: FieldResolutionContext['step']): LeanLLMExtractionFieldContext {
  return {
    targetKey: step.targetKey,
    description: step.description,
    searchInstruction: step.searchInstruction,
    validationType: step.validationType,
    isRequired: step.isRequired
  };
}

function collectResolvedFields(shared: Map<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of shared.entries()) {
    if (key.startsWith(SHARED_RESOLVED_FIELD_PREFIX)) {
      resolved[key.slice(SHARED_RESOLVED_FIELD_PREFIX.length)] = value;
    }
  }
  return resolved;
}

function normaliseResponse(
  response: LeanLLMExtractionResponse,
  targetContexts: LeanLLMExtractionFieldContext[],
  confidenceFloor: number
): Map<string, CachedFieldResult> {
  const map = new Map<string, CachedFieldResult>();
  for (const context of targetContexts) {
    const fieldResult: LeanLLMExtractionFieldResult = response.fields[context.targetKey] ?? {};
    const diagnostics: ParseDiagnostic[] = [];

    if (fieldResult.reasoning) {
      diagnostics.push({
        field: context.targetKey,
        stage: 'extractor',
        message: `Lean LLM rationale: ${fieldResult.reasoning}`,
        severity: 'info'
      });
    }

    if (Array.isArray(fieldResult.diagnostics)) {
      diagnostics.push(...fieldResult.diagnostics);
    }

    if (Array.isArray(response.diagnostics)) {
      diagnostics.push(
        ...response.diagnostics.filter(
          diagnostic => diagnostic.field === context.targetKey || diagnostic.field === '*'
        )
      );
    }

    if (response.usage?.tokensUsed !== undefined || response.usage?.latencyMs !== undefined) {
      const pieces: string[] = [];
      if (response.usage?.tokensUsed !== undefined) {
        pieces.push(`${response.usage.tokensUsed} tokens`);
      }
      if (response.usage?.latencyMs !== undefined) {
        pieces.push(`${response.usage.latencyMs}ms`);
      }
      diagnostics.push({
        field: context.targetKey,
        stage: 'extractor',
        message: `Lean LLM fallback executed${pieces.length ? ` (${pieces.join(', ')})` : ''}`,
        severity: 'info'
      });
    }

    map.set(context.targetKey, {
      value: fieldResult.value,
      confidence: clamp(fieldResult.confidence ?? confidenceFloor, 0, 1),
      diagnostics
    });
  }

  return map;
}

function buildExtractionRequest(
  context: FieldResolutionContext,
  targetContexts: LeanLLMExtractionFieldContext[],
  resolvedFields: Record<string, unknown>
): LeanLLMExtractionRequest {
  const plan = context.shared.get(SHARED_PLAN_KEY);
  return {
    inputData: context.inputData,
    instructions: context.shared.get(SHARED_INSTRUCTIONS_KEY) as string | undefined,
    outputSchema: context.shared.get(SHARED_SCHEMA_KEY) as Record<string, unknown> | undefined,
    plan: plan && typeof plan === 'object' ? (plan as any) : undefined,
    targetFields: targetContexts,
    activeField: toFieldContext(context.step),
    resolvedFields,
    requestId: context.shared.get(SHARED_REQUEST_ID_KEY) as string | undefined,
    sessionId: context.shared.get(SHARED_SESSION_ID_KEY) as string | undefined,
    profile: context.shared.get(SHARED_PROFILE_KEY) as string | undefined
  };
}

export function createLeanLLMFallbackResolver(
  options: LeanLLMFallbackResolverOptions
): FieldResolver {
  const {
    client,
    allowOptionalFields = false,
    requestStrategy = DEFAULT_REQUEST_STRATEGY,
    concurrency = 1,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    confidenceFloor = DEFAULT_CONFIDENCE_FLOOR,
    logger
  } = options;

  const queue = createAsyncTaskQueue({
    concurrency,
    onError: error => {
      logger?.error?.('parserator-core:lean-llm-fallback-error', {
        message: error instanceof Error ? error.message : error
      });
    }
  });

  return {
    name: 'lean-llm-fallback',
    supports(): boolean {
      return true;
    },
    async resolve(context: FieldResolutionContext): Promise<FieldResolutionResult | undefined> {
      if (!context.config.enableFieldFallbacks) {
        return undefined;
      }

      if (!allowOptionalFields && !context.step.isRequired) {
        return undefined;
      }

      const cached = context.shared.get(SHARED_LEAN_LLM_RESULTS_KEY) as
        | Map<string, CachedFieldResult>
        | undefined;
      if (cached?.has(context.step.targetKey)) {
        const cachedResult = cached.get(context.step.targetKey)!;
        return {
          value: cachedResult.value,
          confidence: cachedResult.confidence ?? confidenceFloor,
          diagnostics: cachedResult.diagnostics,
          resolver: 'lean-llm-fallback'
        };
      }

      const inflight = context.shared.get(SHARED_LEAN_LLM_PENDING_KEY) as
        | Promise<Map<string, CachedFieldResult>>
        | undefined;
      if (inflight) {
        try {
          const awaited = await inflight;
          const reuse = awaited.get(context.step.targetKey);
          if (reuse) {
            return {
              value: reuse.value,
              confidence: reuse.confidence ?? confidenceFloor,
              diagnostics: reuse.diagnostics,
              resolver: 'lean-llm-fallback'
            };
          }
        } catch (error) {
          logger?.warn?.('parserator-core:lean-llm-fallback-inflight-error', {
            field: context.step.targetKey,
            message: error instanceof Error ? error.message : error
          });
        }
      }

      const now = Date.now();
      const lastCallAt = context.shared.get(SHARED_LEAN_LLM_LAST_CALL_KEY) as number | undefined;
      if (typeof lastCallAt === 'number' && now - lastCallAt < cooldownMs) {
        return {
          value: undefined,
          confidence: 0,
          diagnostics: [
            {
              field: context.step.targetKey,
              stage: 'extractor',
              message: 'Lean LLM fallback skipped due to cooldown window',
              severity: 'info'
            }
          ],
          resolver: 'lean-llm-fallback'
        };
      }

      const plan = context.shared.get(SHARED_PLAN_KEY);
      const resolvedFields = collectResolvedFields(context.shared);

      let targetContexts: LeanLLMExtractionFieldContext[] = [];
      if (requestStrategy === 'single-field' || !plan) {
        targetContexts = [toFieldContext(context.step)];
      } else {
        const planSteps = Array.isArray((plan as any)?.steps)
          ? (plan as any).steps
          : [];
        const filtered = planSteps.filter((step: any) => {
          if (!step || typeof step !== 'object') {
            return false;
          }
          if (!allowOptionalFields && step.isRequired === false) {
            return false;
          }
          const key = String(step.targetKey ?? '');
          if (!key) {
            return false;
          }
          if (resolvedFields[key] !== undefined) {
            return false;
          }
          return true;
        });

        if (!filtered.some((step: any) => step?.targetKey === context.step.targetKey)) {
          filtered.push(context.step);
        }

        targetContexts = filtered.map((step: any) => toFieldContext(step));
      }

      const request = buildExtractionRequest(context, targetContexts, resolvedFields);
      let responseMapPromise = queue.enqueue(async () => {
        const response = await client.infer(request);
        return normaliseResponse(response, targetContexts, confidenceFloor);
      });

      responseMapPromise = responseMapPromise
        .then(map => {
          context.shared.set(SHARED_LEAN_LLM_RESULTS_KEY, map);
          context.shared.set(SHARED_LEAN_LLM_LAST_CALL_KEY, now);
          context.shared.delete(SHARED_LEAN_LLM_LAST_ERROR_KEY);
          return map;
        })
        .catch(error => {
          context.shared.set(SHARED_LEAN_LLM_LAST_ERROR_KEY, error);
          throw error;
        })
        .finally(() => {
          context.shared.delete(SHARED_LEAN_LLM_PENDING_KEY);
        });

      context.shared.set(SHARED_LEAN_LLM_PENDING_KEY, responseMapPromise);
      context.shared.set(SHARED_LEAN_LLM_LAST_CALL_KEY, now);

      try {
        const map = await responseMapPromise;
        const fieldResult = map.get(context.step.targetKey);
        if (!fieldResult) {
          return {
            value: undefined,
            confidence: 0,
            diagnostics: [
              {
                field: context.step.targetKey,
                stage: 'extractor',
                message: 'Lean LLM fallback returned no result for this field',
                severity: context.step.isRequired ? 'warning' : 'info'
              }
            ],
            resolver: 'lean-llm-fallback'
          };
        }

        return {
          value: fieldResult.value,
          confidence: fieldResult.confidence ?? confidenceFloor,
          diagnostics: [
            ...fieldResult.diagnostics,
            {
              field: context.step.targetKey,
              stage: 'extractor',
              message: 'Value supplied by lean LLM fallback resolver',
              severity: fieldResult.value === undefined ? 'warning' : 'info'
            }
          ],
          resolver: 'lean-llm-fallback'
        };
      } catch (error) {
        logger?.warn?.('parserator-core:lean-llm-fallback-failed', {
          field: context.step.targetKey,
          message: error instanceof Error ? error.message : error
        });
        return {
          value: undefined,
          confidence: 0,
          diagnostics: [
            {
              field: context.step.targetKey,
              stage: 'extractor',
              message: 'Lean LLM fallback failed to resolve the field',
              severity: context.step.isRequired ? 'warning' : 'info'
            }
          ],
          resolver: 'lean-llm-fallback'
        };
      }
    }
  };
}
