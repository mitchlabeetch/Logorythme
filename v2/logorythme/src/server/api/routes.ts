/**
 * API route definitions.
 */

import { Router } from 'express';
import { upload, validateImageFile } from '../middleware/validate.js';
import { vectorizeHandler } from './vectorize.js';
import { statusHandler } from './status.js';
import { createHealthRouter } from '../health/index.js';
import { ModelRegistry } from '../ai/registry.js';
import { RANKED_MODELS } from '../ai/model-ranker.js';

/** Create main API router */
export function createApiRouter(): Router {
  const router = Router();

  // Health endpoints
  router.use('/health', createHealthRouter());

  // Vectorize: upload logo and process
  router.post(
    '/api/v1/vectorize',
    upload.single('logo'),
    validateImageFile,
    vectorizeHandler,
  );

  // Job status
  router.get('/api/v1/status/:jobId', statusHandler);

  // List available models with pricing and quality info
  router.get('/api/v1/models', async (_req, res) => {
    try {
      const registry = new ModelRegistry();
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
      const registry = new ModelRegistry();
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
