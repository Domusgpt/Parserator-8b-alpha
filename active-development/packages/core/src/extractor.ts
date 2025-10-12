import {
  CoreLogger,
  ExtractorAgent,
  ExtractorContext,
  ExtractorResult,
  LeanLLMFallbackUsageSummary,
  ParseDiagnostic,
  ParseError,
  ParserFallbackSummary
} from './types';
import {
  LEAN_LLM_RUNTIME_CONFIG_KEY,
  LEAN_LLM_USAGE_KEY,
  PLAN_SHARED_STATE_KEY,
  ResolverRegistry,
  createDefaultResolvers
} from './resolvers';
import { clamp } from './utils';

export class RegexExtractor implements ExtractorAgent {
  private registry: ResolverRegistry;

  constructor(private readonly logger: CoreLogger, registry?: ResolverRegistry) {
    this.registry = registry ?? new ResolverRegistry(createDefaultResolvers(logger), logger);
  }

  attachRegistry(registry: ResolverRegistry): void {
    this.registry = registry;
  }

  async execute(context: ExtractorContext): Promise<ExtractorResult> {
    const start = Date.now();
    const parsed: Record<string, unknown> = {};
    const diagnostics: ParseDiagnostic[] = [];
    let resolvedRequired = 0;
    let requiredCount = 0;
    let aggregatedConfidence = 0;

    const sharedState = new Map<string, unknown>();
    sharedState.set(PLAN_SHARED_STATE_KEY, context.plan);
    if (context.options?.leanLLM) {
      sharedState.set(LEAN_LLM_RUNTIME_CONFIG_KEY, { ...context.options.leanLLM });
    }

    for (const step of context.plan.steps) {
      if (step.isRequired) {
        requiredCount += 1;
      }

      const resolution = await this.registry.resolve({
        inputData: context.inputData,
        step,
        config: context.config,
        logger: this.logger,
        shared: sharedState,
        options: context.options
      });

      if (resolution) {
        diagnostics.push(...resolution.diagnostics);
        if (resolution.value !== undefined) {
          parsed[step.targetKey] = resolution.value;
          if (step.isRequired) {
            resolvedRequired += 1;
          }
        }
        aggregatedConfidence += computeStepConfidence(step.isRequired, resolution.confidence, resolution.value);
      } else {
        diagnostics.push({
          field: step.targetKey,
          stage: 'extractor',
          message: `${step.targetKey} not found by any resolver`,
          severity: step.isRequired ? 'warning' : 'info'
        });
        aggregatedConfidence += step.isRequired ? 0 : 0.2;
      }
    }

    const fallbackSummary = extractFallbackSummary(sharedState);

    const success = requiredCount === 0 || resolvedRequired === requiredCount;
    const processingTimeMs = Date.now() - start;
    const tokensUsed = Math.max(72, Math.round(context.plan.metadata.estimatedTokens * 0.7));

    if (!success) {
      const missing = context.plan.steps
        .filter(step => step.isRequired && !(step.targetKey in parsed))
        .map(step => step.targetKey);

      const error: ParseError = {
        code: 'MISSING_REQUIRED_FIELDS',
        message: `Extractor could not resolve required fields: ${missing.join(', ')}`,
        stage: 'extractor',
        details: { missing }
      };

      diagnostics.push({
        field: '*',
        stage: 'extractor',
        message: error.message,
        severity: 'error'
      });

      const result: ExtractorResult = {
        success: false,
        parsedData: parsed,
        tokensUsed,
        processingTimeMs,
        confidence: clamp(aggregatedConfidence / Math.max(context.plan.steps.length, 1), 0, 1),
        diagnostics,
        error
      };

      if (fallbackSummary) {
        result.fallbackSummary = fallbackSummary;
      }

      return result;
    }

    const confidence = context.plan.steps.length
      ? clamp(aggregatedConfidence / context.plan.steps.length, 0, 1)
      : 0;

    this.logger.debug?.('parserator-core:extraction-finished', {
      resolvedRequired,
      requiredCount,
      confidence,
      success
    });

    const result: ExtractorResult = {
      success: true,
      parsedData: parsed,
      tokensUsed,
      processingTimeMs,
      confidence,
      diagnostics
    };

    if (fallbackSummary) {
      result.fallbackSummary = fallbackSummary;
    }

    return result;
  }
}

function computeStepConfidence(
  isRequired: boolean,
  resolverConfidence: number,
  value: unknown
): number {
  if (value === undefined) {
    return isRequired ? resolverConfidence : Math.max(resolverConfidence, 0.2);
  }

  const base = isRequired ? 0.7 : 0.5;
  return clamp(Math.max(resolverConfidence, base), 0, 1);
}

function extractFallbackSummary(
  shared: Map<string, unknown>
): ParserFallbackSummary | undefined {
  const usage = shared.get(LEAN_LLM_USAGE_KEY);
  if (
    !usage ||
    typeof usage !== 'object' ||
    !('fields' in (usage as Record<string, unknown>))
  ) {
    return undefined;
  }

  const summary = cloneLeanLLMFallbackSummary(usage as LeanLLMFallbackUsageSummary);
  return { leanLLM: summary };
}

function cloneLeanLLMFallbackSummary(
  summary: LeanLLMFallbackUsageSummary
): LeanLLMFallbackUsageSummary {
  return {
    ...summary,
    fields: summary.fields.map(field => ({ ...field }))
  };
}
