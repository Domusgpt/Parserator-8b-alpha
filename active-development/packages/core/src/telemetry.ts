import {
  CoreLogger,
  ParseratorTelemetry,
  ParseratorTelemetryEvent,
  ParseratorTelemetryListener
} from './types';

class NoopTelemetry implements ParseratorTelemetry {
  emit(): void {
    // noop
  }

  register(): void {
    // noop
  }

  unregister(): void {
    // noop
  }

  listeners(): ParseratorTelemetryListener[] {
    return [];
  }
}

export class TelemetryHub implements ParseratorTelemetry {
  private readonly listenersSet = new Set<ParseratorTelemetryListener>();

  constructor(
    listeners: ParseratorTelemetryListener[] = [],
    private readonly logger?: CoreLogger
  ) {
    listeners.forEach(listener => this.listenersSet.add(listener));
  }

  emit(event: ParseratorTelemetryEvent): void {
    if (this.listenersSet.size === 0) {
      return;
    }

    for (const listener of this.listenersSet) {
      try {
        const result = listener(event);
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(error => {
            this.logger?.warn?.('parserator-core:telemetry-listener-error', {
              error: error instanceof Error ? error.message : error,
              event
            });
          });
        }
      } catch (error) {
        this.logger?.warn?.('parserator-core:telemetry-listener-error', {
          error: error instanceof Error ? error.message : error,
          event
        });
      }
    }
  }

  register(listener: ParseratorTelemetryListener): void {
    this.listenersSet.add(listener);
  }

  unregister(listener: ParseratorTelemetryListener): void {
    this.listenersSet.delete(listener);
  }

  listeners(): ParseratorTelemetryListener[] {
    return Array.from(this.listenersSet);
  }
}

export function createTelemetryHub(
  input: ParseratorTelemetry | ParseratorTelemetryListener | ParseratorTelemetryListener[] | undefined,
  logger?: CoreLogger
): ParseratorTelemetry {
  if (!input) {
    return new NoopTelemetry();
  }

  if (typeof (input as ParseratorTelemetry)?.emit === 'function') {
    return input as ParseratorTelemetry;
  }

  const listeners = Array.isArray(input) ? input : [input];
  return new TelemetryHub(listeners as ParseratorTelemetryListener[], logger);
}
