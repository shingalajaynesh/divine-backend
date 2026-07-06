import winston from 'winston';
import util from 'util';
import { AsyncLocalStorage } from 'async_hooks';

const isDevelopment = process.env.NODE_ENV !== 'production';
const { LOG_LEVEL = 'info' } = process.env;

// AsyncLocalStorage to hold request-scoped logging context
export const loggerContext = new AsyncLocalStorage();

/**
 * Runs a function within a logging context.
 */
export const runWithContext = (context, callback) => {
  return loggerContext.run(context || {}, callback);
};

/**
 * Dynamically updates the current logging context.
 */
export const setContext = (key, value) => {
  const store = loggerContext.getStore();
  if (store) {
    store[key] = value;
  }
};

/**
 * Gets the current logging context.
 */
export const getContext = () => {
  return loggerContext.getStore();
};

// Winston formatter to inject context variables into logs
const contextFormat = winston.format((info) => {
  const store = loggerContext.getStore();
  if (store) {
    if (store.requestId && !info.requestId) info.requestId = store.requestId;
    if (store.userId && !info.userId) info.userId = store.userId;
    if (store.centerId && !info.centerId) info.centerId = store.centerId;
    if (store.module && !info.module) info.module = store.module;
  }
  return info;
});

// Format configuration for development vs production
const devFormat = winston.format.printf(
  ({ level, message = '', timestamp, requestId, userId, centerId, module, stack, ...meta }) => {
    const colors = {
      info: '\x1b[32m', // green
      error: '\x1b[31m', // red
      warn: '\x1b[33m', // yellow
      debug: '\x1b[36m', // cyan
      reset: '\x1b[0m',
      purple: '\x1b[35m', // purple (user ID)
      cyan: '\x1b[36m', // cyan (request ID)
      blue: '\x1b[34m', // blue (center ID)
    };

    const userStr = userId ? `${colors.purple}[user:${userId}]\x1b[0m` : '';
    const centerStr = centerId ? `${colors.blue}[center:${centerId}]\x1b[0m` : '';
    const reqStr = requestId ? `${colors.cyan}[req:${requestId.substring(0, 8)}]\x1b[0m` : '';

    const prefixParts = [];
    if (userStr) prefixParts.push(userStr);
    if (centerStr) prefixParts.push(centerStr);
    if (reqStr) prefixParts.push(reqStr);
    const prefix = prefixParts.length > 0 ? `${prefixParts.join(' ')} ` : '';

    const levelStr = `[${level.toUpperCase()}]`;
    const modStr = module ? `${module} - ` : '';
    const color = colors[level.toLowerCase()] || '';
    const coloredLevel = `${color}${levelStr}\x1b[0m`;

    let logLine = `${prefix}${timestamp} ${coloredLevel}: ${modStr}${message}`;

    if (stack) {
      logLine += `\n${stack}`;
    }

    // Filter out Winston properties
    const cleanMeta = {};
    for (const key of Object.keys(meta)) {
      if (
        typeof key === 'symbol' ||
        ['timestamp', 'level', 'message', 'requestId', 'userId', 'centerId', 'module', 'stack'].includes(key)
      )
        continue;
      cleanMeta[key] = meta[key];
    }

    if (Object.keys(cleanMeta).length > 0) {
      logLine += `\n${util.inspect(cleanMeta, { depth: null, colors: true })}`;
    }

    return logLine;
  }
);

// Create the winston logger singleton
export const winstonLogger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    contextFormat(),
    isDevelopment ? devFormat : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

/**
 * Logger wrapper class for backward compatibility and module-specific logger tagging.
 */
class Logger {
  constructor(module, user) {
    this.module = module;
    this.user = user;
  }

  configureLogger() {
    return winstonLogger;
  }

  log(level, ...args) {
    let message = '';
    let meta = {};

    if (args.length === 1 && args[0] instanceof Error) {
      const err = args[0];
      message = err.message;
      meta = { stack: err.stack, error: err };
    } else {
      if (args.length > 1 && typeof args[args.length - 1] === 'object' && !(args[args.length - 1] instanceof Error)) {
        meta = args.pop();
      }
      message = util.format(...args);
    }

    const logData = {
      level,
      message,
      ...meta,
    };
    if (this.module) logData.module = this.module;
    if (this.user) logData.userId = this.user;

    winstonLogger.log(logData);
  }

  info(...args) {
    this.log('info', ...args);
  }
  error(...args) {
    this.log('error', ...args);
  }
  warn(...args) {
    this.log('warn', ...args);
  }
  debug(...args) {
    this.log('debug', ...args);
  }
}

export default Logger;
