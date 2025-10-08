import { AgenticKernel } from '../kernel/agentic-kernel';
import { DefaultArchitectModule } from '../modules/architect-module';
import { DefaultExtractorModule } from '../modules/extractor-module';
import { ParseratorCoreOptions } from '../types';

export function createDefaultKernel(options: ParseratorCoreOptions): AgenticKernel {
  const kernel = new AgenticKernel(options.config, options.logger ?? console);
  kernel.registerModule(new DefaultArchitectModule());
  kernel.registerModule(new DefaultExtractorModule());
  return kernel;
}
