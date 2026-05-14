/**
 * API route definitions.
 */

import { Router } from 'express';
import { upload, validateImageFile } from '../middleware/validate.js';
import { vectorizeHandler } from './vectorize.js';
import { statusHandler } from './status.js';
import { createHealthRouter } from '../health/index.js';
import { ModelRegistry } from '../ai/registry.js';
import { FallbackOrchestrator } from '../ai/orchestrator.js';
import { RANKED_MODELS } from '../ai/model-ranker.js';

/** Create main API router */
export function createApiRouter(registry: ModelRegistry, orchestrator: FallbackOrchestrator): Router {
  const router = Router();

  // Health endpoints
  router.use('/health', createHealthRouter());

  // Vectorize: upload logo and process
  router.post(
    '/api/v1/vectorize',
    upload.single('logo'),
    validateImageFile,
    (req, res, next) => {
      (req as typeof req & { registry: ModelRegistry; orchestrator: FallbackOrchestrator }).registry = registry;
      (req as typeof req & { registry: ModelRegistry; orchestrator: FallbackOrchestrator }).orchestrator = orchestrator;
      vectorizeHandler(req as Parameters<typeof vectorizeHandler>[0], res, next);
    },
  );

  // Job status
  router.get('/api/v1/status/:jobId', statusHandler);

  // List available models with pricing and quality info
  router.get('/api/v1/models', async (_req, res) => {
    try {
      const models = await registry.listAvailableModels();
      
      // Merge with ranking info
      const enriched = models.map(m => {
        const rank = RANKED_MODELS.find(r => r.id === m.id);
        return {
          ...m,
          qualityScore: rank?.qualityScore,
          estimatedCost: rank?.estimatedCost,
          svgDedicated: rank?.svgDedicated ?? false,
        };
      });

      res.json({ 
        models: enriched,
        totalAvailable: enriched.length,
        recommended: enriched.filter(m => m.provider === 'huggingface').map(m => m.id),
      });
    } catch {
      // Fallback to static list
      res.json({ models: [] });
    }
  });

  // Provider health
  router.get('/api/v1/providers/health', async (_req, res) => {
    try {
      const providers = registry.getAvailableProviders();
      res.json({ 
        providers: Array.from(providers),
        count: providers.size,
      });
    } catch {
      res.json({ providers: [], count: 0 });
    }
  });

  return router;
}
