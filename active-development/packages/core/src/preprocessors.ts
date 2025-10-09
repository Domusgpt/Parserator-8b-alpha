import {
  CoreLogger,
  ParseDiagnostic,
  ParseRequest,
  ParseratorPreprocessContext,
  ParseratorPreprocessResult,
  ParseratorPreprocessor,
  ParseratorPreprocessExecutionResult
} from './types';

const WARNING_CONFIDENCE = 0.75;

function normaliseRequestMerge(base: ParseRequest, patch: Partial<ParseRequest>): ParseRequest {
  const merged: ParseRequest = {
    ...base,
    ...patch
  };

  if (patch.outputSchema) {
    merged.outputSchema = { ...patch.outputSchema };
  } else {
    merged.outputSchema = { ...base.outputSchema };
  }

  if (base.options || patch.options) {
    merged.options = {
      ...(base.options ?? {}),
      ...(patch.options ?? {})
    };
  }

  return merged;
}

export async function executePreprocessors(
  preprocessors: ParseratorPreprocessor[],
  context: Omit<ParseratorPreprocessContext, 'shared'> & { shared?: Map<string, unknown> }
): Promise<ParseratorPreprocessExecutionResult> {
  if (!preprocessors.length) {
    return {
      request: { ...context.request, outputSchema: { ...context.request.outputSchema } },
      diagnostics: [],
      metrics: { timeMs: 0, tokens: 0, confidence: 1, runs: 0 }
    };
  }

  const shared = context.shared ?? new Map<string, unknown>();
  let currentRequest: ParseRequest = {
    ...context.request,
    outputSchema: { ...context.request.outputSchema },
    options: context.request.options ? { ...context.request.options } : undefined
  };
  const diagnostics: ParseDiagnostic[] = [];
  let totalTime = 0;
  let runs = 0;

  for (const preprocessor of preprocessors) {
    const started = Date.now();
    runs += 1;
    try {
      const result = await preprocessor.run({
        request: currentRequest,
        config: context.config,
        profile: context.profile,
        logger: context.logger,
        shared
      });

      if (result?.diagnostics?.length) {
        diagnostics.push(
          ...result.diagnostics.map(diagnostic => ({
            ...diagnostic,
            stage: diagnostic.stage ?? 'preprocess'
          }))
        );
      }

      if (result?.request) {
        currentRequest = normaliseRequestMerge(currentRequest, result.request);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.warn?.('parserator-core:preprocessor-error', {
        preprocessor: preprocessor.name,
        error: message
      });
      diagnostics.push({
        field: '*',
        stage: 'preprocess',
        message: `${preprocessor.name} preprocessor failed: ${message}`,
        severity: 'warning'
      });
    } finally {
      totalTime += Date.now() - started;
    }
  }

  let confidence = 1;
  if (diagnostics.some(diag => diag.severity === 'error')) {
    confidence = 0;
  } else if (diagnostics.some(diag => diag.severity === 'warning')) {
    confidence = WARNING_CONFIDENCE;
  }

  return {
    request: currentRequest,
    diagnostics,
    metrics: { timeMs: totalTime, tokens: 0, confidence, runs }
  };
}

function createDiagnostic(
  message: string,
  severity: ParseDiagnostic['severity'] = 'info'
): ParseDiagnostic {
  return {
    field: '*',
    stage: 'preprocess',
    message,
    severity
  };
}

export function createDefaultPreprocessors(logger: CoreLogger): ParseratorPreprocessor[] {
  const preprocessors: ParseratorPreprocessor[] = [];

  preprocessors.push({
    name: 'trim-input',
    run: ({ request }): ParseratorPreprocessResult | undefined => {
      if (typeof request.inputData !== 'string') {
        return;
      }

      const trimmed = request.inputData.trim();
      if (trimmed === request.inputData) {
        return;
      }

      logger.debug?.('parserator-core:preprocessor-trim-input', {
        before: request.inputData.length,
        after: trimmed.length
      });

      return {
        request: {
          inputData: trimmed
        },
        diagnostics: [
          createDiagnostic('Input trimmed for leading/trailing whitespace normalization.')
        ]
      };
    }
  });

  preprocessors.push({
    name: 'normalize-line-endings',
    run: ({ request }): ParseratorPreprocessResult | undefined => {
      if (typeof request.inputData !== 'string') {
        return;
      }

      const normalized = request.inputData.replace(/\r\n?/g, '\n');
      if (normalized === request.inputData) {
        return;
      }

      return {
        request: {
          inputData: normalized
        },
        diagnostics: [
          createDiagnostic('Normalized line endings to Unix style for consistent parsing.')
        ]
      };
    }
  });

  preprocessors.push({
    name: 'schema-key-normalizer',
    run: ({ request, config }): ParseratorPreprocessResult | undefined => {
      const keys = Object.keys(request.outputSchema ?? {});
      const trimmedKeys = keys.map(key => key.trim());

      if (keys.every((key, index) => key === trimmedKeys[index])) {
        return;
      }

      if (trimmedKeys.length > config.maxSchemaFields) {
        return {
          diagnostics: [
            createDiagnostic(
              'Schema key normalization skipped due to schema exceeding max field threshold.',
              'warning'
            )
          ]
        };
      }

      const normalizedSchema = trimmedKeys.reduce<Record<string, unknown>>((acc, key, index) => {
        acc[key] = (request.outputSchema as Record<string, unknown>)[keys[index]];
        return acc;
      }, {});

      return {
        request: {
          outputSchema: normalizedSchema
        },
        diagnostics: [
          createDiagnostic('Output schema keys normalized for consistent downstream access.')
        ]
      };
    }
  });

  return preprocessors;
}
