/**
 * Express application factory.
 * Configures middleware chain and routes.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  helmetMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
  requestIdMiddleware,
  auditLogMiddleware,
} from './middleware/index.js';
import { errorHandler, notFoundHandler } from './errors/middleware.js';
import { createApiRouter } from './api/routes.js';
import { config } from './config.js';
import { isProduction } from './config.js';
import { ModelRegistry } from './ai/registry.js';
import { FallbackOrchestrator } from './ai/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Create and configure Express app */
export function createApp(): express.Application {
  const app = express();

  // Singleton AI components — created once at startup to avoid per-request overhead
  const registry = new ModelRegistry();
  const orchestrator = new FallbackOrchestrator(registry);

  // 1. Security
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(rateLimitMiddleware);

  // 2. Request ID
  app.use(requestIdMiddleware);

  // 3. Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Audit logging
  app.use(auditLogMiddleware);

  // 5. Static files (production)
  if (isProduction) {
    app.use(express.static(path.join(__dirname, '../../dist/client'), {
      maxAge: '1d',
      setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));
  }

  // 6. API routes
  app.use(createApiRouter(registry, orchestrator));

  // 7. SPA fallback (serve index.html for client routes)
  if (isProduction) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '../../dist/client/index.html'));
    });
  }

  // 8. 404 handler
  app.use(notFoundHandler);

  // 9. Global error handler (MUST be last)
  app.use(errorHandler);

  return app;
}
