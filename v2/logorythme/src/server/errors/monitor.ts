/**
 * Error monitoring integration with Sentry.
 * Provides performance tracking and error capture.
 */

import * as Sentry from '@sentry/node';
import { config } from '../config.js';

let initialized = false;

/** Initialize Sentry if DSN is configured */
export function initMonitoring(): void {
  if (!config.sentryDsn) return;

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.05 : 0.5,
    beforeSend(event) {
      // Scrub PII from events
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
        delete event.request.headers?.cookie;
      }
      return event;
    },
  });

  initialized = true;
}

/** Capture an error with optional context */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}

/** Execute a function within a Sentry performance span */
export async function withSpan<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, unknown>): Promise<T> {
  if (!initialized) return fn();

  return Sentry.startSpan({ name, op: name, attributes }, async () => fn());
}

/** Flush pending events before shutdown */
export async function flushMonitoring(timeout = 2000): Promise<void> {
  if (!initialized) return;
  await Sentry.close(timeout);
}

import { isProduction } from '../config.js';
