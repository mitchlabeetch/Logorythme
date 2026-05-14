/**
 * Fallback orchestrator with circuit breaker + retry + quality-based auto-retry.
 * 
 * Routes requests through providers with automatic failover.
 * If quality check fails, automatically retries with next best provider.
 * Uses StarVector as primary (dedicated SVG model), falls back to Vercel AI Gateway,
 * then direct providers, then custom OpenAI-compatible endpoints.
 */

import { Policy, ConsecutiveBreaker, CircuitBreakerPolicy } from 'cockatiel';
import pRetry from 'p-retry';
import type { IProviderStrategy } from './provider.js';
import type { VectorizeOptions, AIResult, ProviderHealth, StageProgress, QualityReport } from '../types.js';
import { AllProvidersDownError, AIProviderError } from '../errors/index.js';
import { ModelRegistry } from './registry.js';
import { selectBestModel } from './model-ranker.js';
import { getRequestLogger } from '../logger.js';
import { processingDuration, aiCallsTotal, updateProviderHealth } from '../health/index.js';

interface ProviderEntry {
  strategy: IProviderStrategy;
  circuitBreaker: CircuitBreakerPolicy;
  health: ProviderHealth;
}

export class FallbackOrchestrator {
  private providers = new Map<string, ProviderEntry>();
  private logger = getRequestLogger();
  private registry: ModelRegistry;

  constructor(registry?: ModelRegistry) {
    this.registry = registry ?? new ModelRegistry();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const strategy of this.registry.getAllProviders()) {
      const breaker = Policy.handleAll().circuitBreaker(5000, new ConsecutiveBreaker(5));
      this.providers.set(strategy.name, {
        strategy,
        circuitBreaker: breaker,
        health: {
          name: strategy.name as 'google' | 'openai' | 'anthropic' | 'huggingface' | 'vercel-gateway' | 'custom',
          available: true,
          healthScore: 100,
          consecutiveFailures: 0,
        },
      });

      breaker.onStateChange(({ state }) => {
        this.logger.warn({ provider: strategy.name, state: state.name }, 'Circuit breaker state changed');
      });
    }
  }

  /** 
   * Vectorize an image with automatic fallback and quality-based retry.
   * If quality check fails, retries with the next best provider.
   */
  async vectorize(
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult & { stages: StageProgress[] }> {
    const startTime = Date.now();
    const stages: StageProgress[] = [];
    
    // Smart model selection — use ranker if no explicit model
    const modelId = options.model ?? this.selectSmartModel(options);
    const modelName = this.registry.getModelName(modelId);

    this.logger.info({ model: modelId, quality: options.quality }, 'Starting vectorization with smart routing');

    // Get ordered list of providers to try
    const providersToTry = this.getProviderChain(modelId);
    if (providersToTry.length === 0) {
      throw new AllProvidersDownError();
    }

    let lastError: Error | undefined;
    let lastResult: (AIResult & { stages: StageProgress[] }) | undefined;

    for (let attempt = 0; attempt < providersToTry.length; attempt++) {
      const entry = providersToTry[attempt];
      const isRetry = attempt > 0;

      try {
        if (isRetry) {
          this.logger.info({ 
            provider: entry.strategy.name, 
            attempt: attempt + 1,
            reason: lastResult ? 'quality retry' : 'provider failure',
          }, 'Retrying with fallback provider');
        }

        const result = await this.tryProvider(entry, imageBase64, mimeType, {
          ...options,
          model: modelName,
        });

        // Track metrics
        const duration = (Date.now() - startTime) / 1000;
        processingDuration.observe(
          { provider: entry.strategy.name, model: modelName, quality: options.quality },
          duration,
        );
        aiCallsTotal.inc({ provider: entry.strategy.name, model: modelName, status: 'success' });

        this.recordSuccess(entry);
        lastResult = result;

        // If this is a quality retry, note it in stages
        if (isRetry) {
          stages.push({ name: 'complete', label: 'Completed with fallback', complete: true });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(entry, lastError);
        aiCallsTotal.inc({ provider: entry.strategy.name, model: modelName, status: 'error' });

        if (error instanceof AIProviderError && !error.retryable) {
          this.logger.warn({ provider: entry.strategy.name, error: error.message }, 'Non-retryable error');
          continue;
        }
      }
    }

    throw lastError ?? new AllProvidersDownError();
  }

  /**
   * Quality-based auto-retry.
   * If the SVG fails quality validation, retry with the next provider.
   */
  async vectorizeWithQualityRetry(
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
    qualityCheck: (svg: string) => Promise<QualityReport>,
  ): Promise<AIResult & { stages: StageProgress[]; quality: QualityReport }> {
    const startTime = Date.now();
    
    // Try primary model first
    let result = await this.vectorize(imageBase64, mimeType, options);
    let quality = await qualityCheck(result.svg);

    // If quality passes, return immediately
    if (quality.passed) {
      return { ...result, quality };
    }

    // Quality failed — try fallback models
    this.logger.warn({ warnings: quality.warnings }, 'Quality check failed, trying fallback models');

    const fallbackModels = this.registry.getFallbackModels();
    for (const fallbackId of fallbackModels) {
      try {
        const fallbackResult = await this.vectorize(imageBase64, mimeType, {
          ...options,
          model: fallbackId,
        });
        const fallbackQuality = await qualityCheck(fallbackResult.svg);

        if (fallbackQuality.passed || fallbackQuality.fillRatio > quality.fillRatio) {
          this.logger.info({ model: fallbackId }, 'Fallback model produced better quality');
          return { ...fallbackResult, quality: fallbackQuality };
        }
      } catch (error) {
        this.logger.warn({ model: fallbackId, error: (error as Error).message }, 'Fallback model failed');
      }
    }

    // Return best result even if quality still imperfect
    return { ...result, quality };
  }

  /** Try a single provider with retry logic */
  private async tryProvider(
    entry: ProviderEntry,
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult & { stages: StageProgress[] }> {
    return entry.circuitBreaker.execute(() =>
      pRetry(
        () => entry.strategy.generateVectorSVG(imageBase64, mimeType, options),
        {
          retries: 2,
          minTimeout: 1000,
          maxTimeout: 30000,
          factor: 2,
          randomize: true,
          onFailedAttempt: (error) => {
            this.logger.warn({
              provider: entry.strategy.name,
              attempt: error.attemptNumber,
              message: error.message,
            }, 'Retry attempt failed');
          },
          retryIf: (error) => {
            if (error instanceof AIProviderError) return error.retryable;
            return true;
          },
        },
      ),
    ).then(result => ({ ...result, stages: [] }));
  }

  /** Smart model selection based on quality preset and available providers */
  private selectSmartModel(options: VectorizeOptions): string {
    const available = this.registry.getAvailableProviders();
    return selectBestModel(options.quality, available);
  }

  /** Get ordered list of providers to try */
  private getProviderChain(modelId: string): ProviderEntry[] {
    const requested = this.registry.getProviderForModel(modelId);
    const entries: ProviderEntry[] = [];

    // 1. Try requested model's provider first
    if (requested) {
      const entry = this.providers.get(requested.name);
      if (entry) entries.push(entry);
    }

    // 2. Try Hugging Face (StarVector) — best for SVG
    if (!entries.some(e => e.strategy.name === 'huggingface')) {
      const hf = this.providers.get('huggingface');
      if (hf) entries.push(hf);
    }

    // 3. Try Vercel AI Gateway — broadest model coverage
    if (!entries.some(e => e.strategy.name === 'vercel-gateway')) {
      const gw = this.providers.get('vercel-gateway');
      if (gw) entries.push(gw);
    }

    // 4. Try fallback models in order
    for (const fallbackId of this.registry.getFallbackModels()) {
      const fallback = this.registry.getProviderForModel(fallbackId);
      if (fallback) {
        const entry = this.providers.get(fallback.name);
        if (entry && !entries.includes(entry)) {
          entries.push(entry);
        }
      }
    }

    // 5. Try any remaining providers
    for (const [name, entry] of this.providers) {
      if (!entries.includes(entry) && entry.health.available) {
        entries.push(entry);
      }
    }

    return entries;
  }

  private recordSuccess(entry: ProviderEntry): void {
    entry.health.healthScore = Math.min(100, entry.health.healthScore + 10);
    entry.health.consecutiveFailures = 0;
    entry.health.available = true;
    entry.health.lastSuccessAt = Date.now();
    updateProviderHealth({ ...entry.health });
  }

  private recordFailure(entry: ProviderEntry, error: Error): void {
    entry.health.healthScore = Math.max(0, entry.health.healthScore - 15);
    entry.health.consecutiveFailures++;
    entry.health.lastFailureAt = Date.now();
    if (entry.health.consecutiveFailures >= 5) {
      entry.health.available = false;
    }
    updateProviderHealth({ ...entry.health });
  }

  getHealth(): ProviderHealth[] {
    return Array.from(this.providers.values()).map(e => ({ ...e.health }));
  }

  /** Rebuild provider entries from the updated registry (call after registry.reinitialize()) */
  reinitialize(): void {
    this.providers.clear();
    this.initializeProviders();
    this.logger.info({ providers: Array.from(this.providers.keys()) }, 'Orchestrator reinitialized');
  }
}
