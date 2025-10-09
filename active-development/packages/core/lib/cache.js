"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInMemoryPlanCache = createInMemoryPlanCache;
const utils_1 = require("./utils");
class InMemoryPlanCache {
    constructor() {
        this.store = new Map();
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            return undefined;
        }
        return {
            ...entry,
            plan: (0, utils_1.clonePlan)(entry.plan, entry.plan.metadata.origin),
            diagnostics: [...entry.diagnostics]
        };
    }
    set(key, entry) {
        this.store.set(key, {
            ...entry,
            plan: (0, utils_1.clonePlan)(entry.plan, entry.plan.metadata.origin),
            diagnostics: [...entry.diagnostics]
        });
    }
    delete(key) {
        this.store.delete(key);
    }
    clear(profile) {
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
function createInMemoryPlanCache() {
    return new InMemoryPlanCache();
}
//# sourceMappingURL=cache.js.map