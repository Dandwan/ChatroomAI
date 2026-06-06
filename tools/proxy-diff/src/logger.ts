export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>): void
}

export function createLogger(module: string): Logger {
  const prefix = `[${module}]`
  return {
    debug(msg, data) {
      console.debug(`${prefix} ${msg}`, data ? JSON.stringify(data) : '')
    },
    info(msg, data) {
      console.log(`${prefix} ${msg}`, data ? JSON.stringify(data) : '')
    },
    warn(msg, data) {
      console.warn(`${prefix} ${msg}`, data ? JSON.stringify(data) : '')
    },
    error(msg, data) {
      console.error(`${prefix} ${msg}`, data ? JSON.stringify(data) : '')
    },
  }
}
