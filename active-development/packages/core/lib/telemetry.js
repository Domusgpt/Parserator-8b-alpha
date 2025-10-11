"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryHub = void 0;
exports.createTelemetryHub = createTelemetryHub;
exports.createPlanCacheTelemetryEmitter = createPlanCacheTelemetryEmitter;
exports.createPlanRewriteTelemetryEmitter = createPlanRewriteTelemetryEmitter;
const uuid_1 = require("uuid");
class NoopTelemetry {
    emit() {
        // noop
    }
    register() {
        // noop
    }
    unregister() {
        // noop
    }
    listeners() {
        return [];
    }
}
class TelemetryHub {
    constructor(listeners = [], logger) {
        this.logger = logger;
        this.listenersSet = new Set();
        listeners.forEach(listener => this.listenersSet.add(listener));
    }
    emit(event) {
        if (this.listenersSet.size === 0) {
            return;
        }
        for (const listener of this.listenersSet) {
            try {
                const result = listener(event);
                if (result && typeof result.then === 'function') {
                    result.catch(error => {
                        this.logger?.warn?.('parserator-core:telemetry-listener-error', {
                            error: error instanceof Error ? error.message : error,
                            event
                        });
                    });
                }
            }
            catch (error) {
                this.logger?.warn?.('parserator-core:telemetry-listener-error', {
                    error: error instanceof Error ? error.message : error,
                    event
                });
            }
        }
    }
    register(listener) {
        this.listenersSet.add(listener);
    }
    unregister(listener) {
        this.listenersSet.delete(listener);
    }
    listeners() {
        return Array.from(this.listenersSet);
    }
}
exports.TelemetryHub = TelemetryHub;
function createTelemetryHub(input, logger) {
    if (!input) {
        return new NoopTelemetry();
    }
    if (typeof input?.emit === 'function') {
        return input;
    }
    const listeners = Array.isArray(input) ? input : [input];
    return new TelemetryHub(listeners, logger);
}
function createPlanCacheTelemetryEmitter(options) {
    const requestIdFactory = options.requestIdFactory ?? uuid_1.v4;
    const safeResolve = (resolver, label) => {
        if (!resolver) {
            return undefined;
        }
        try {
            return resolver();
        }
        catch (error) {
            options.logger?.warn?.('parserator-core:plan-cache-telemetry-resolve-failed', {
                error: error instanceof Error ? error.message : error,
                source: options.source,
                field: label
            });
            return undefined;
        }
    };
    const normaliseError = (error) => {
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
        }
        catch {
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
function createPlanRewriteTelemetryEmitter(options) {
    const requestIdFactory = options.requestIdFactory ?? uuid_1.v4;
    const safeResolve = (resolver, label) => {
        if (!resolver) {
            return undefined;
        }
        try {
            return resolver();
        }
        catch (error) {
            options.logger?.warn?.('parserator-core:plan-rewrite-telemetry-resolve-failed', {
                error: error instanceof Error ? error.message : error,
                source: options.source,
                field: label
            });
            return undefined;
        }
    };
    const normaliseError = (error) => {
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
        }
        catch {
            return String(error);
        }
    };
    const normaliseQueue = (queue) => {
        if (!queue) {
            return undefined;
        }
        return {
            pending: queue.pending,
            inFlight: queue.inFlight,
            completed: queue.completed,
            failed: queue.failed,
            size: queue.size,
            lastDurationMs: queue.lastDurationMs,
            lastError: queue.lastError
        };
    };
    return event => {
        const requestId = event.requestId ?? requestIdFactory();
        const source = event.source ?? options.source;
        options.telemetry.emit({
            type: 'plan:rewrite',
            source,
            requestId,
            timestamp: new Date().toISOString(),
            profile: safeResolve(options.resolveProfile, 'profile'),
            sessionId: event.sessionId ?? safeResolve(options.resolveSessionId, 'sessionId'),
            action: event.action,
            heuristicsConfidence: event.heuristicsConfidence,
            requestedThreshold: event.requestedThreshold,
            rewriteConfidence: event.rewriteConfidence,
            cooldownMs: event.cooldownMs,
            usage: event.usage,
            queue: normaliseQueue(event.queue),
            skipReason: event.skipReason,
            error: normaliseError(event.error)
        });
    };
}
//# sourceMappingURL=telemetry.js.map