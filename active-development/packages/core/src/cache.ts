import { ParseratorPlanCache, ParseratorPlanCacheEntry } from './types';
import { clonePlan } from './utils';

interface StoredPlanCacheEntry extends ParseratorPlanCacheEntry {}

class InMemoryPlanCache implements ParseratorPlanCache {
  private readonly store = new Map<string, StoredPlanCacheEntry>();

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

export function createInMemoryPlanCache(): ParseratorPlanCache {
  return new InMemoryPlanCache();
}
