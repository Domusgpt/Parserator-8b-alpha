import { v4 as uuidv4 } from 'uuid';

import { AgenticKernel } from './kernel/agentic-kernel';
import { createDefaultKernel } from './presets/default-kernel';
import {
  AgenticParseJob,
  ParseInvocationOptions,
  ParseRequest,
  ParseResponse,
  ParseratorCoreOptions
} from './types';

export * from './types';
export * from './kernel/agentic-kernel';
export * from './modules/architect-module';
export * from './modules/extractor-module';

function normaliseInvocation(
  request: ParseRequest,
  invocation?: ParseInvocationOptions
): AgenticParseJob {
  const now = new Date();

  return {
    ...request,
    requestId: invocation?.requestId ?? uuidv4(),
    createdAt: now.toISOString(),
    invokedBy: invocation?.invokedBy ?? 'sdk',
    tenantId: invocation?.tenantId,
    metadata: {
      ...invocation?.metadata,
      requestedOptions: request.options
    }
  };
}

export class ParseratorCore {
  private kernel: AgenticKernel;
  private currentOptions: ParseratorCoreOptions;

  constructor(options: ParseratorCoreOptions) {
    this.currentOptions = options;
    this.kernel = createDefaultKernel(options);
  }

  /**
   * Rebuild the kernel with a new configuration without changing the API key.
   */
  reconfigure(config: ParseratorCoreOptions['config']): void {
    this.currentOptions = {
      ...this.currentOptions,
      config: {
        ...this.currentOptions.config,
        ...config
      }
    };
    this.kernel = createDefaultKernel(this.currentOptions);
  }

  /**
   * Execute the architect-extractor pipeline via the agentic kernel.
   */
  async parse(
    request: ParseRequest,
    invocation?: ParseInvocationOptions
  ): Promise<ParseResponse> {
    const job = normaliseInvocation(request, invocation);
    const summary = await this.kernel.run(job);
    return summary.response;
  }

  /**
   * Expose the underlying kernel for advanced composition or module injection.
   */
  getKernel(): AgenticKernel {
    return this.kernel;
  }
}
