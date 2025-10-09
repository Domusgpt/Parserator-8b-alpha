"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultLogger = void 0;
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
exports.createDefaultLogger = createDefaultLogger;
//# sourceMappingURL=logger.js.map