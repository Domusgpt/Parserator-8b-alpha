import {
  CoreLogger,
  ParseDiagnostic,
  ParseMetadata,
  ParseratorPostprocessContext,
  ParseratorPostprocessExecutionResult,
  ParseratorPostprocessor,
  ParseratorPostprocessResult,
  StageMetrics
} from './types';
import { clonePlan } from './utils';

const WARNING_CONFIDENCE = 0.75;

function cloneMetadata(metadata: ParseMetadata): ParseMetadata {
  const stageBreakdown: ParseMetadata['stageBreakdown'] = { ...metadata.stageBreakdown };
  if (stageBreakdown.preprocess) {
    stageBreakdown.preprocess = { ...stageBreakdown.preprocess };
  }
  if (stageBreakdown.architect) {
    stageBreakdown.architect = { ...stageBreakdown.architect };
  }
  if (stageBreakdown.extractor) {
    stageBreakdown.extractor = { ...stageBreakdown.extractor };
  }
  if (stageBreakdown.postprocess) {
    stageBreakdown.postprocess = { ...stageBreakdown.postprocess };
  }

  return {
    ...metadata,
    architectPlan: clonePlan(metadata.architectPlan, metadata.architectPlan.metadata.origin),
    diagnostics: [...metadata.diagnostics],
    stageBreakdown
  };
}

function mergeStageBreakdown(
  base: ParseMetadata['stageBreakdown'],
  patch?: Partial<ParseMetadata['stageBreakdown']>
): ParseMetadata['stageBreakdown'] {
  if (!patch) {
    return base;
  }

  const merged: ParseMetadata['stageBreakdown'] = { ...base };
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    const metrics = patch[key];
    if (!metrics) {
      continue;
    }

    const existing = merged[key];
    const mergedMetrics: StageMetrics = {
      ...(existing ? { ...existing } : {}),
      ...metrics
    };
    merged[key] = mergedMetrics;
  }

  return merged;
}

function mergeMetadata(base: ParseMetadata, patch: Partial<ParseMetadata>): ParseMetadata {
  let architectPlan = base.architectPlan;
  if (patch.architectPlan) {
    architectPlan = clonePlan(patch.architectPlan, patch.architectPlan.metadata.origin);
  }

  const diagnostics = patch.diagnostics
    ? [...base.diagnostics, ...patch.diagnostics]
    : base.diagnostics;

  const merged: ParseMetadata = {
    ...base,
    ...patch,
    architectPlan,
    diagnostics,
    stageBreakdown: mergeStageBreakdown(base.stageBreakdown, patch.stageBreakdown)
  };

  return merged;
}

function createDiagnostic(
  message: string,
  severity: ParseDiagnostic['severity'] = 'info'
): ParseDiagnostic {
  return {
    field: '*',
    stage: 'postprocess',
    message,
    severity
  };
}

export async function executePostprocessors(
  postprocessors: ParseratorPostprocessor[],
  context: Omit<ParseratorPostprocessContext, 'shared'> & { shared?: Map<string, unknown> }
): Promise<ParseratorPostprocessExecutionResult> {
  if (!postprocessors.length) {
    return {
      parsedData: { ...context.parsedData },
      metadata: cloneMetadata(context.metadata),
      diagnostics: [],
      metrics: { timeMs: 0, tokens: 0, confidence: 1, runs: 0 }
    };
  }

  const shared = context.shared ?? new Map<string, unknown>();
  let parsedData: Record<string, unknown> = { ...context.parsedData };
  let metadata: ParseMetadata = cloneMetadata(context.metadata);
  const diagnostics: ParseDiagnostic[] = [];
  let totalTime = 0;
  let runs = 0;

  for (const postprocessor of postprocessors) {
    const started = Date.now();
    runs += 1;
    try {
      const result = await postprocessor.run({
        request: context.request,
        parsedData,
        metadata,
        config: context.config,
        profile: context.profile,
        logger: context.logger,
        shared
      });

      if (result?.parsedData) {
        parsedData = { ...parsedData, ...result.parsedData };
      }

      if (result?.metadata) {
        metadata = mergeMetadata(metadata, result.metadata);
      }

      if (result?.diagnostics?.length) {
        diagnostics.push(
          ...result.diagnostics.map(diagnostic => ({
            ...diagnostic,
            stage: diagnostic.stage ?? 'postprocess'
          }))
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.warn?.('parserator-core:postprocessor-error', {
        postprocessor: postprocessor.name,
        error: message
      });
      diagnostics.push(
        createDiagnostic(`${postprocessor.name} postprocessor failed: ${message}`, 'error')
      );
    } finally {
      totalTime += Date.now() - started;
    }
  }

  if (diagnostics.length) {
    metadata = {
      ...metadata,
      diagnostics: [...metadata.diagnostics, ...diagnostics]
    };
  }

  let confidenceFloor = 1;
  if (diagnostics.some(diag => diag.severity === 'error')) {
    confidenceFloor = 0;
  } else if (diagnostics.some(diag => diag.severity === 'warning')) {
    confidenceFloor = WARNING_CONFIDENCE;
  }

  metadata = {
    ...metadata,
    confidence: Math.min(metadata.confidence, confidenceFloor)
  };

  return {
    parsedData,
    metadata,
    diagnostics,
    metrics: { timeMs: totalTime, tokens: 0, confidence: confidenceFloor, runs }
  };
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function pruneEmptyValues(data: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      output[key] = trimmed;
      continue;
    }

    if (Array.isArray(value)) {
      const pruned = value.filter(item => item !== null && item !== undefined && item !== '');
      if (pruned.length === 0) {
        continue;
      }
      output[key] = pruned;
      continue;
    }

    output[key] = value;
  }
  return output;
}

function normaliseNullTokens(value: string): string | null {
  const tokens = ['n/a', 'na', 'none', 'null', 'not applicable'];
  const trimmed = value.trim().toLowerCase();
  return tokens.includes(trimmed) ? null : value;
}

export function createDefaultPostprocessors(logger: CoreLogger): ParseratorPostprocessor[] {
  const postprocessors: ParseratorPostprocessor[] = [];

  postprocessors.push({
    name: 'trimmed-output',
    run: ({ parsedData }): ParseratorPostprocessResult | void => {
      const entries = Object.entries(parsedData);
      const updates: Record<string, unknown> = {};
      let changed = false;

      for (const [key, value] of entries) {
        if (typeof value !== 'string') {
          continue;
        }
        const normalised = normaliseWhitespace(value);
        if (normalised !== value) {
          updates[key] = normalised;
          changed = true;
        }
      }

      if (!changed) {
        return;
      }

      logger.debug?.('parserator-core:postprocessor-trimmed-output', {
        fields: Object.keys(updates)
      });

      return {
        parsedData: updates,
        diagnostics: [
          createDiagnostic('Normalized whitespace across extracted string fields for consistency.')
        ]
      };
    }
  });

  postprocessors.push({
    name: 'empty-value-pruner',
    run: ({ parsedData }): ParseratorPostprocessResult | void => {
      const pruned = pruneEmptyValues(parsedData);
      if (Object.keys(pruned).length === Object.keys(parsedData).length) {
        return;
      }

      const removed = Object.keys(parsedData).filter(key => !(key in pruned));
      return {
        parsedData: pruned,
        diagnostics: [
          createDiagnostic(
            `Removed ${removed.length} empty output fields for cleaner downstream payloads.`,
            'info'
          )
        ]
      };
    }
  });

  postprocessors.push({
    name: 'null-token-normaliser',
    run: ({ parsedData }): ParseratorPostprocessResult | void => {
      const updates: Record<string, unknown> = {};
      let changed = false;
      for (const [key, value] of Object.entries(parsedData)) {
        if (typeof value !== 'string') {
          continue;
        }
        const normalised = normaliseNullTokens(value);
        if (normalised === null) {
          updates[key] = null;
          changed = true;
        }
      }

      if (!changed) {
        return;
      }

      logger.debug?.('parserator-core:postprocessor-null-token-normalised', {
        fields: Object.keys(updates)
      });

      return {
        parsedData: updates,
        diagnostics: [
          createDiagnostic('Converted textual null tokens into null values for downstream agents.')
        ]
      };
    }
  });

  return postprocessors;
}
