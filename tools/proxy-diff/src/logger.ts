export function createLogger(module: string) {
  const prefix = `[${module}]`;
  return {
    debug(msg: string, data?: unknown) {
      console.debug(`${prefix} ${msg}`, data ? JSON.stringify(data) : '');
    },
    info(msg: string, data?: unknown) {
      console.log(`${prefix} ${msg}`, data ? JSON.stringify(data) : '');
    },
    warn(msg: string, data?: unknown) {
      console.warn(`${prefix} ${msg}`, data ? JSON.stringify(data) : '');
    },
    error(msg: string, data?: unknown) {
      console.error(`${prefix} ${msg}`, data ? JSON.stringify(data) : '');
    },
  };
}
