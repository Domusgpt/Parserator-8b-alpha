import {
  ParseratorInMemoryPlanCacheOptions,
  ParseratorPlanCache,
  ParseratorPlanCacheEntry,
  ParseratorPlanCacheStats
} from './types';
import { clonePlan } from './utils';

interface StoredPlanCacheEntry extends ParseratorPlanCacheEntry {
  storedAt: number;
}

interface PlanCacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  clears: number;
  evictions: number;
  expirations: number;
  lastHitAt?: string;
  lastMissAt?: string;
  lastSetAt?: string;
  lastDeleteAt?: string;
  lastClearAt?: string;
  lastEvictionAt?: string;
  lastExpirationAt?: string;
}

class InMemoryPlanCache implements ParseratorPlanCache {
  private readonly store = new Map<string, StoredPlanCacheEntry>();
  private readonly maxEntries?: number;
  private readonly ttlMs?: number;
  private readonly metrics: PlanCacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    clears: 0,
    evictions: 0,
    expirations: 0
  };

  constructor(options: ParseratorInMemoryPlanCacheOptions = {}) {
    this.maxEntries = options.maxEntries;
    this.ttlMs = options.ttlMs;
  }

  get(key: string): ParseratorPlanCacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.recordMiss();
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.store.delete(key);
      this.metrics.expirations += 1;
      this.metrics.lastExpirationAt = new Date().toISOString();
      this.recordMiss();
      return undefined;
    }

    if (this.ttlMs) {
      entry.storedAt = Date.now();
      entry.expiresAt = new Date(entry.storedAt + this.ttlMs).toISOString();
    }

    // Maintain LRU ordering by re-inserting the entry at the tail of the map.
    this.store.delete(key);
    this.store.set(key, entry);

    this.recordHit();

    return this.cloneEntry(entry);
  }

  set(key: string, entry: ParseratorPlanCacheEntry): void {
    const storedEntry: StoredPlanCacheEntry = {
      ...this.cloneEntry(entry),
      storedAt: Date.now()
    };

    if (this.ttlMs) {
      storedEntry.expiresAt = new Date(storedEntry.storedAt + this.ttlMs).toISOString();
    }

    if (this.store.has(key)) {
      // Remove existing entry to reset insertion order for LRU semantics.
      this.store.delete(key);
    }

    this.store.set(key, storedEntry);
    this.recordSet();
    this.evictOverflow();
  }

  delete(key: string): void {
    if (this.store.delete(key)) {
      this.metrics.deletes += 1;
      this.metrics.lastDeleteAt = new Date().toISOString();
    }
  }

  clear(profile?: string): void {
    if (!profile) {
      if (this.store.size > 0) {
        this.store.clear();
        this.metrics.clears += 1;
        this.metrics.lastClearAt = new Date().toISOString();
      }
      return;
    }

    let removed = false;
    for (const [key, entry] of this.store.entries()) {
      if (entry.profile === profile) {
        this.store.delete(key);
        removed = true;
      }
    }

    if (removed) {
      this.metrics.clears += 1;
      this.metrics.lastClearAt = new Date().toISOString();
    }
  }

  stats(): ParseratorPlanCacheStats {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      ...this.metrics
    };
  }

  private cloneEntry(entry: ParseratorPlanCacheEntry): ParseratorPlanCacheEntry {
    const cloned: ParseratorPlanCacheEntry = {
      ...(entry as ParseratorPlanCacheEntry),
      plan: clonePlan(entry.plan, entry.plan.metadata.origin),
      diagnostics: [...entry.diagnostics]
    };

    delete (cloned as Partial<StoredPlanCacheEntry>).storedAt;
    return cloned;
  }

  private isExpired(entry: StoredPlanCacheEntry): boolean {
    if (!this.ttlMs) {
      return false;
    }

    return Date.now() - entry.storedAt >= this.ttlMs;
  }

  private evictOverflow(): void {
    if (!this.maxEntries || this.store.size <= this.maxEntries) {
      return;
    }

    const overflow = this.store.size - this.maxEntries;
    for (let i = 0; i < overflow; i += 1) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        break;
      }
      this.store.delete(oldestKey);
      this.metrics.evictions += 1;
      this.metrics.lastEvictionAt = new Date().toISOString();
    }
  }

  private recordHit(): void {
    this.metrics.hits += 1;
    this.metrics.lastHitAt = new Date().toISOString();
  }

  private recordMiss(): void {
    this.metrics.misses += 1;
    this.metrics.lastMissAt = new Date().toISOString();
  }

  private recordSet(): void {
    this.metrics.sets += 1;
    this.metrics.lastSetAt = new Date().toISOString();
  }
}

export function createInMemoryPlanCache(
  options?: ParseratorInMemoryPlanCacheOptions
): ParseratorPlanCache {
  return new InMemoryPlanCache(options);
}
