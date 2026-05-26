const levels: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase()
const CURRENT = levels[envLevel] ?? levels.info

function safeLog(method: 'debug' | 'info' | 'warn' | 'error', ...args: any[]) {
  // eslint-disable-next-line no-console
  if (levels[method] >= CURRENT) console[method](...args)
}

const logger = {
  debug: (...args: any[]) => safeLog('debug', ...args),
  info: (...args: any[]) => safeLog('info', ...args),
  warn: (...args: any[]) => safeLog('warn', ...args),
  error: (...args: any[]) => safeLog('error', ...args),
}

export default logger
