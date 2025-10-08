import {
  ExecutorPayload,
  KernelDiagnostic,
  KernelModule,
  KernelModuleResult,
  KernelRuntimeContext
} from '../types';

function safeParse(input: string): Record<string, unknown> | null {
  try {
    const candidate = JSON.parse(input);
    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function lookupValue(
  source: Record<string, unknown>,
  key: string
): unknown {
  if (key in source) {
    return source[key];
  }

  const normalisedKey = key.toLowerCase();
  for (const [candidateKey, value] of Object.entries(source)) {
    if (candidateKey.toLowerCase() === normalisedKey) {
      return value;
    }
  }

  return undefined;
}

function extractFromText(text: string, key: string): string | undefined {
  const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`${escapedKey}[:\-\s]+([^\n\r]+)`, 'i');
  const match = regex.exec(text);
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

function buildDiagnostics(payload: ExecutorPayload, confidence: number): KernelDiagnostic[] {
  return [
    {
      stage: 'executor',
      severity: confidence >= 0.75 ? 'info' : 'warning',
      message: 'Extractor module executed heuristic data capture',
      details: {
        planSteps: payload.plan.steps.length,
        estimatedConfidence: confidence
      }
    }
  ];
}

export class DefaultExtractorModule
  implements KernelModule<ExecutorPayload, Record<string, unknown>>
{
  readonly name = 'executor/default-extractor';
  readonly kind = 'executor' as const;

  supports(): boolean {
    return true;
  }

  async execute(
    _context: KernelRuntimeContext,
    payload: ExecutorPayload
  ): Promise<KernelModuleResult<Record<string, unknown>>> {
    const jsonCandidate = safeParse(payload.job.inputData);
    const output: Record<string, unknown> = {};
    let hits = 0;

    for (const step of payload.plan.steps) {
      let value: unknown;

      if (jsonCandidate) {
        value = lookupValue(jsonCandidate, step.targetKey);
      }

      if (value === undefined) {
        value = extractFromText(payload.job.inputData, step.targetKey);
      }

      if (value !== undefined) {
        output[step.targetKey] = value;
        hits += 1;
      }
    }

    const completionRatio = payload.plan.steps.length
      ? hits / payload.plan.steps.length
      : 1;
    const confidence = Math.min(0.98, 0.55 + completionRatio * 0.35);

    return {
      success: true,
      output,
      metadata: {
        confidence,
        completionRatio
      },
      diagnostics: buildDiagnostics(payload, confidence),
      tokensUsed: Math.round(payload.job.inputData.length / 4)
    };
  }
}
