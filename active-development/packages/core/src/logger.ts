import { CoreLogger } from './types';

export function createDefaultLogger(): CoreLogger {
  const globalConsole = (globalThis as any).console;
  if (globalConsole) {
    return {
      debug: (...args: unknown[]) => globalConsole.debug?.(...args),
      info: (...args: unknown[]) => globalConsole.info?.(...args),
      warn: (...args: unknown[]) => globalConsole.warn?.(...args),
      error: (...args: unknown[]) => globalConsole.error?.(...args)
    };
  }

  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}
