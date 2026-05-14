/**
 * Health check endpoints for monitoring and Kubernetes probes.
 */

import { Router } from 'express';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { getRequestLogger } from '../logger.js';
import type { ProviderHealth } from '../types.js';

// Initialize default Prometheus metrics
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const aiCallsTotal = new Counter({
  name: 'ai_calls_total',
  help: 'Total AI provider calls',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
});

export const processingDuration = new Histogram({
  name: 'processing_duration_seconds',
  help: 'Logo processing duration in seconds',
  labelNames: ['provider', 'model', 'quality'],
  buckets: [1, 5, 10, 15, 30, 60, 120],
  registers: [register],
});

/** Provider health tracking (in-memory) */
const providerHealth = new Map<string, ProviderHealth>();

export function updateProviderHealth(health: ProviderHealth): void {
  providerHealth.set(health.name, health);
}

export function getProviderHealth(): ProviderHealth[] {
  return Array.from(providerHealth.values());
}

/** Create health check router */
export function createHealthRouter(): Router {
  const router = Router();

  // Liveness probe — always returns 200 if process is running
  router.get('/live', (_req, res) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness probe — checks if service can handle requests
  router.get('/ready', (_req, res) => {
    const health = getProviderHealth();
    const availableProviders = health.filter(h => h.available);
    const logger = getRequestLogger();

    if (availableProviders.length === 0) {
      logger.warn('Readiness check failed: no AI providers available');
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        providers: health,
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      providers: health,
    });
  });

  // Prometheus metrics endpoint
  router.get('/metrics', async (_req, res) => {
    try {
      const metrics = await register.metrics();
      res.set('Content-Type', register.contentType);
      res.send(metrics);
    } catch (err) {
      res.status(500).send('Failed to collect metrics');
    }
  });

  return router;
}
