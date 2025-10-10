import {
  CoreLogger,
  ExtractorAgent,
  ExtractorContext,
  ExtractorResult,
  ParseDiagnostic,
  ParseError,
  ParseratorFallbackUsage
} from './types';
import {
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

    for (const step of context.plan.steps) {
      if (step.isRequired) {
        requiredCount += 1;
      }

      const resolution = await this.registry.resolve({
        inputData: context.inputData,
        step,
        config: context.config,
        logger: this.logger,
        shared: sharedState
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

    const success = requiredCount === 0 || resolvedRequired === requiredCount;
    const processingTimeMs = Date.now() - start;
    const fallbackUsage = buildLeanLLMUsage(sharedState);
    const fallbackTokens = fallbackUsage?.tokensUsed ?? 0;
    const baseTokens = Math.max(72, Math.round(context.plan.metadata.estimatedTokens * 0.7));
    const tokensUsed = baseTokens + fallbackTokens;

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

      return {
        success: false,
        parsedData: parsed,
        tokensUsed,
        processingTimeMs,
        confidence: clamp(aggregatedConfidence / Math.max(context.plan.steps.length, 1), 0, 1),
        diagnostics,
        error,
        fallbackUsage
      };
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

    return {
      success: true,
      parsedData: parsed,
      tokensUsed,
      processingTimeMs,
      confidence,
      diagnostics,
      fallbackUsage
    };
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

function buildLeanLLMUsage(shared: Map<string, unknown>): ParseratorFallbackUsage | undefined {
  const state = shared.get(LEAN_LLM_USAGE_KEY) as
    | {
        fields: Set<string>;
        resolvers: Set<string>;
        tokensUsed: number;
        calls: number;
        successful: number;
      }
    | undefined;

  if (!state) {
    return undefined;
  }

  const fields = Array.from(state.fields ?? []).sort();
  const resolvers = Array.from(state.resolvers ?? []).sort();
  const hasMeaningfulData =
    state.calls > 0 || state.tokensUsed > 0 || state.successful > 0 || fields.length > 0;

  if (!hasMeaningfulData) {
    return undefined;
  }

  return {
    calls: state.calls,
    successfulCalls: state.successful,
    tokensUsed: state.tokensUsed,
    fields,
    resolvers
  };
}
