import { createAsyncTaskQueue, AsyncTaskQueue } from './async-queue';
import {
  ArchitectAgent,
  ArchitectContext,
  ArchitectResult,
  LeanLLMPlanClient,
  ParseratorLeanLLMPlanRewriteOptions,
  ParseratorLeanLLMPlanRewriteState,
  ParseratorLeanLLMPlanRewriteUsage,
  ParseDiagnostic,
  SearchPlan
} from './types';
import { clamp, clonePlan } from './utils';
import type { PlanRewriteTelemetryEmitter, PlanRewriteTelemetryEventInput } from './telemetry';

interface HybridArchitectOptions extends ParseratorLeanLLMPlanRewriteOptions {
  base: ArchitectAgent;
  emitTelemetry?: PlanRewriteTelemetryEmitter;
}

const DEFAULT_MIN_CONFIDENCE = 0.75;
const DEFAULT_COOLDOWN_MS = 5_000;

function normalisePlanMetadata(base: SearchPlan, candidate: SearchPlan): SearchPlan {
  const plan = clonePlan(candidate, 'model');
  const fallback = base.metadata;
  plan.metadata = {
    detectedFormat: candidate.metadata?.detectedFormat ?? fallback.detectedFormat,
    complexity: candidate.metadata?.complexity ?? fallback.complexity,
    estimatedTokens: candidate.metadata?.estimatedTokens ?? fallback.estimatedTokens,
    origin: 'model'
  };
  return plan;
}

function buildUsageDiagnostic(usage?: { tokensUsed?: number; latencyMs?: number; model?: string }): ParseDiagnostic | undefined {
  if (!usage) {
    return undefined;
  }

  const pieces: string[] = [];
  if (usage.tokensUsed !== undefined) {
    pieces.push(`${usage.tokensUsed} tokens`);
  }
  if (usage.latencyMs !== undefined) {
    pieces.push(`${usage.latencyMs}ms`);
  }
  if (usage.model) {
    pieces.push(usage.model);
  }

  if (pieces.length === 0) {
    return undefined;
  }

  return {
    field: '*',
    stage: 'architect',
    message: `Lean LLM rewrite usage: ${pieces.join(', ')}`,
    severity: 'info'
  };
}

const toErrorMessage = (error: unknown): string | undefined => {
  if (error === undefined || error === null) {
    return undefined;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

function toQueueState(queue: AsyncTaskQueue): ParseratorLeanLLMPlanRewriteState['queue'] {
  const metrics = queue.metrics();
  return {
    pending: metrics.pending,
    inFlight: metrics.inFlight,
    completed: metrics.completed,
    failed: metrics.failed,
    size: queue.size(),
    lastDurationMs: metrics.lastDurationMs,
    lastError: toErrorMessage(metrics.lastError)
  };
}

export function createHybridArchitect(options: HybridArchitectOptions): ArchitectAgent {
  const {
    base,
    client,
    logger,
    minHeuristicConfidence = DEFAULT_MIN_CONFIDENCE,
    concurrency = 1,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    emitTelemetry
  } = options;

  const concurrencyLevel = Math.max(1, Math.floor(concurrency));
  const cooldownWindow = Math.max(0, cooldownMs);

  let lastAttemptAt = 0;
  let lastSuccessAt: number | undefined;
  let lastFailureAt: number | undefined;
  let lastErrorMessage: string | undefined;
  let lastUsage: ParseratorLeanLLMPlanRewriteUsage | undefined;

  const queue = createAsyncTaskQueue({
    concurrency: concurrencyLevel,
    onError: error => {
      lastErrorMessage = toErrorMessage(error);
      lastFailureAt = Date.now();
      logger?.error?.('parserator-core:lean-llm-plan-rewrite-queue-error', {
        message: lastErrorMessage ?? 'unknown lean LLM plan rewrite error'
      });
    }
  });

  const emit = (event: PlanRewriteTelemetryEventInput) => {
    emitTelemetry?.({
      ...event,
      cooldownMs: cooldownWindow,
      queue: event.queue ?? toQueueState(queue)
    });
  };

  const toIso = (value?: number) => (value ? new Date(value).toISOString() : undefined);

  return {
    async createPlan(context: ArchitectContext): Promise<ArchitectResult> {
      const heuristicStart = Date.now();
      const heuristicResult = await base.createPlan(context);
      const heuristicElapsed = Date.now() - heuristicStart;

      if (!heuristicResult.success || !heuristicResult.searchPlan) {
        return heuristicResult;
      }

      const diagnostics = [...heuristicResult.diagnostics];
      const baseThreshold = Math.max(
        minHeuristicConfidence,
        context.config.minConfidence
      );
      const requestedThreshold = context.options?.confidenceThreshold
        ? Math.max(context.options.confidenceThreshold, baseThreshold)
        : baseThreshold;

      if (heuristicResult.confidence >= requestedThreshold) {
        emit({
          action: 'skipped',
          skipReason: 'threshold',
          heuristicsConfidence: heuristicResult.confidence,
          requestedThreshold,
          requestId: context.requestId,
          sessionId: context.sessionId
        });
        return {
          ...heuristicResult,
          diagnostics
        };
      }

      const now = Date.now();
      if (cooldownWindow > 0 && lastAttemptAt && now - lastAttemptAt < cooldownWindow) {
        diagnostics.push({
          field: '*',
          stage: 'architect',
          message: 'Lean LLM rewrite skipped due to cooldown window',
          severity: 'info'
        });
        emit({
          action: 'skipped',
          skipReason: 'cooldown',
          heuristicsConfidence: heuristicResult.confidence,
          requestedThreshold,
          requestId: context.requestId,
          sessionId: context.sessionId
        });
        return {
          ...heuristicResult,
          diagnostics
        };
      }

      lastAttemptAt = now;

      try {
        const rewriteTask = queue.enqueue(async () => {
          emit({
            action: 'started',
            heuristicsConfidence: heuristicResult.confidence,
            requestedThreshold,
            requestId: context.requestId,
            sessionId: context.sessionId
          });

          const rewriteStart = Date.now();
          const response = await client.rewrite({
            inputData: context.inputData,
            outputSchema: context.outputSchema,
            instructions: context.instructions,
            heuristicPlan: clonePlan(
              heuristicResult.searchPlan!,
              heuristicResult.searchPlan!.metadata.origin
            ),
            diagnostics,
            context: {
              profile: context.profile,
              requestId: context.requestId,
              sessionId: context.sessionId
            }
          });

          return {
            response,
            rewriteDuration: Date.now() - rewriteStart
          };
        });

        emit({
          action: 'queued',
          heuristicsConfidence: heuristicResult.confidence,
          requestedThreshold,
          requestId: context.requestId,
          sessionId: context.sessionId
        });

        const { response, rewriteDuration } = await rewriteTask;

        if (!response?.plan) {
          diagnostics.push({
            field: '*',
            stage: 'architect',
            message: 'Lean LLM rewrite returned no plan; continuing with heuristic result',
            severity: 'warning'
          });
          lastFailureAt = Date.now();
          lastErrorMessage = 'Lean LLM rewrite returned no plan';
          lastUsage = response?.usage
            ? { ...response.usage }
            : undefined;
          emit({
            action: 'failed',
            skipReason: 'empty-plan',
            heuristicsConfidence: heuristicResult.confidence,
            requestedThreshold,
            requestId: context.requestId,
            sessionId: context.sessionId,
            error: lastErrorMessage
          });
          return {
            ...heuristicResult,
            diagnostics
          };
        }

        const rewrittenPlan = normalisePlanMetadata(heuristicResult.searchPlan, response.plan);
        const rewriteConfidence = clamp(
          Math.max(heuristicResult.confidence, response.confidence ?? requestedThreshold),
          0,
          1
        );

        diagnostics.push({
          field: '*',
          stage: 'architect',
          message: 'Lean LLM rewrite applied over heuristic plan',
          severity: 'info'
        });
        if (response.diagnostics?.length) {
          diagnostics.push(...response.diagnostics);
        }
        const usageDiagnostic = buildUsageDiagnostic(response.usage);
        if (usageDiagnostic) {
          diagnostics.push(usageDiagnostic);
        }

        lastSuccessAt = Date.now();
        lastFailureAt = undefined;
        lastErrorMessage = undefined;
        lastUsage = response.usage ? { ...response.usage } : undefined;

        const rewriteTokens = response.usage?.tokensUsed ?? Math.max(48, Math.round(rewrittenPlan.steps.length * 6));
        const heuristicDuration = Math.max(heuristicResult.processingTimeMs, heuristicElapsed);

        emit({
          action: 'applied',
          heuristicsConfidence: heuristicResult.confidence,
          requestedThreshold,
          rewriteConfidence,
          requestId: context.requestId,
          sessionId: context.sessionId,
          usage: lastUsage
        });

        return {
          success: true,
          searchPlan: rewrittenPlan,
          tokensUsed: heuristicResult.tokensUsed + rewriteTokens,
          processingTimeMs: heuristicDuration + rewriteDuration,
          confidence: rewriteConfidence,
          diagnostics
        };
      } catch (error) {
        const message = toErrorMessage(error) ?? 'Lean LLM rewrite failed with unknown error';
        logger?.warn?.('parserator-core:lean-llm-plan-rewrite-error', {
          message
        });
        lastFailureAt = Date.now();
        lastErrorMessage = message;
        lastUsage = undefined;
        diagnostics.push({
          field: '*',
          stage: 'architect',
          message: `Lean LLM rewrite failed: ${message}`,
          severity: 'warning'
        });
        emit({
          action: 'failed',
          skipReason: 'error',
          heuristicsConfidence: heuristicResult.confidence,
          requestedThreshold,
          requestId: context.requestId,
          sessionId: context.sessionId,
          error
        });
        return {
          ...heuristicResult,
          diagnostics
        };
      }
    },
    getPlanRewriteState(): ParseratorLeanLLMPlanRewriteState | undefined {
      const pendingCooldown =
        cooldownWindow > 0 && lastAttemptAt > 0 && Date.now() - lastAttemptAt < cooldownWindow;

      return {
        enabled: true,
        minHeuristicConfidence,
        cooldownMs: cooldownWindow,
        concurrency: concurrencyLevel,
        pendingCooldown,
        lastAttemptAt: lastAttemptAt ? toIso(lastAttemptAt) : undefined,
        lastSuccessAt: toIso(lastSuccessAt),
        lastFailureAt: toIso(lastFailureAt),
        lastError: lastErrorMessage,
        lastUsage,
        queue: toQueueState(queue)
      };
    }
  };
}
