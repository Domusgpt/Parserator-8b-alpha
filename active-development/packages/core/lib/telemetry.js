"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTelemetryHub = exports.TelemetryHub = void 0;
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
exports.createTelemetryHub = createTelemetryHub;
//# sourceMappingURL=telemetry.js.map