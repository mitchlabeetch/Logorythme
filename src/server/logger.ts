/**
 * Structured logging with Pino.
 * Provides request-scoped child loggers and automatic redaction
 * of sensitive data.
 */

import pino from 'pino';
import { config, isDevelopment } from './config.js';
import { getContext } from './context.js';

const redactPaths = [
  'apiKey',
  '*.apiKey',
  'headers.authorization',
  'headers.cookie',
  '*.authorization',
  '*.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

const baseLogger = pino({
  level: config.logLevel,
  transport: isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
    : undefined,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: { service: 'logorythme', version: '2.0.0' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Get the root logger.
 * Use for application-level logging without request context.
 */
export const logger = baseLogger;

/**
 * Create a child logger with the current request context.
 * Automatically includes requestId and timing information.
 */
export function getRequestLogger() {
  const ctx = getContext();
  if (!ctx) return baseLogger;
  return baseLogger.child({
    requestId: ctx.requestId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

/**
 * Create a child logger with an explicit request ID.
 * Use when request context is not available via AsyncLocalStorage.
 */
export function createRequestLogger(requestId: string) {
  return baseLogger.child({ requestId });
}

/**
 * Log an audit event for SOC2 compliance.
 */
export function auditLog(event: string, details: Record<string, unknown>) {
  const ctx = getContext();
  getRequestLogger().info({ event, audit: true, ...details }, `audit: ${event}`);
}
