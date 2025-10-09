"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultLogger = createDefaultLogger;
function createDefaultLogger() {
    const globalConsole = globalThis.console;
    if (globalConsole) {
        return {
            debug: (...args) => globalConsole.debug?.(...args),
            info: (...args) => globalConsole.info?.(...args),
            warn: (...args) => globalConsole.warn?.(...args),
            error: (...args) => globalConsole.error?.(...args)
        };
    }
    return {
        debug: () => { },
        info: () => { },
        warn: () => { },
        error: () => { }
    };
}
//# sourceMappingURL=logger.js.map