# Production-Grade Error Handling Patterns for Node.js Microservices

## Executive Summary

This document presents a comprehensive error handling architecture for a Node.js logo vectorization microservice, covering retry logic, circuit breakers, self-healing systems, graceful degradation, structured error responses, health checks, request context tracking, graceful shutdown, error monitoring, timeout patterns, and bulkhead isolation. Each section includes specific library recommendations with npm versions, implementation code examples, and design rationale.

---

## Table of Contents

1. [Error Classification Taxonomy](#1-error-classification-taxonomy)
2. [Retry Patterns](#2-retry-patterns)
3. [Circuit Breaker Pattern](#3-circuit-breaker-pattern)
4. [Graceful Degradation & Fallback Strategies](#4-graceful-degradation--fallback-strategies)
5. [Self-Healing Service Patterns](#5-self-healing-service-patterns)
6. [Structured Error Handling (RFC 7807)](#6-structured-error-handling-rfc-7807)
7. [Health Check Endpoint Design](#7-health-check-endpoint-design)
8. [Request Context Tracking with AsyncLocalStorage](#8-request-context-tracking-with-asynclocalstorage)
9. [Graceful Shutdown](#9-graceful-shutdown)
10. [Error Monitoring Integration](#10-error-monitoring-integration)
11. [Timeout and Deadline Patterns](#11-timeout-and-deadline-patterns)
12. [Bulkhead Pattern](#12-bulkhead-pattern)
13. [Complete Integration Architecture](#13-complete-integration-architecture)

---

## 1. Error Classification Taxonomy

Before implementing resilience patterns, errors must be classified to determine appropriate handling strategies.

### 1.1 Error Categories

| Category | Description | Examples | Retry? | Circuit Breaker? |
|----------|-------------|----------|--------|-----------------|
| **Transient** | Temporary failures that may resolve | Network timeout, 503, rate limit (429) | Yes | Yes |
| **Permanent** | Client-side errors that won't resolve | Invalid input (400), auth failure (401) | No | No |
| **Infrastructure** | Resource exhaustion, disk full | OOM, connection pool exhausted | No | Yes |
| **Dependency** | External service failures | AI API down, CDN unreachable | Yes (with backoff) | Yes |
| **Business Logic** | Domain validation failures | Unsupported image format | No | No |

### 1.2 Error Codes for the Vectorization Service

```typescript
// errors/error-codes.ts
export enum ErrorCode {
  // Transient errors (retryable)
  AI_PROVIDER_TIMEOUT = 'AI_TIMEOUT',
  AI_PROVIDER_RATE_LIMIT = 'AI_RATE_LIMIT',
  AI_PROVIDER_OVERLOADED = 'AI_OVERLOADED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // Permanent errors (non-retryable)
  INVALID_IMAGE_FORMAT = 'INVALID_FORMAT',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  SVG_VALIDATION_FAILED = 'SVG_VALIDATION',
  UNSUPPORTED_COLOR_SPACE = 'UNSUPPORTED_COLOR',
  
  // Dependency errors
  AI_PROVIDER_UNAVAILABLE = 'AI_UNAVAILABLE',
  STORAGE_SERVICE_ERROR = 'STORAGE_ERROR',
  
  // Infrastructure errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export const RETRYABLE_ERROR_CODES = new Set([
  ErrorCode.AI_PROVIDER_TIMEOUT,
  ErrorCode.AI_PROVIDER_RATE_LIMIT,
  ErrorCode.AI_PROVIDER_OVERLOADED,
  ErrorCode.NETWORK_ERROR,
]);
```

---

## 2. Retry Patterns

### 2.1 Library Comparison

| Library | Weekly Downloads | Key Feature | Best For |
|---------|-----------------|-------------|----------|
| **`p-retry`** | ~5M | ESM-native, TypeScript-first, `onFailedAttempt` hook | Most Node.js projects |
| **`async-retry`** | ~5M | Callback/promise hybrid, battle-tested | Legacy codebases |
| **`exponential-backoff`** | ~8M | Minimal, just the backoff algorithm | Custom retry implementations |
| **`cockatiel`** | ~500K | Full resilience suite (retry + circuit + bulkhead + timeout) | Comprehensive policy composition |

### 2.2 Recommended: p-retry with Custom Configuration

```typescript
// utils/retry.ts
import pRetry from 'p-retry';
import { ErrorCode, RETRYABLE_ERROR_CODES } from '../errors/error-codes';

interface RetryConfig {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  randomize?: boolean;
  errorCodes?: Set<ErrorCode>;
  onFailedAttempt?: (error: Error) => void;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  retries: 5,
  minTimeout: 1000,
  maxTimeout: 30000,
  factor: 2,
  randomize: true, // Critical: prevents thundering herd
  errorCodes: RETRYABLE_ERROR_CODES,
  onFailedAttempt: (error) => {
    console.warn(`Retry attempt failed: ${error.message}`);
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const options = { ...DEFAULT_RETRY_CONFIG, ...config };

  return pRetry(fn, {
    retries: options.retries,
    minTimeout: options.minTimeout,
    maxTimeout: options.maxTimeout,
    factor: options.factor,
    randomize: options.randomize,
    onFailedAttempt: (error) => {
      // Log with context for debugging
      options.onFailedAttempt?.(error);
    },
    retryIf: (error: any) => {
      // Only retry transient, retryable errors
      if (error.code && options.errorCodes?.has(error.code)) {
        return true;
      }
      // Don't retry 4xx client errors
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
      // Retry 5xx server errors
      if (error.status >= 500) {
        return true;
      }
      return false;
    },
  });
}
```

### 2.3 AI-Specific Retry with Retry-After Header Support

```typescript
// utils/ai-retry.ts
import pRetry from 'p-retry';

interface AIRetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  onRetry?: (error: Error, attemptNumber: number) => void;
}

export async function withAIRetry<T>(
  fn: () => Promise<T>,
  options: AIRetryOptions = {}
): Promise<T> {
  const {
    retries = 5,
    minTimeout = 2000,
    maxTimeout = 60000,
    onRetry,
  } = options;

  return pRetry(fn, {
    retries,
    minTimeout,
    maxTimeout,
    factor: 2,
    randomize: true, // Always add jitter for distributed systems [^79^]
    onFailedAttempt: (error: any) => {
      onRetry?.(error, error.attemptNumber);
      
      // Check for Retry-After header from AI provider
      if (error.response?.headers?.['retry-after']) {
        const retryAfterMs = parseInt(error.response.headers['retry-after']) * 1000;
        // Override next delay: use Retry-After + 10-20% jitter buffer [^79^]
        const jitteredDelay = retryAfterMs * (1 + Math.random() * 0.2);
        error.retryAfter = Math.min(jitteredDelay, maxTimeout);
      }
    },
  });
}
```

### 2.4 Retry Best Practices [^79^] [^81^]

1. **Always add jitter** — Without it, all failed clients retry simultaneously, creating a "thundering herd" that worsens outages.
2. **Distinguish 4xx from 5xx** — Never retry client errors (4xx); these indicate bugs in your code.
3. **Respect Retry-After headers** — AI providers (OpenAI, Anthropic) include these on 429 responses.
4. **Cap maximum delay** — Prevent infinite backoff growth; typical cap is 30-60 seconds.
5. **Use `AbortSignal`** — Allow callers to cancel retry loops for request timeout compliance.

---

## 3. Circuit Breaker Pattern

### 3.1 Library Comparison

| Library | Weekly Downloads | Key Features | Best For |
|---------|-----------------|-------------|----------|
| **`opossum`** | ~200K | Official Node.js Foundation, Prometheus events, HALF-OPEN state | Node.js-specific deployments |
| **`cockatiel`** | ~500K | TypeScript-first, composable policies (retry + circuit + bulkhead) | Full resilience suites |

### 3.2 Option A: Opossum (Official Node.js Foundation)

```typescript
// circuit-breakers/ai-circuit-breaker.ts
import CircuitBreaker from 'opossum';

interface AICircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
}

const DEFAULT_OPTIONS: AICircuitBreakerOptions = {
  timeout: 10000,              // 10s max for AI calls
  errorThresholdPercentage: 50, // Trip if 50% of requests fail
  resetTimeout: 30000,         // 30s before HALF-OPEN test
  volumeThreshold: 10,         // Min 10 requests before threshold applies
  rollingCountTimeout: 10000,  // 10s rolling window
  rollingCountBuckets: 10,     // 10 buckets in window
};

export function createAICircuitBreaker<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: AICircuitBreakerOptions = {}
) {
  const breaker = new CircuitBreaker(fn, {
    ...DEFAULT_OPTIONS,
    ...options,
  });

  // Event handlers for monitoring
  breaker.on('open', () => {
    console.error(`[CIRCUIT-OPEN] AI provider circuit breaker OPENED`);
  });

  breaker.on('halfOpen', () => {
    console.warn(`[CIRCUIT-HALF-OPEN] Testing AI provider recovery...`);
  });

  breaker.on('close', () => {
    console.info(`[CIRCUIT-CLOSED] AI provider circuit breaker CLOSED`);
  });

  breaker.on('fallback', (result) => {
    console.warn(`[CIRCUIT-FALLBACK] Fallback executed`, { result });
  });

  // Prometheus metrics exposure
  breaker.on('success', () => metrics.circuitBreakerSuccess.inc());
  breaker.on('failure', () => metrics.circuitBreakerFailure.inc());
  breaker.on('timeout', () => metrics.circuitBreakerTimeout.inc());
  breaker.on('reject', () => metrics.circuitBreakerRejected.inc());

  return breaker;
}
```

### 3.3 Option B: Cockatiel (Recommended for Composability)

Cockatiel provides function-level policy composition — the closest TypeScript equivalent to JVM's Resilience4j [^77^] [^82^].

```typescript
// policies/resilience-policy.ts
import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  retry,
  handleAll,
  timeout,
  TimeoutStrategy,
  wrap,
  bulkhead,
} from 'cockatiel';

// Create individual policies
const retryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({
    initialDelay: 500,
    maxDelay: 30000,
  }),
});

const circuitBreakerPolicy = circuitBreaker(handleAll, {
  halfOpenAfter: 30 * 1000, // 30 seconds
  breaker: new ConsecutiveBreaker(5), // Open after 5 consecutive failures
});

const timeoutPolicy = timeout(10_000, TimeoutStrategy.Cooperative);

const bulkheadPolicy = bulkhead(10, 50); // 10 concurrent, 50 queued

// Compose: retry inside circuit breaker, with timeout and bulkhead
export const aiResiliencePolicy = wrap(
  bulkheadPolicy,
  circuitBreakerPolicy,
  retryPolicy,
  timeoutPolicy
);

// Usage in service
export async function callAIProvider(request: AIRequest): Promise<AIResponse> {
  return aiResiliencePolicy.execute(({ signal }) =>
    fetchAIProvider(request, { signal })
  );
}
```

### 3.4 Circuit Breaker States [^24^]

```
         failures > threshold
CLOSED  ───────────────────►  OPEN
  ▲                              │
  │   success                    │ timeout elapsed
  │                              ▼
HALF-OPEN ◄──────────────── OPEN
  │
  │ failure
  └──────────────────────────► OPEN
```

| State | Behavior | Purpose |
|-------|----------|---------|
| **CLOSED** | Calls pass through, failures counted | Normal operation |
| **OPEN** | Calls short-circuited immediately, fallback runs | Protect failing dependency |
| **HALF-OPEN** | One test request allowed | Test if dependency recovered |

### 3.5 Prometheus Metrics for Circuit Breakers

```typescript
// metrics/circuit-breaker-metrics.ts
import { Counter, Gauge, Histogram } from 'prom-client';

export const circuitBreakerMetrics = {
  state: new Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state: 0=closed, 1=open, 2=half-open',
    labelNames: ['name'],
  }),
  successTotal: new Counter({
    name: 'circuit_breaker_success_total',
    help: 'Total successful calls through circuit breaker',
    labelNames: ['name'],
  }),
  failureTotal: new Counter({
    name: 'circuit_breaker_failure_total',
    help: 'Total failed calls through circuit breaker',
    labelNames: ['name'],
  }),
  timeoutTotal: new Counter({
    name: 'circuit_breaker_timeout_total',
    help: 'Total timed-out calls',
    labelNames: ['name'],
  }),
  rejectedTotal: new Counter({
    name: 'circuit_breaker_rejected_total',
    help: 'Total rejected calls (circuit open)',
    labelNames: ['name'],
  }),
};
```

### 3.6 Grafana Alert Rules

```yaml
# Fire alert when circuit has been open for > 2 minutes
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state{state="open"} == 1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Circuit breaker {{ $labels.name }} is OPEN"

# Warn when fallback rate spikes
- alert: CircuitBreakerFallbackSpike
  expr: rate(circuit_breaker_rejected_total[5m]) > 0.1
  labels:
    severity: warning
```

---

## 4. Graceful Degradation & Fallback Strategies

### 4.1 Degradation Levels for Vectorization Service [^80^] [^84^]

```typescript
// degradation/degradation-levels.ts
export enum DegradationLevel {
  FULL = 'full',           // Primary AI model + full features
  REDUCED = 'reduced',     // Simpler AI model + reduced features
  MINIMAL = 'minimal',     // Cache-only / static fallbacks
  OFFLINE = 'offline',     // Service unavailable, queue for later
}

interface FallbackStrategy {
  level: DegradationLevel;
  model: string;
  maxComplexity: 'high' | 'medium' | 'low' | 'none';
  features: string[];
  timeout: number;
}

const FALLBACK_STRATEGIES: Record<DegradationLevel, FallbackStrategy> = {
  [DegradationLevel.FULL]: {
    level: DegradationLevel.FULL,
    model: 'gpt-4o',
    maxComplexity: 'high',
    features: ['vectorization', 'color_extraction', 'path_optimization', 'metadata'],
    timeout: 30000,
  },
  [DegradationLevel.REDUCED]: {
    level: DegradationLevel.REDUCED,
    model: 'gpt-4o-mini',
    maxComplexity: 'medium',
    features: ['vectorization', 'basic_color_extraction'],
    timeout: 15000,
  },
  [DegradationLevel.MINIMAL]: {
    level: DegradationLevel.MINIMAL,
    model: 'cached_results',
    maxComplexity: 'low',
    features: ['cached_vectorization'],
    timeout: 5000,
  },
  [DegradationLevel.OFFLINE]: {
    level: DegradationLevel.OFFLINE,
    model: 'none',
    maxComplexity: 'none',
    features: [],
    timeout: 0,
  },
};
```

### 4.2 Graceful Degradation Service

```typescript
// services/vectorization-service.ts
import { circuitBreaker } from 'cockatiel';
import { DegradationLevel, FALLBACK_STRATEGIES } from './degradation-levels';

export class VectorizationService {
  private currentLevel: DegradationLevel = DegradationLevel.FULL;
  private lastDegradation: Date | null = null;

  async vectorize(image: ImageInput): Promise<VectorizationResult> {
    // Try current degradation level
    const strategy = FALLBACK_STRATEGIES[this.currentLevel];
    
    try {
      return await this.executeWithStrategy(image, strategy);
    } catch (error) {
      // Degrade and retry
      return this.tryDegradedFallback(image, error);
    }
  }

  private async tryDegradedFallback(
    image: ImageInput,
    originalError: Error
  ): Promise<VectorizationResult> {
    const levels = [
      DegradationLevel.REDUCED,
      DegradationLevel.MINIMAL,
    ];

    for (const level of levels) {
      try {
        this.setDegradationLevel(level);
        const strategy = FALLBACK_STRATEGIES[level];
        return await this.executeWithStrategy(image, strategy);
      } catch (error) {
        continue; // Try next level
      }
    }

    // All levels exhausted
    throw new ServiceUnavailableError('All vectorization strategies failed', {
      cause: originalError,
    });
  }

  private setDegradationLevel(level: DegradationLevel) {
    if (this.currentLevel !== level) {
      this.currentLevel = level;
      this.lastDegradation = new Date();
      console.warn(`[DEGRADATION] Service degraded to ${level}`);
    }
  }

  // Restore full service when health checks pass
  async restoreFullService() {
    if (this.currentLevel !== DegradationLevel.FULL) {
      this.currentLevel = DegradationLevel.FULL;
      this.lastDegradation = null;
      console.info('[DEGRADATION] Service fully restored');
    }
  }
}
```

---

## 5. Self-Healing Service Patterns

### 5.1 Auto-Recovery Configuration [^27^]

```typescript
// config/auto-recovery.ts
export interface AutoRecoveryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  healthCheckInterval: number;
  consecutiveHealthyThreshold: number;
}

export const DEFAULT_RECOVERY_CONFIG: AutoRecoveryConfig = {
  maxRetries: 5,
  backoffMultiplier: 2,
  initialDelay: 1000,        // Start with 1 second
  maxDelay: 30000,           // Max 30 second delay
  healthCheckInterval: 5000, // Check every 5 seconds
  consecutiveHealthyThreshold: 3, // Require 3 consecutive successes
};
```

### 5.2 Health-Aware Auto-Recovery Service

```typescript
// services/self-healing-service.ts
import EventEmitter from 'events';
import { AutoRecoveryConfig, DEFAULT_RECOVERY_CONFIG } from '../config/auto-recovery';

interface HealthIndicator {
  name: string;
  check: () => Promise<boolean>;
}

export class SelfHealingService extends EventEmitter {
  private isHealthy = false;
  private consecutiveHealthy = 0;
  private recoveryAttempt = 0;
  private healthCheckTimer: NodeJS.Timer | null = null;
  private indicators: HealthIndicator[] = [];

  constructor(
    private config: AutoRecoveryConfig = DEFAULT_RECOVERY_CONFIG
  ) {
    super();
  }

  registerHealthIndicator(indicator: HealthIndicator) {
    this.indicators.push(indicator);
  }

  start() {
    this.healthCheckTimer = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckInterval
    );
  }

  async stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private async runHealthCheck() {
    try {
      const results = await Promise.all(
        this.indicators.map(async (ind) => ({
          name: ind.name,
          healthy: await ind.check(),
        }))
      );

      const allHealthy = results.every((r) => r.healthy);

      if (allHealthy) {
        this.consecutiveHealthy++;
        if (!this.isHealthy && this.consecutiveHealthy >= this.config.consecutiveHealthyThreshold) {
          this.isHealthy = true;
          this.recoveryAttempt = 0;
          this.emit('recovered', { indicators: results });
        }
      } else {
        this.consecutiveHealthy = 0;
        if (this.isHealthy) {
          this.isHealthy = false;
          this.emit('degraded', { indicators: results });
          await this.attemptRecovery();
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async attemptRecovery() {
    if (this.recoveryAttempt >= this.config.maxRetries) {
      this.emit('recovery-exhausted', { attempts: this.recoveryAttempt });
      return;
    }

    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, this.recoveryAttempt),
      this.config.maxDelay
    );

    this.emit('recovery-attempt', { attempt: this.recoveryAttempt, delay });
    
    await new Promise((resolve) => setTimeout(resolve, delay));
    this.recoveryAttempt++;
  }

  getHealthStatus() {
    return {
      isHealthy: this.isHealthy,
      consecutiveHealthy: this.consecutiveHealthy,
      recoveryAttempt: this.recoveryAttempt,
    };
  }
}
```

---

## 6. Structured Error Handling (RFC 7807)

### 6.1 Problem Details Implementation

RFC 7807 defines a standardized, machine-readable format for HTTP API errors [^30^].

```typescript
// errors/problem-details.ts
export interface ProblemDetails {
  type: string;      // URI identifying error type
  title: string;     // Short human-readable summary
  status: number;    // HTTP status code
  detail?: string;   // Detailed explanation
  instance?: string; // URI identifying this occurrence
  [key: string]: any; // Extension fields
}

// Service-specific error response
export interface VectorizationProblemDetails extends ProblemDetails {
  errorCode: string;
  retryable: boolean;
  retryAfter?: number; // Seconds until retry
  traceId: string;
  timestamp: string;
  errors?: Record<string, string[]>; // Validation errors
}
```

### 6.2 Error Catalog

```typescript
// errors/error-catalog.ts
import { ProblemDetails } from './problem-details';

export interface ErrorCatalogEntry {
  status: number;
  type: string;
  title: string;
  retryable: boolean;
}

export const ERROR_CATALOG: Record<string, ErrorCatalogEntry> = {
  'ai/timeout': {
    status: 504,
    type: 'https://api.example.com/errors/ai-timeout',
    title: 'AI Provider Timeout',
    retryable: true,
  },
  'ai/rate-limited': {
    status: 429,
    type: 'https://api.example.com/errors/ai-rate-limited',
    title: 'AI Provider Rate Limit Exceeded',
    retryable: true,
  },
  'ai/unavailable': {
    status: 503,
    type: 'https://api.example.com/errors/ai-unavailable',
    title: 'AI Provider Unavailable',
    retryable: true,
  },
  'image/invalid-format': {
    status: 400,
    type: 'https://api.example.com/errors/invalid-image-format',
    title: 'Invalid Image Format',
    retryable: false,
  },
  'image/too-large': {
    status: 413,
    type: 'https://api.example.com/errors/image-too-large',
    title: 'Image Exceeds Size Limit',
    retryable: false,
  },
  'svg/validation-failed': {
    status: 422,
    type: 'https://api.example.com/errors/svg-validation-failed',
    title: 'SVG Validation Failed',
    retryable: false,
  },
  'service/internal-error': {
    status: 500,
    type: 'https://api.example.com/errors/internal-error',
    title: 'Internal Server Error',
    retryable: false,
  },
};
```

### 6.3 Express Error Middleware

```typescript
// middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { ProblemDetails, VectorizationProblemDetails } from '../errors/problem-details';
import { ERROR_CATALOG } from '../errors/error-catalog';
import { getTraceId } from '../tracing/context';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public retryable: boolean = false,
    public metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const traceId = getTraceId() || 'unknown';

  if (err instanceof AppError) {
 const catalogEntry = ERROR_CATALOG[err.code];
    const problem: VectorizationProblemDetails = {
      type: catalogEntry?.type || 'https://api.example.com/errors/unknown',
      title: catalogEntry?.title || 'Unknown Error',
      status: err.status,
      detail: err.message,
      instance: req.originalUrl,
      errorCode: err.code,
      retryable: err.retryable,
      traceId,
      timestamp: new Date().toISOString(),
      ...err.metadata,
    };

    if (err.retryable) {
      problem.retryAfter = 5; // Suggest 5 second retry
    }

    return res.status(err.status).json(problem);
  }

  // Unhandled errors — generic 500
  const problem: VectorizationProblemDetails = {
    type: 'https://api.example.com/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    instance: req.originalUrl,
    errorCode: 'service/internal-error',
    retryable: false,
    traceId,
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(problem);
}
```

### 6.4 Example Error Response

```json
{
  "type": "https://api.example.com/errors/ai-rate-limited",
  "title": "AI Provider Rate Limit Exceeded",
  "status": 429,
  "detail": "Rate limit exceeded for GPT-4o. Please retry after 5 seconds.",
  "instance": "/api/v1/vectorize",
  "errorCode": "ai/rate-limited",
  "retryable": true,
  "retryAfter": 5,
  "traceId": "abc-123-def-456",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 7. Health Check Endpoint Design

### 7.1 Kubernetes Probe Configuration [^26^] [^29^]

Kubernetes uses three probe types:

| Probe | Purpose | Failure Action | Typical Config |
|-------|---------|---------------|----------------|
| **Liveness** | Is the process alive? | Restart container | `periodSeconds: 10`, `failureThreshold: 3` |
| **Readiness** | Can it handle traffic? | Remove from service | `periodSeconds: 5`, `failureThreshold: 2` |
| **Startup** | Has it finished starting? | Wait before liveness | `failureThreshold: 30`, `periodSeconds: 5` |

### 7.2 Comprehensive Health Checker Implementation

```typescript
// health/health-checker.ts
import EventEmitter from 'events';

interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  critical: boolean;
  timeout: number;
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  latency?: number;
  [key: string]: any;
}

interface HealthReport {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: Record<string, HealthCheckResult>;
}

export class HealthChecker extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private isShuttingDown = false;

  register(check: HealthCheck) {
    this.checks.set(check.name, check);
  }

  async getLiveness(): Promise<HealthReport> {
    const memUsage = process.memoryUsage();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        process: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024),
          },
        },
      },
    };
  }

  async getReadiness(): Promise<HealthReport> {
    if (this.isShuttingDown) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          shuttingDown: {
            status: 'unhealthy',
            message: 'Service is shutting down',
          },
        },
      };
    }

    const results: Record<string, HealthCheckResult> = {};
    let overallStatus: HealthReport['status'] = 'healthy';

    await Promise.all(
      Array.from(this.checks.values()).map(async (check) => {
        const start = Date.now();
        try {
          const result = await Promise.race([
            check.check(),
            new Promise<HealthCheckResult>((_, reject) =>
              setTimeout(
                () => reject(new Error('Health check timeout')),
                check.timeout
              )
            ),
          ]);
          result.latency = Date.now() - start;
          results[check.name] = result;

          if (check.critical && result.status === 'unhealthy') {
            overallStatus = 'unhealthy';
          } else if (result.status === 'degraded' && overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        } catch (error: any) {
          results[check.name] = {
            status: 'unhealthy',
            message: error.message,
            latency: Date.now() - start,
          };
          if (check.critical) {
            overallStatus = 'unhealthy';
          }
        }
      })
    );

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }

  setShuttingDown() {
    this.isShuttingDown = true;
  }
}
```

### 7.3 Express Routes and Kubernetes Config

```typescript
// health/routes.ts
import { Router } from 'express';
import { HealthChecker } from './health-checker';

export function createHealthRoutes(health: HealthChecker): Router {
  const router = Router();

  // Liveness probe — simple process check
  router.get('/live', async (req, res) => {
    const status = await health.getLiveness();
    res.status(status.status === 'healthy' ? 200 : 500).json(status);
  });

  // Readiness probe — dependency checks
  router.get('/ready', async (req, res) => {
    const status = await health.getReadiness();
    res.status(status.status === 'healthy' ? 200 : 503).json(status);
  });

  // Comprehensive health — for debugging/monitoring
  router.get('/', async (req, res) => {
    const [liveness, readiness] = await Promise.all([
      health.getLiveness(),
      health.getReadiness(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      liveness,
      readiness,
    });
  });

  return router;
}
```

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vectorization-service
spec:
  replicas: 3
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: app
          image: vectorization-service:latest
          ports:
            - containerPort: 3000

          # Startup probe — wait for slow initialization
          startupProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 30  # 150 seconds max startup

          # Liveness probe — is process alive?
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          # Readiness probe — can handle traffic?
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2
            successThreshold: 1

          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 5"]  # Allow LB to remove pod

          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
```

### 7.4 Best Practices [^26^]

1. **Never check external dependencies in liveness probes** — If the DB is down, restarting the pod won't fix it.
2. **Keep probes fast** — Use `SELECT 1` for DB checks, not expensive queries.
3. **Return 503 during shutdown** — Failing readiness removes pod from the service immediately.
4. **Use `preStop` hook** — Sleep 5-10 seconds to allow the load balancer to stop routing traffic.

---

## 8. Request Context Tracking with AsyncLocalStorage

### 8.1 Why AsyncLocalStorage? [^54^]

AsyncLocalStorage (ALS) provides a per-request "box" that follows the asynchronous flow across `async/await`, promises, callbacks, and event emitters. It eliminates the need to pass `reqId` through every function signature.

### 8.2 Implementation

```typescript
// context/context.ts
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  reqId: string;
  traceId: string;
  spanId: string;
  startTime: number;
  userId?: string;
  [key: string]: any;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getTraceId(): string | undefined {
  return getContext()?.traceId;
}

export function getReqId(): string | undefined {
  return getContext()?.reqId;
}

export function setContextValue(key: string, value: any) {
  const store = getContext();
  if (store) {
    store[key] = value;
  }
}
```

### 8.3 Express Middleware

```typescript
// context/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runWithContext, RequestContext } from './context';

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  const reqId = req.headers['x-request-id'] || uuidv4();

  // Set response headers for traceability
  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('X-Request-ID', reqId);

  const context: RequestContext = {
    reqId,
    traceId: traceId as string,
    spanId: uuidv4(),
    startTime: Date.now(),
    userId: req.user?.id,
    method: req.method,
    path: req.path,
  };

  runWithContext(context, () => {
    // Log request completion with timing
    res.on('finish', () => {
      const duration = Date.now() - context.startTime;
      console.log(JSON.stringify({
        level: 'info',
        traceId,
        reqId,
        message: 'Request completed',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      }));
    });

    next();
  });
}
```

### 8.4 Context-Aware Logger

```typescript
// context/logger.ts
import pino from 'pino';
import { getContext } from './context';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
});

export function getLogger() {
  const ctx = getContext();
  if (!ctx) return baseLogger;

  return baseLogger.child({
    reqId: ctx.reqId,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
  });
}

// Usage anywhere in the call stack:
// getLogger().info('Processing image');
// getLogger().error({ err }, 'Vectorization failed');
```

### 8.5 Production Tips [^54^]

1. **Keep store small** — Only store IDs, flags, and small metadata. Don't store large objects or DB connections.
2. **Guard against undefined** — Always use `getStore()` defensively in shared helpers.
3. **Monitor memory** — Watch for memory leaks when enabling ALS in busy apps.
4. **Test edge cases** — Test with timers, streaming responses, and event emitters.

---

## 9. Graceful Shutdown

### 9.1 Shutdown Manager [^51^] [^52^] [^53^]

```typescript
// shutdown/shutdown-manager.ts
import http from 'http';
import { HealthChecker } from '../health/health-checker';

interface ShutdownOptions {
  server: http.Server;
  health: HealthChecker;
  cleanupHandlers?: Array<() => Promise<void>>;
  forceExitTimeoutMs?: number;
  drainWaitMs?: number;
}

export class ShutdownManager {
  private isShuttingDown = false;
  private server: http.Server;
  private health: HealthChecker;
  private cleanupHandlers: Array<() => Promise<void>>;
  private forceExitTimeoutMs: number;
  private drainWaitMs: number;

  constructor(options: ShutdownOptions) {
    this.server = options.server;
    this.health = options.health;
    this.cleanupHandlers = options.cleanupHandlers || [];
    this.forceExitTimeoutMs = options.forceExitTimeoutMs || 25000;
    this.drainWaitMs = options.drainWaitMs || 5000;

    // Register signal handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // Unhandled error guard — don't silently swallow
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection — initiating shutdown', reason);
      this.shutdown('unhandledRejection');
    });
    
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception — initiating shutdown', err);
      this.shutdown('uncaughtException');
    });
  }

  private async shutdown(signal: string) {
    // Prevent double shutdown
    if (this.isShuttingDown) {
      console.log(`Shutdown already in progress (ignoring ${signal})`);
      return;
    }
    this.isShuttingDown = true;

    console.log(`[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);

    // 1. Immediately fail readiness so K8s stops sending traffic
    this.health.setShuttingDown();

    // 2. Wait for load balancer to stop routing (preStop hook handles this too)
    await this.sleep(this.drainWaitMs);

    // 3. Set forced exit timeout
    const forceExitTimer = setTimeout(() => {
      console.error('[SHUTDOWN] Forced exit — shutdown timed out');
      process.exit(1);
    }, this.forceExitTimeoutMs);
    
    // Allow process to exit naturally if cleanup completes before timeout
    forceExitTimer.unref();

    try {
      // 4. Stop accepting new connections
      await new Promise<void>((resolve, reject) => {
        this.server.close((err) => {
          if (err) reject(err);
          else {
            console.log('[SHUTDOWN] HTTP server closed');
            resolve();
          }
        });
      });

      // 5. Run cleanup handlers in reverse order (dependencies last)
      for (const handler of [...this.cleanupHandlers].reverse()) {
        await handler();
      }

      console.log('[SHUTDOWN] Graceful shutdown complete');
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      console.error('[SHUTDOWN] Error during shutdown:', error);
      process.exit(1);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}
```

### 9.2 Integration

```typescript
// app.ts
import express from 'express';
import http from 'http';
import { HealthChecker } from './health/health-checker';
import { ShutdownManager } from './shutdown/shutdown-manager';

const app = express();
const health = new HealthChecker();

// Register health checks
health.register({
  name: 'database',
  check: async () => {
    await dbPool.query('SELECT 1');
    return { status: 'healthy' };
  },
  critical: true,
  timeout: 3000,
});

health.register({
  name: 'ai-provider',
  check: async () => {
    await aiClient.healthCheck();
    return { status: 'healthy' };
  },
  critical: false, // Non-critical — can degrade gracefully
  timeout: 5000,
});

const server = http.createServer(app);

// Initialize shutdown manager
new ShutdownManager({
  server,
  health,
  cleanupHandlers: [
    async () => await dbPool.end(),
    async () => await redisClient.quit(),
    async () => await jobQueue.close(),
  ],
  forceExitTimeoutMs: 25000,
  drainWaitMs: 5000,
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```

### 9.3 Shutdown Best Practices [^58^]

1. **Always set a forced exit timeout** — Set it a few seconds less than `terminationGracePeriodSeconds`.
2. **Use a shutdown flag** — Prevent double-shutdown and reject new work immediately.
3. **Shut down in reverse dependency order** — HTTP server first, then workers, then caches, then DB.
4. **Call `timer.unref()` on forced exit timers** — Prevents timer from keeping event loop alive.
5. **Test under load** — Test SIGTERM with active requests and open transactions.

---

## 10. Error Monitoring Integration

### 10.1 Sentry Integration [^55^] [^87^]

```typescript
// monitoring/sentry.ts
import * as Sentry from '@sentry/node';
import { RequestContext } from '../context/context';

export function initializeSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.SERVICE_VERSION,
    
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Integrations
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    
    // Before sending, filter out known transient errors
    beforeSend(event, hint) {
      const error = hint.originalException as any;
      
      // Don't report 4xx client errors
      if (error?.status >= 400 && error?.status < 500) {
        return null;
      }
      
      // Don't report rate limit errors unless circuit breaker is open
      if (error?.code === 'AI_RATE_LIMIT') {
        return null;
      }
      
      return event;
    },
  });
}

export function setSentryContext(ctx: RequestContext) {
  Sentry.setContext('request', {
    reqId: ctx.reqId,
    traceId: ctx.traceId,
    userId: ctx.userId,
  });
  Sentry.setTag('traceId', ctx.traceId);
}

export function captureError(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

// Add breadcrumbs for request tracing
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}
```

### 10.2 Error Handler with Sentry Integration

```typescript
// middleware/sentry-error-handler.ts
import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { AppError } from './error-handler';

export function sentryErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Set request context for Sentry
  Sentry.setContext('request', {
    url: req.originalUrl,
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  // Add breadcrumb
  Sentry.addBreadcrumb({
    category: 'request',
    message: `${req.method} ${req.originalUrl}`,
    data: { statusCode: res.statusCode },
  });

  // Capture exception
  if (!(err instanceof AppError && !err.retryable)) {
    // Only capture unexpected or retryable errors
    Sentry.captureException(err);
  }

  next(err); // Pass to next error handler
}
```

### 10.3 Sentry Best Practices [^86^]

1. **Use separate Sentry projects** per environment (dev, staging, production).
2. **Add breadcrumbs** for user actions leading up to errors.
3. **Configure alerts** via Slack, PagerDuty, or email for critical issues.
4. **Filter out expected errors** in `beforeSend` to reduce noise.
5. **Track releases** to correlate errors with deployments.
6. **Include source maps** for readable stack traces in production.

---

## 11. Timeout and Deadline Patterns

### 11.1 AbortController for Request Cancellation [^64^]

Node.js provides native `AbortController` and `AbortSignal` for consistent cancellation across async operations.

```typescript
// utils/timeout.ts
export interface TimeoutOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

export function createTimeoutSignal(timeoutMs: number, parentSignal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  
  // Clean up timeout if parent signal aborts
  if (parentSignal) {
    parentSignal.addEventListener('abort', () => {
      clearTimeout(timeout);
      controller.abort(parentSignal.reason);
    });
    
    // Also abort if parent is already aborted
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    }
  }
  
  // Clean up when signal is aborted by other means
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timeout);
  });
  
  return controller.signal;
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
```

### 11.2 Deadline Propagation

```typescript
// utils/deadline.ts
import { RequestContext, getContext } from '../context/context';

export function getRemainingDeadline(): number | undefined {
  const ctx = getContext();
  if (!ctx) return undefined;
  
  const elapsed = Date.now() - ctx.startTime;
  const totalDeadline = 30000; // 30 second global deadline
  const remaining = totalDeadline - elapsed;
  
  return Math.max(0, remaining - 2000); // 2s buffer for cleanup
}

export async function withDeadline<T>(
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const remaining = getRemainingDeadline();
  if (remaining === undefined) {
    return fn(new AbortController().signal);
  }
  
  if (remaining <= 0) {
    throw new Error('Deadline exceeded');
  }
  
  return withTimeout(fn, remaining);
}
```

### 11.3 Integration with Express

```typescript
// middleware/timeout.ts
import { Request, Response, NextFunction } from 'express';

export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const controller = new AbortController();
    
    const timeout = setTimeout(() => {
      controller.abort();
      if (!res.headersSent) {
        res.status(504).json({
          type: 'https://api.example.com/errors/timeout',
          title: 'Request Timeout',
          status: 504,
          detail: `Request exceeded ${timeoutMs}ms deadline`,
        });
      }
    }, timeoutMs);

    // Clean up on response sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
      controller.abort();
    });

    // Attach signal to request for downstream use
    (req as any).abortSignal = controller.signal;
    
    next();
  };
}
```

---

## 12. Bulkhead Pattern

### 12.1 Implementation with Cockatiel [^61^]

The bulkhead pattern isolates critical resources to prevent failures in one area from affecting others [^27^].

```typescript
// bulkhead/resource-isolation.ts
import { bulkhead, BulkheadPolicy } from 'cockatiel';

// Separate bulkheads for different operations
export const vectorizationBulkhead: BulkheadPolicy = bulkhead(5, 20);  // 5 concurrent, 20 queued
export const validationBulkhead: BulkheadPolicy = bulkhead(10, 50);    // 10 concurrent, 50 queued
export const storageBulkhead: BulkheadPolicy = bulkhead(8, 30);        // 8 concurrent, 30 queued

// Usage
export async function vectorizeWithIsolation(
  image: ImageInput
): Promise<VectorizationResult> {
  return vectorizationBulkhead.execute(() => performVectorization(image));
}
```

### 12.2 Custom Bulkhead Implementation

For cases requiring more control:

```typescript
// bulkhead/custom-bulkhead.ts
import EventEmitter from 'events';

interface BulkheadOptions {
  maxConcurrent: number;
  maxQueue: number;
  timeout: number;
}

export class CustomBulkhead extends EventEmitter {
  private running = 0;
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(private options: BulkheadOptions) {
    super();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.options.maxConcurrent) {
      return this.runTask(fn);
    }

    if (this.queue.length >= this.options.maxQueue) {
      throw new Error('Bulkhead queue full');
    }

    return new Promise<T>((resolve, reject) => {
      const queued = {
        fn,
        resolve,
        reject,
      };
      this.queue.push(queued);

      // Timeout queued task
      setTimeout(() => {
        const index = this.queue.indexOf(queued);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error('Bulkhead queue timeout'));
        }
      }, this.options.timeout);
    });
  }

  private async runTask<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    this.emit('execution', { running: this.running, queued: this.queue.length });

    try {
      return await fn();
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.queue.length > 0 && this.running < this.options.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        this.runTask(next.fn).then(next.resolve).catch(next.reject);
      }
    }
  }

  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.options.maxConcurrent,
      maxQueue: this.options.maxQueue,
    };
  }
}
```

### 12.3 Bulkhead Configuration Summary

```typescript
// config/bulkhead-config.ts
export const BULKHEAD_CONFIG = {
  vectorization: {
    maxConcurrent: 5,    // Max 5 concurrent vectorizations (AI API limit)
    maxQueue: 20,        // Queue up to 20 requests
    timeout: 60000,      // 60s timeout per operation
  },
  imageProcessing: {
    maxConcurrent: 10,   // CPU-bound, limited by cores
    maxQueue: 50,
    timeout: 30000,
  },
  storage: {
    maxConcurrent: 20,   // I/O bound, higher concurrency
    maxQueue: 100,
    timeout: 15000,
  },
};
```

---

## 13. Complete Integration Architecture

### 13.1 Dependency Stack

| Library | npm Package | Version | Purpose |
|---------|------------|---------|---------|
| **p-retry** | `p-retry` | ^6.2.0 | Retry with exponential backoff |
| **cockatiel** | `cockatiel` | ^3.2.0 | Circuit breaker + bulkhead + timeout |
| **opossum** | `opossum` | ^8.1.0 | Alternative circuit breaker (optional) |
| **pino** | `pino` | ^9.0.0 | Structured logging |
| **@sentry/node** | `@sentry/node` | ^8.0.0 | Error monitoring |
| **prom-client** | `prom-client` | ^15.0.0 | Prometheus metrics |
| **uuid** | `uuid` | ^9.0.0 | Request ID generation |
| **express** | `express` | ^4.19.0 | Web framework |
| **zod** | `zod` | ^3.23.0 | Request validation |

### 13.2 Complete Service Integration

```typescript
// services/vectorization-orchestrator.ts
import { wrap, retry, circuitBreaker, bulkhead, timeout, TimeoutStrategy } from 'cockatiel';
import { ConsecutiveBreaker, ExponentialBackoff, handleAll } from 'cockatiel';
import pRetry from 'p-retry';
import { getLogger } from '../context/logger';
import { ErrorCode } from '../errors/error-codes';

// Composed resilience policy
const policy = wrap(
  bulkhead(5, 20), // Max 5 concurrent, 20 queued
  circuitBreaker(handleAll, {
    halfOpenAfter: 30_000,
    breaker: new ConsecutiveBreaker(5),
  }),
  retry(handleAll, {
    maxAttempts: 3,
    backoff: new ExponentialBackoff({ initialDelay: 500, maxDelay: 30000 }),
  }),
  timeout(30_000, TimeoutStrategy.Cooperative)
);

export class VectorizationOrchestrator {
  async vectorize(request: VectorizationRequest): Promise<VectorizationResult> {
    const logger = getLogger();
    
    try {
      // Step 1: Validate input (no retry — client error)
      const validated = await this.validateInput(request);
      
      // Step 2: Process image with resilience
      const processedImage = await policy.execute(({ signal }) =>
        this.imageProcessor.process(validated.image, { signal })
      );
      
      // Step 3: Call AI provider with retry
      const vectorization = await this.callAIProvider(processedImage);
      
      // Step 4: Validate SVG output
      const svgResult = await policy.execute(({ signal }) =>
        this.svgValidator.validate(vectorization.svg, { signal })
      );
      
      return {
        svg: svgResult.svg,
        metadata: vectorization.metadata,
      };
      
    } catch (error: any) {
      logger.error({ err: error }, 'Vectorization failed');
      throw this.classifyError(error);
    }
  }

  private async callAIProvider(image: ProcessedImage): Promise<AIResult> {
    // Use p-retry for AI-specific retry with Retry-After header support
    return pRetry(
      async () => this.aiClient.vectorize(image),
      {
        retries: 5,
        minTimeout: 2000,
        maxTimeout: 60000,
        factor: 2,
        randomize: true,
        onFailedAttempt: (error: any) => {
          getLogger().warn({
            attempt: error.attemptNumber,
            message: error.message,
          }, 'AI provider call failed, retrying');
        },
        retryIf: (error: any) => {
          // Only retry transient errors
          return error.code === ErrorCode.AI_PROVIDER_TIMEOUT ||
                 error.code === ErrorCode.AI_PROVIDER_RATE_LIMIT ||
                 error.code === ErrorCode.AI_PROVIDER_OVERLOADED ||
                 (error.status >= 500 && error.status < 600);
        },
      }
    );
  }

  private classifyError(error: any): AppError {
    if (error.code) return error; // Already classified
    
    if (error.name === 'TimeoutError') {
      return new AppError(
        ErrorCode.AI_PROVIDER_TIMEOUT,
        'AI provider call timed out',
        504,
        true
      );
    }
    
    if (error.message?.includes('rate limit')) {
      return new AppError(
        ErrorCode.AI_PROVIDER_RATE_LIMIT,
        'AI provider rate limit exceeded',
        429,
        true
      );
    }
    
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred',
      500,
      false
    );
  }
}
```

### 13.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Timeout     │  │   Request    │  │   Rate Limiter       │   │
│  │  Middleware  │  │   Context    │  │   (rate-limiter-     │   │
│  │  (30s)       │  │   (AsyncLocal│  │    flexible)         │   │
│  └──────────────┘  │   Storage)   │  └──────────────────────┘   │
│                    └──────────────┘                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  Vectorization Orchestrator                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Bulkhead   │  │   Circuit    │  │   Retry (p-retry)    │   │
│  │   (5 conc.)  │  │   Breaker    │  │   3 attempts         │   │
│  └──────────────┘  │   (5 consec. │  │   exponential        │   │
│                    │   failures)  │  │   backoff + jitter   │   │
│                    └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Graceful Degradation Levels                  │    │
│  │  FULL → REDUCED (simpler model) → MINIMAL (cache)       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Image      │  │   AI Client  │  │   SVG Validator      │   │
│  │   Processor  │  │   (GPT-4o)   │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     Observability Layer                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Sentry     │  │  Prometheus  │  │   Health Checks      │   │
│  │   Errors     │  │   Metrics    │  │   /live /ready       │   │
│  │   Traces     │  │   Alerts     │  │   /health            │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 13.4 Key npm Dependencies

```json
{
  "dependencies": {
    "express": "^4.19.0",
    "p-retry": "^6.2.0",
    "cockatiel": "^3.2.0",
    "pino": "^9.0.0",
    "@sentry/node": "^8.0.0",
    "prom-client": "^15.0.0",
    "uuid": "^9.0.0",
    "zod": "^3.23.0",
    "rate-limiter-flexible": "^5.0.0"
  },
  "optionalDependencies": {
    "opossum": "^8.1.0",
    "opossum-prometheus": "^0.1.0"
  }
}
```

---

## Key Recommendations Summary

| Pattern | Library | Priority |
|---------|---------|----------|
| Retry | `p-retry` + custom `retryIf` | Required |
| Circuit Breaker | `cockatiel` (composable) | Required |
| Bulkhead | `cockatiel` bulkhead | Required |
| Timeout | `cockatiel` timeout + `AbortController` | Required |
| Structured Errors | RFC 7807 Problem Details | Required |
| Health Checks | Custom `HealthChecker` class | Required |
| Context Tracking | `AsyncLocalStorage` | Required |
| Graceful Shutdown | `ShutdownManager` class | Required |
| Error Monitoring | `@sentry/node` | Required |
| Logging | `pino` + correlation IDs | Required |
| Graceful Degradation | Custom degradation levels | Recommended |
| Self-Healing | `SelfHealingService` class | Recommended |

---

## Citations

[^24^] Dev.to - "Node.js Circuit Breaker Pattern in Production: Opossum, Fallbacks, and Resilience Engineering" (2026)

[^25^] PkgPulse - "p-retry vs async-retry vs exponential-backoff" (2026)

[^26^] OneUptime - "How to Implement Health Checks and Readiness Probes in Node.js for Kubernetes" (2026)

[^27^] GitHub - "Self-Healing-Microservices-Demo: Circuit Breakers, Bulkheads, and Auto-Recovery patterns" (2025)

[^28^] GitHub - "nodeshift/opossum: Node.js circuit breaker" (2025)

[^29^] Dev.to - "Kubernetes Liveness vs Readiness Probes: What They Actually Mean" (2025)

[^30^] ProblemDetails.io - "Problem Details Test API" (RFC 7807 reference)

[^51^] Dev.to - "Node.js Graceful Shutdown: How to Stop Dropping Requests in Production" (2026)

[^52^] Dev.to - "Graceful Shutdown in Node.js: Stop Dropping Requests" (2026)

[^53^] Dev.to - "SIGTERM, In-Flight Draining, and Zero-Downtime Deploys" (2026)

[^54^] UsamaAmjid.com - "AsyncLocalStorage in Node.js 24" (2026)

[^55^] NamasteDev - "Effective Error Tracking with Sentry in JavaScript Apps" (2026)

[^56^] Reddit r/node - "Deep dive into graceful shutdowns in node.js" (2026)

[^57^] Dev.to - "Zero-Boilerplate Request ID Tracing in Node.js with pino-correlation-id" (2026)

[^58^] GrizzlyPeakSoftware - "Graceful Shutdown in Node.js Applications" (2026)

[^59^] Medium - "Understanding Async Hooks in Node.js" (2025)

[^60^] OneUptime - "How to Build Request Tracing in Node.js" (2026)

[^61^] Dev.to - "Implementing the Bulkhead Pattern in Node.js" (2025)

[^77^] Dev.to - "From Resilience4j to TypeScript: Cockatiel" (2026)

[^79^] PkgPulse - "p-retry vs async-retry vs exponential-backoff 2026" (2026)

[^80^] SRE School - "Comprehensive Tutorial on Graceful Degradation in SRE" (2025)

[^81^] Dev.to - "Retrying Failed Requests with Exponential Backoff" (2025)

[^82^] npm - "cockatiel package README" (2024)

[^84^] Medium - "Key patterns for resiliency in Microservices Architecture" (2024)

[^86^] Medium - "Enhancing Error Tracking: Integrating Sentry in Node.js" (2023)

[^87^] Sentry Docs - "Breadcrumbs | Sentry for Node.js"

[^88^] Presidio - "Exponential Backoff with Jitter: A Powerful Tool" (2023)
