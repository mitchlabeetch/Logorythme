/**
 * AsyncLocalStorage-based request context propagation.
 * Enables request-scoped data access throughout the application
 * without explicit parameter passing.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { RequestContext } from './types.js';

const requestContextStore = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a unique request identifier.
 * Prefixed with timestamp for sortability.
 */
export function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const uuid = randomUUID().slice(0, 8);
  return `${ts}-${uuid}`;
}

/**
 * Execute a function within a request context.
 * All code inside `fn` can access the context via `getContext()`.
 *
 * @param ctx - The request context to propagate
 * @param fn - The function to execute within the context
 */
export function runWithContext<T>(ctx: RequestContext, fn: () => T | Promise<T>): Promise<T> {
  return requestContextStore.run(ctx, fn);
}

/**
 * Get the current request context.
 * Returns undefined if called outside of `runWithContext()`.
 */
export function getContext(): RequestContext | undefined {
  return requestContextStore.getStore();
}

/**
 * Get the current request ID from context.
 * Returns a fallback ID if called outside of context.
 */
export function getRequestId(): string {
  return getContext()?.requestId ?? generateRequestId();
}

/**
 * Create a new request context from an Express request.
 */
export function createRequestContext(req: { ip?: string; headers: { 'user-agent'?: string } }): RequestContext {
  return {
    requestId: generateRequestId(),
    startTime: Date.now(),
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}
