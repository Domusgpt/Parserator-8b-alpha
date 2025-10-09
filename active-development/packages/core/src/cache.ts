import {
  ParseratorPlanCache,
  ParseratorPlanCacheEntry,
  ParseratorPlanCachePolicy,
  ParseratorPlanCacheResolution
} from './types';
import { clonePlan } from './utils';

interface StoredPlanCacheEntry extends ParseratorPlanCacheEntry {}

export interface InMemoryPlanCacheOptions {
  maxEntries?: number;
}

class InMemoryPlanCache implements ParseratorPlanCache {
  private readonly store = new Map<string, StoredPlanCacheEntry>();

  constructor(private readonly options: InMemoryPlanCacheOptions = {}) {}

  get(key: string): ParseratorPlanCacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    return {
      ...entry,
      plan: clonePlan(entry.plan, entry.plan.metadata.origin),
      diagnostics: [...entry.diagnostics]
    };
  }

  set(key: string, entry: ParseratorPlanCacheEntry): void {
    this.store.set(key, {
      ...entry,
      plan: clonePlan(entry.plan, entry.plan.metadata.origin),
      diagnostics: [...entry.diagnostics]
    });

    const { maxEntries } = this.options;
    if (typeof maxEntries === 'number' && maxEntries > 0 && this.store.size > maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(profile?: string): void {
    if (!profile) {
      this.store.clear();
      return;
    }

    for (const [key, entry] of this.store.entries()) {
      if (entry.profile === profile) {
        this.store.delete(key);
      }
    }
  }
}

export function createInMemoryPlanCache(options?: InMemoryPlanCacheOptions): ParseratorPlanCache {
  return new InMemoryPlanCache(options);
}

export function evaluatePlanCacheEntry(params: {
  entry?: ParseratorPlanCacheEntry;
  policy?: ParseratorPlanCachePolicy;
  now?: number;
}): ParseratorPlanCacheResolution {
  const { entry, policy, now = Date.now() } = params;

  if (!entry) {
    return { status: 'miss' };
  }

  const updatedAt = entry.updatedAt ? Date.parse(entry.updatedAt) : NaN;
  const ageMs = Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) : undefined;

  if (!policy) {
    return {
      status: 'hit',
      entry,
      ageMs,
      updatedAt: entry.updatedAt
    };
  }

  if (
    typeof policy.minConfidence === 'number' &&
    entry.confidence < policy.minConfidence
  ) {
    return {
      status: 'rejected',
      entry,
      ageMs,
      updatedAt: entry.updatedAt,
      reason: `confidence ${entry.confidence.toFixed(2)} below policy threshold ${policy.minConfidence.toFixed(2)}`
    };
  }

  if (typeof policy.maxAgeMs === 'number' && ageMs !== undefined && ageMs > policy.maxAgeMs) {
    return {
      status: 'expired',
      entry,
      ageMs,
      updatedAt: entry.updatedAt,
      reason: `plan age ${ageMs}ms exceeds maxAgeMs ${policy.maxAgeMs}`
    };
  }

  const stale =
    typeof policy.staleAfterMs === 'number' &&
    ageMs !== undefined &&
    ageMs > policy.staleAfterMs;

  return {
    status: stale ? 'stale' : 'hit',
    entry,
    stale,
    ageMs,
    updatedAt: entry.updatedAt,
    reason: stale
      ? `plan age ${ageMs}ms exceeds staleAfterMs ${policy.staleAfterMs}`
      : undefined
  };
}
