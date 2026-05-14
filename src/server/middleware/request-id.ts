/**
 * Request ID middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import { createRequestContext, runWithContext, getContext } from '../context.js';
import { getRequestLogger } from '../logger.js';

/** Attach request ID to each incoming request */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ctx = createRequestContext(req);
  res.setHeader('X-Request-ID', ctx.requestId);

  runWithContext(ctx, async () => {
    const logger = getRequestLogger();
    logger.info({ method: req.method, path: req.path }, 'Request started');

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(
        { statusCode: res.statusCode, duration },
        'Request completed',
      );
    });

    next();
  }).catch(next);
}
