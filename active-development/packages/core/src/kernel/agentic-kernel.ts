import {
  AgenticParseJob,
  ExecutorPayload,
  KernelConfig,
  KernelError,
  KernelEvent,
  KernelModule,
  KernelModuleResult,
  KernelRunSummary,
  KernelRuntimeContext,
  PlannerPayload,
  SearchPlan
} from '../types';

const DEFAULT_CONFIG: KernelConfig = {
  maxInputBytes: 200_000,
  maxSchemaFields: 64,
  minConfidence: 0.6,
  defaultStrategy: 'adaptive',
  environment: 'cloud',
  experimentalFeatures: {
    adaptiveSampling: true,
    localFallbacks: false
  }
};

const DEFAULT_LOGGER: Pick<Console, 'debug' | 'info' | 'warn' | 'error'> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

function resolveConfig(partial?: Partial<KernelConfig>): KernelConfig {
  if (!partial) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    ...DEFAULT_CONFIG,
    ...partial,
    experimentalFeatures: {
      ...DEFAULT_CONFIG.experimentalFeatures,
      ...(partial.experimentalFeatures ?? {})
    }
  };
}

function byteLength(input: string): number {
  return Buffer.byteLength(input, 'utf8');
}

function emit(config: KernelConfig, event: KernelEvent) {
  config.instrumentation?.emit(event);
}

export class AgenticKernel {
  private readonly config: KernelConfig;
  private readonly logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  private modules: KernelModule[] = [];

  constructor(
    config?: Partial<KernelConfig>,
    logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'> = DEFAULT_LOGGER
  ) {
    this.config = resolveConfig(config);
    this.logger = logger;
  }

  registerModule(module: KernelModule): void {
    this.modules = [...this.modules, module];
    this.logger.debug?.('agentic-kernel:module-registered', {
      module: module.name,
      kind: module.kind
    });
  }

  clearModules(): void {
    this.modules = [];
  }

  async run(job: AgenticParseJob): Promise<KernelRunSummary> {
    const start = Date.now();
    const runtime = this.createRuntime(job.requestId);

    emit(this.config, {
      type: 'kernel:start',
      timestamp: new Date(start).toISOString(),
      requestId: job.requestId,
      metadata: { invokedBy: job.invokedBy }
    });

    try {
      this.validate(job);

      const planner = this.resolvePlanner(job);
      const executor = this.resolveExecutor(job);

      await planner.warmup?.(runtime);
      await executor.warmup?.(runtime);

      const plannerResult = await this.invokePlanner(planner, runtime, job);
      if (!plannerResult.success || !plannerResult.output) {
        const summary = this.composeFailure(
          job,
          start,
          plannerResult,
          this.createEmptyPlan(job),
          'planner'
        );
        await planner.dispose?.(runtime);
        await executor.dispose?.(runtime);
        return summary;
      }

      const effectivePlan = plannerResult.output;
      const executorPayload: ExecutorPayload = { job, plan: effectivePlan };

      const executorResult = await this.invokeExecutor(
        executor,
        runtime,
        executorPayload
      );

      if (!executorResult.success || !executorResult.output) {
        const summary = this.composeFailure(
          job,
          start,
          executorResult,
          effectivePlan,
          'executor',
          plannerResult
        );
        await planner.dispose?.(runtime);
        await executor.dispose?.(runtime);
        return summary;
      }

      const response = this.composeSuccess(
        job,
        start,
        effectivePlan,
        plannerResult,
        executorResult
      );

      await planner.dispose?.(runtime);
      await executor.dispose?.(runtime);

      emit(this.config, {
        type: 'kernel:finish',
        timestamp: new Date().toISOString(),
        requestId: job.requestId,
        metadata: { success: response.success }
      });

      return {
        response,
        plannerResult,
        executorResult
      };
    } catch (error) {
      const kernelError: KernelError = {
        code: 'kernel/orchestration-error',
        message: error instanceof Error ? error.message : 'Unknown kernel error',
        stage: 'orchestrator'
      };

      this.logger.error?.('agentic-kernel:error', kernelError);

      emit(this.config, {
        type: 'kernel:error',
        timestamp: new Date().toISOString(),
        requestId: job.requestId,
        metadata: { error: kernelError }
      });

      const fallbackPlan = this.createEmptyPlan(job);
      const diagnostics = [
        {
          stage: 'orchestrator' as const,
          message: kernelError.message,
          severity: 'error' as const
        }
      ];

      return {
        response: {
          success: false,
          parsedData: {},
          metadata: {
            architectPlan: fallbackPlan,
            confidence: 0,
            tokensUsed: 0,
            processingTimeMs: Date.now() - start,
            requestId: job.requestId,
            timestamp: new Date().toISOString(),
            diagnostics
          },
          error: kernelError
        },
        plannerResult: {
          success: false,
          error: kernelError
        },
        executorResult: {
          success: false,
          error: kernelError
        }
      };
    }
  }

  private createRuntime(requestId: string): KernelRuntimeContext {
    return {
      requestId,
      clock: () => Date.now(),
      config: this.config,
      logger: this.logger
    };
  }

  private validate(job: AgenticParseJob): void {
    const inputBytes = byteLength(job.inputData);
    if (inputBytes > this.config.maxInputBytes) {
      throw new Error(
        `Input payload is ${inputBytes} bytes which exceeds the configured limit of ${this.config.maxInputBytes} bytes`
      );
    }

    const schemaFieldCount = Object.keys(job.outputSchema).length;
    if (schemaFieldCount > this.config.maxSchemaFields) {
      throw new Error(
        `Schema requests ${schemaFieldCount} fields which exceeds the configured limit of ${this.config.maxSchemaFields} fields`
      );
    }
  }

  private resolvePlanner(job: AgenticParseJob) {
    const planner = this.modules.find(
      (module): module is KernelModule<PlannerPayload, SearchPlan> =>
        module.kind === 'planner' && module.supports(job)
    );

    if (!planner) {
      throw new Error('No planner module registered for the requested job type');
    }

    return planner;
  }

  private resolveExecutor(job: AgenticParseJob) {
    const executor = this.modules.find(
      (module): module is KernelModule<ExecutorPayload, Record<string, unknown>> =>
        module.kind === 'executor' && module.supports(job)
    );

    if (!executor) {
      throw new Error('No executor module registered for the requested job type');
    }

    return executor;
  }

  private async invokePlanner(
    planner: KernelModule<PlannerPayload, SearchPlan>,
    runtime: KernelRuntimeContext,
    payload: PlannerPayload
  ): Promise<KernelModuleResult<SearchPlan>> {
    emit(this.config, {
      type: 'planner:start',
      timestamp: new Date().toISOString(),
      requestId: runtime.requestId,
      metadata: { module: planner.name }
    });

    const result = await planner.execute(runtime, payload);

    emit(this.config, {
      type: 'planner:finish',
      timestamp: new Date().toISOString(),
      requestId: runtime.requestId,
      metadata: { module: planner.name, success: result.success }
    });

    return result;
  }

  private async invokeExecutor(
    executor: KernelModule<ExecutorPayload, Record<string, unknown>>,
    runtime: KernelRuntimeContext,
    payload: ExecutorPayload
  ): Promise<KernelModuleResult<Record<string, unknown>>> {
    emit(this.config, {
      type: 'executor:start',
      timestamp: new Date().toISOString(),
      requestId: runtime.requestId,
      metadata: { module: executor.name }
    });

    const result = await executor.execute(runtime, payload);

    emit(this.config, {
      type: 'executor:finish',
      timestamp: new Date().toISOString(),
      requestId: runtime.requestId,
      metadata: { module: executor.name, success: result.success }
    });

    return result;
  }

  private composeSuccess(
    job: AgenticParseJob,
    start: number,
    plan: SearchPlan,
    plannerResult: KernelModuleResult<SearchPlan>,
    executorResult: KernelModuleResult<Record<string, unknown>>
  ) {
    const diagnostics = [
      ...(plannerResult.diagnostics ?? []),
      ...(executorResult.diagnostics ?? [])
    ];

    const confidence = (executorResult.metadata?.confidence as number | undefined) ??
      (plannerResult.metadata?.confidence as number | undefined) ??
      this.config.minConfidence;

    return {
      success: true,
      parsedData: executorResult.output ?? {},
      metadata: {
        architectPlan: plan,
        confidence,
        tokensUsed: (plannerResult.tokensUsed ?? 0) + (executorResult.tokensUsed ?? 0),
        processingTimeMs: Date.now() - start,
        requestId: job.requestId,
        timestamp: new Date().toISOString(),
        diagnostics
      }
    };
  }

  private composeFailure(
    job: AgenticParseJob,
    start: number,
    failingStageResult: KernelModuleResult<unknown>,
    plan: SearchPlan,
    stage: KernelError['stage'],
    plannerResult?: KernelModuleResult<SearchPlan>
  ): KernelRunSummary {
    const kernelError: KernelError =
      failingStageResult.error ?? {
        code: `${stage}/unknown-error`,
        message: 'Kernel stage failed without providing an error payload',
        stage
      };

    const diagnostics = [
      ...(plannerResult?.diagnostics ?? []),
      ...(failingStageResult.diagnostics ?? []),
      {
        stage,
        message: kernelError.message,
        severity: 'error' as const,
        details: kernelError.details
      }
    ];

    return {
      response: {
        success: false,
        parsedData: failingStageResult.output as Record<string, unknown> | undefined ?? {},
        metadata: {
          architectPlan: plan,
          confidence: 0,
          tokensUsed: (plannerResult?.tokensUsed ?? 0) + (failingStageResult.tokensUsed ?? 0),
          processingTimeMs: Date.now() - start,
          requestId: job.requestId,
          timestamp: new Date().toISOString(),
          diagnostics
        },
        error: kernelError
      },
      plannerResult: plannerResult ?? {
        success: stage !== 'planner',
        output: stage === 'planner' ? undefined : plan
      },
      executorResult:
        stage === 'executor'
          ? (failingStageResult as KernelModuleResult<Record<string, unknown>>)
          : { success: false, error: kernelError }
    };
  }

  private createEmptyPlan(job: AgenticParseJob): SearchPlan {
    return {
      id: `${job.requestId}-plan`,
      version: '0.0.0',
      steps: [],
      strategy: this.config.defaultStrategy,
      confidenceThreshold: this.config.minConfidence,
      metadata: {
        detectedFormat: 'unknown',
        complexity: 'low',
        estimatedTokens: 0,
        origin: 'manual'
      }
    };
  }
}
