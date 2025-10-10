import { v4 as uuidv4 } from 'uuid';

import {
  CoreLogger,
  ParseratorTelemetry,
  ParseratorTelemetryEvent,
  ParseratorTelemetryListener,
  ParseratorPlanCacheEvent,
  ParseratorTelemetrySource
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

export interface PlanCacheTelemetryEventInput {
  action: ParseratorPlanCacheEvent['action'];
  key?: string;
  scope?: string;
  planId?: string;
  confidence?: number;
  tokensUsed?: number;
  processingTimeMs?: number;
  reason?: string;
  requestId?: string;
  error?: unknown;
}

export interface PlanCacheTelemetryEmitterOptions {
  telemetry: ParseratorTelemetry;
  source: ParseratorTelemetrySource;
  resolveProfile?: () => string | undefined;
  resolveSessionId?: () => string | undefined;
  resolveKey?: () => string | undefined;
  resolvePlanId?: () => string | undefined;
  requestIdFactory?: () => string;
  logger?: CoreLogger;
}

export type PlanCacheTelemetryEmitter = (event: PlanCacheTelemetryEventInput) => void;

export function createPlanCacheTelemetryEmitter(
  options: PlanCacheTelemetryEmitterOptions
): PlanCacheTelemetryEmitter {
  const requestIdFactory = options.requestIdFactory ?? uuidv4;

  const safeResolve = <T>(
    resolver: (() => T | undefined) | undefined,
    label: 'profile' | 'sessionId' | 'key' | 'planId'
  ): T | undefined => {
    if (!resolver) {
      return undefined;
    }

    try {
      return resolver();
    } catch (error) {
      options.logger?.warn?.('parserator-core:plan-cache-telemetry-resolve-failed', {
        error: error instanceof Error ? error.message : error,
        source: options.source,
        field: label
      });
      return undefined;
    }
  };

  const normaliseError = (error: unknown): string | undefined => {
    if (error === undefined || error === null) {
      return undefined;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  };

  return event => {
    const requestId = event.requestId ?? requestIdFactory();

    options.telemetry.emit({
      type: 'plan:cache',
      source: options.source,
      requestId,
      timestamp: new Date().toISOString(),
      profile: safeResolve(options.resolveProfile, 'profile'),
      sessionId: safeResolve(options.resolveSessionId, 'sessionId'),
      action: event.action,
      key: event.key ?? safeResolve(options.resolveKey, 'key'),
      scope: event.scope,
      planId: event.planId ?? safeResolve(options.resolvePlanId, 'planId'),
      confidence: event.confidence,
      tokensUsed: event.tokensUsed,
      processingTimeMs: event.processingTimeMs,
      reason: event.reason,
      error: normaliseError(event.error)
    });
  };
}
