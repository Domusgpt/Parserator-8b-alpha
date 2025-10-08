import { v4 as uuidv4 } from 'uuid';

import { HeuristicArchitect } from './architect';
import { RegexExtractor } from './extractor';
import { createDefaultLogger } from './logger';
import { createDefaultResolvers, ResolverRegistry } from './resolvers';
import { ParseratorSession } from './session';
import {
  ArchitectAgent,
  CoreLogger,
  ExtractorAgent,
  ParseLifecycleEvent,
  ParseObserver,
  ParseRequest,
  ParseResponse,
  ParseratorCoreConfig,
  ParseratorCoreOptions
} from './types';

export * from './types';
export {
  HeuristicArchitect,
  RegexExtractor,
  ResolverRegistry,
  createDefaultResolvers,
  ParseratorSession
};

const DEFAULT_CONFIG: ParseratorCoreConfig = {
  maxInputLength: 120_000,
  maxSchemaFields: 64,
  minConfidence: 0.55,
  defaultStrategy: 'sequential',
  enableFieldFallbacks: true
};

const DEFAULT_LOGGER: CoreLogger = createDefaultLogger();

export class ParseratorCore {
  private readonly apiKey: string;
  private config: ParseratorCoreConfig;
  private logger: CoreLogger;
  private architect: ArchitectAgent;
  private extractor: ExtractorAgent;
  private resolverRegistry: ResolverRegistry;
  private observers: Set<ParseObserver>;

  constructor(options: ParseratorCoreOptions) {
    if (!options?.apiKey || options.apiKey.trim().length === 0) {
      throw new Error('ParseratorCore requires a non-empty apiKey');
    }

    this.apiKey = options.apiKey;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.logger = options.logger ?? DEFAULT_LOGGER;

    const initialResolvers = options.resolvers ?? createDefaultResolvers(this.logger);
    this.resolverRegistry = new ResolverRegistry(initialResolvers, this.logger);

    this.architect = options.architect ?? new HeuristicArchitect(this.logger);

    const extractor = options.extractor ?? new RegexExtractor(this.logger, this.resolverRegistry);
    this.attachRegistryIfSupported(extractor);
    this.extractor = extractor;

    this.observers = new Set(options.observers ?? []);
  }

  updateConfig(partial: Partial<ParseratorCoreConfig>): void {
    this.config = { ...this.config, ...partial };
    this.logger.info?.('parserator-core:config-updated', { config: this.config });
  }

  getConfig(): ParseratorCoreConfig {
    return { ...this.config };
  }

  setArchitect(agent: ArchitectAgent): void {
    this.architect = agent;
  }

  setExtractor(agent: ExtractorAgent): void {
    this.attachRegistryIfSupported(agent);
    this.extractor = agent;
  }

  registerResolver(resolver: Parameters<ResolverRegistry['register']>[0], position: 'append' | 'prepend' = 'append'): void {
    this.resolverRegistry.register(resolver, position);
    this.logger.info?.('parserator-core:resolver-registered', {
      resolver: resolver.name,
      position
    });
  }

  replaceResolvers(resolvers: Parameters<ResolverRegistry['register']>[0][]): void {
    this.resolverRegistry.replaceAll(resolvers);
    this.logger.info?.('parserator-core:resolvers-replaced', {
      resolvers: resolvers.map(resolver => resolver.name)
    });
  }

  listResolvers(): string[] {
    return this.resolverRegistry.listResolvers();
  }

  async parse(request: ParseRequest): Promise<ParseResponse> {
    const session = this.createSession(request);
    return session.run();
  }

  createSession(request: ParseRequest, sessionId?: string): ParseratorSession {
    const session = new ParseratorSession({
      requestId: sessionId ?? uuidv4(),
      request,
      config: { ...this.config },
      architect: this.architect,
      extractor: this.extractor,
      logger: this.logger,
      notify: event => this.dispatch(event)
    });

    return session;
  }

  addObserver(observer: ParseObserver): () => void {
    this.observers.add(observer);
    return () => this.removeObserver(observer);
  }

  removeObserver(observer: ParseObserver): void {
    this.observers.delete(observer);
  }

  clearObservers(): void {
    this.observers.clear();
  }

  getObservers(): ParseObserver[] {
    return Array.from(this.observers);
  }

  private attachRegistryIfSupported(agent: ExtractorAgent): void {
    if (typeof (agent as any)?.attachRegistry === 'function') {
      (agent as any).attachRegistry(this.resolverRegistry);
    }
  }

  private async dispatch(event: ParseLifecycleEvent): Promise<void> {
    for (const observer of this.observers) {
      try {
        await observer(event);
      } catch (error) {
        this.logger.warn?.('parserator-core:observer-error', {
          event: event.type,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}
