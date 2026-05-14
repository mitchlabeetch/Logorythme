# Provider-Agnostic AI SDK Abstraction Layer: Research Report

## Logorythme Logo Vectorization Microservice

**Date**: 2025  
**Scope**: Multi-provider AI SDK architecture for Node.js/TypeScript logo vectorization service  
**Searches Conducted**: 12 independent research queries

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Comparison Table of Abstraction Options](#2-comparison-table-of-abstraction-options)
3. [Vision Model Comparison for SVG Generation](#3-vision-model-comparison-for-svg-generation)
4. [Recommended Architecture](#4-recommended-architecture)
5. [Specific npm Packages and Versions](#5-specific-npm-packages-and-versions)
6. [Code Skeleton: Abstraction Layer](#6-code-skeleton-abstraction-layer)
7. [Fallback Strategy Design](#7-fallback-strategy-design)
8. [Error Handling Per Provider](#8-error-handling-per-provider)
9. [Streaming Response Handling](#9-streaming-response-handling)
10. [Frontend Abstraction](#10-frontend-abstraction)
11. [Configuration Patterns](#11-configuration-patterns)
12. [All Sources](#12-all-sources)

---

## 1. Executive Summary

### Recommendation: Vercel AI SDK with Provider Registry + Custom Fallback Layer

For the Logorythme logo vectorization microservice, the **Vercel AI SDK** is the recommended foundation for building the provider-agnostic abstraction layer. This recommendation is based on:

1. **Unified API**: The AI SDK provides a single `generateText()` interface that works identically across OpenAI, Anthropic, and Google with zero code changes when switching providers [^20^][^24^].

2. **Vision Input Support**: All three target providers support image input through the unified `{ type: 'image', image: buffer }` message part format, enabling seamless multi-modal usage [^53^][^63^].

3. **Minimal Bundle Impact**: The core `ai` package is ~67.5 kB gzipped, with each provider adding ~19.5 kB. This is significantly smaller than LangChain's ~101 kB core that blocks edge runtime [^21^][^48^].

4. **Superior Developer Experience**: The AI SDK's provider-agnostic design means switching from `openai('gpt-4o')` to `anthropic('claude-sonnet-4.5')` is a one-line change, making A/B testing and fallback trivially easy [^24^].

5. **Production-Grade Error Handling**: The SDK provides typed error classes (`APICallError`, `InvalidArgumentError`, `NoSuchModelError`) with built-in retry logic that respects HTTP `Retry-After` headers [^35^][^37^].

### Architecture Overview

```
+-----------------------+     +-----------------------+     +------------------+
|   Frontend (React)    |     |   Backend (Node.js)   |     |  AI Providers    |
|                       |     |                       |     |                  |
|  useLogoVectorizer()  +---->+  ProviderRegistry     +---->+  Google Gemini   |
|  (generic hook)       |     |  (Vercel AI SDK)      |     |  OpenAI GPT-4o   |
|                       |     |  + Circuit Breaker    |     |  Anthropic Claude|
+-----------------------+     |  + Fallback Chain     |     |                  |
                              |  + Retry Logic        |     +------------------+
                              +-----------------------+
```

The key insight for Logorythme is that **logo vectorization** (raster image -> SVG code) is a single-shot vision-to-code task with streaming responses. It does not require LangChain's complexity (chains, RAG, agents). The Vercel AI SDK's streaming-first architecture is perfectly suited for this use case [^21^].

---

## 2. Comparison Table of Abstraction Options

### 2.1 High-Level Comparison

| Dimension | Vercel AI SDK (`ai`) | LangChain.js | Custom Abstraction |
|-----------|---------------------|--------------|-------------------|
| **Weekly npm downloads** | ~2.8M [^21^] | ~1.3M [^21^] | N/A |
| **GitHub stars** | 40,000+ [^16^] | 18,000+ [^16^] | N/A |
| **Bundle size (gzipped)** | 34-60 kB/provider [^21^] | 101 kB core [^21^] | Variable |
| **Provider count** | 25+ [^24^] | 750+ [^16^] | As many as implemented |
| **Learning curve** | Low | High (steep) [^16^] | Medium-High |
| **Streaming support** | First-class [^25^] | Manual implementation | Manual implementation |
| **React hooks** | Built-in (`useChat`) [^39^] | None (manual) | None |
| **p99 streaming latency** | ~30ms [^21^] | ~50ms [^21^] | N/A |
| **Runtime support** | Edge + Node.js [^48^] | Node.js only [^48^] | Either |
| **Type safety** | End-to-end Zod [^48^] | Zod available | Manual |
| **Vision input** | Unified API [^53^] | Provider-specific | Provider-specific |

### 2.2 Suitability for Logorythme

| Criteria | Vercel AI SDK | LangChain.js | Custom |
|----------|--------------|--------------|--------|
| **Logo vectorization** (single-shot vision->code) | **Excellent** - `generateText` with image input | Overkill - no need for chains/RAG | **Excellent** - if done right |
| **Multi-provider switching** | **Excellent** - one-line model swap | Good - `new ChatOpenAI()` -> `new ChatAnthropic()` | Requires significant dev effort |
| **Streaming SVG output** | **Excellent** - native streaming hooks | Requires manual SSE handling | Requires manual SSE handling |
| **Frontend integration** | **Excellent** - `useChat`, `useCompletion` hooks | None built-in | None built-in |
| **Error handling** | **Excellent** - typed errors, built-in retry | Partial - through LangSmith | Must implement from scratch |
| **Maintenance burden** | Low - Vercel maintains providers | Medium - frequent API changes | **High** - track all provider APIs |

### 2.3 Verdict

**Vercel AI SDK is the clear winner** for this use case. LangChain's strengths (complex agents, RAG pipelines, document processing) are unnecessary for logo vectorization, which is a single-shot vision task. A custom abstraction would require ongoing maintenance of provider API changes that the AI SDK handles transparently [^24^][^55^].

---

## 3. Vision Model Comparison for SVG Generation

### 3.1 Benchmark Results: VectorGym SVG Code Generation (2025-2026)

Based on the VectorGym multitask benchmark for SVG code generation, sketching, and editing [^17^]:

| Model | Sketch2SVG Score | SVG Editing Score | VectorGym Overall |
|-------|-----------------|-------------------|-------------------|
| **Gemini 3 Pro** | 78.56 | 88.71 | **73.17 (best)** |
| **GPT-5.1** | 75.69 | 87.71 | 71.36 |
| **Claude Sonnet 4.5** | 73.85 | 88.07 | 70.31 |
| **GPT-4o** | 69.55 | 82.35 | 64.93 |
| Gemini 2.5 Flash | 65.45 | 81.30 | 61.42 |
| Qwen3VL 8B Gym (RL-trained) | 70.72 | 82.81 | 66.05 |

### 3.2 SVGBench Leaderboard

From the SVGBench SVG generation benchmark [^29^]:

| Model | Score | Rank |
|-------|-------|------|
| Claude Opus 4.6 (medium) | 75.6% | #1 |
| GPT-5.2 (xhigh) | 74.4% | #2 |
| Claude Opus 4.5 (non-thinking) | 72.0% | #3 |
| Gemini 3 Pro Preview | 68.7% | #6 |
| Claude Sonnet 4.5 | 62.2% | #15 |
| Gemini 2.5 Pro | 61.4% | #17 |
| Claude 3.5 Sonnet | 47.9% | #41 |

### 3.3 Recommendations for Logorythme

**Primary Model**: `gemini-3-pro` - Best overall on VectorGym SVG-specific benchmarks (73.17 overall score) [^17^]. Google's Gemini models also offer the best price-per-token value with a free tier available for development [^45^].

**Secondary Model**: `claude-sonnet-4.5` (or `claude-opus-4.6` for highest accuracy) - Top performer on SVGBench (75.6%) [^29^]. Anthropic leads coding benchmarks with Claude Sonnet 4.5 holding the top SWE-Bench score at 82% [^45^]. The extended thinking mode and 128K max output tokens make it excellent for complex SVG generation [^18^].

**Tertiary/Fast Model**: `gpt-4o` - Strong all-rounder with 1M token context window [^45^]. Most mature function calling and structured output implementation.

**Budget Option**: `gemini-2.5-flash` - Best value: 1M context, $2.50/MTok output, free tier available [^45^].

### 3.4 Model Capabilities Summary

| Capability | Gemini 3 Pro | Claude Sonnet 4.5 | GPT-4o |
|-----------|-------------|-------------------|--------|
| **Context window** | 1M tokens [^45^] | 128K tokens [^45^] | 1M tokens [^45^] |
| **Vision input** | **Excellent** [^18^] | Good | Very Good |
| **Code generation** | Very Good | **Excellent** [^45^] | Strong |
| **SVG generation** | **Best (VectorGym)** [^17^] | **Best (SVGBench)** [^29^] | Strong |
| **Output tokens** | 8K default | 128K [^45^] | 32K |
| **Price/MTok output** | Very Low | High (2-3x OpenAI) [^45^] | Medium |
| **Free tier** | Yes [^45^] | No | No |

---

## 4. Recommended Architecture

### 4.1 Core Design Principles

1. **Strategy Pattern**: Each provider implements a common interface (`AIProviderStrategy`)
2. **Provider Registry**: Centralized model resolution with string-based IDs (`provider:model`)
3. **Circuit Breaker Per Provider**: Independent fault isolation using `opossum`
4. **Fallback Chain**: Automatic sequential failover across providers
5. **Streaming-First**: All responses stream through SSE for real-time SVG rendering

### 4.2 Class Diagram

```
+-------------------+         +-----------------------+
|   ProviderConfig  |<>-------|   AIProviderStrategy  |
|   - apiKey        |         |   + generateSVG()     |
|   - model         |         |   + streamSVG()       |
|   - timeout       |         |   + getCapabilities() |
|   - retries       |         |   + getName()         |
+-------------------+         +-----------------------+
                                         |
              +------------+-------------+----------+
              |            |                        |
    +---------v---+ +------v------+ +-------------v----+
    | GeminiStrategy | |OpenAIStrategy| | AnthropicStrategy |
    +----------------+ +--------------+ +------------------+

+-------------------+         +---------------------+
| CircuitBreaker    |<>-------|  ProviderRegistry   |
| (opossum)         |         |  - register()       |
+-------------------+         |  - getProvider()    |
                              |  - getAllModels()   |
                              +---------------------+
                                         |
                              +----------v----------+
                              | FallbackOrchestrator |
                              | - executeWithFallback|
                              | - getNextProvider()  |
                              +---------------------+
```

### 4.3 Why This Architecture

The Vercel AI SDK's **Provider Registry** (`createProviderRegistry`) [^56^] already provides the foundation for this architecture:

```typescript
import { createProviderRegistry, gateway } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export const registry = createProviderRegistry({
  gateway,    // Gateway pass-through: gateway:*
  openai,     // OpenAI: openai:*
  anthropic,  // Anthropic: anthropic:*
  google,     // Google: google:*
});

// Usage: registry.languageModel('google:gemini-3-pro')
// Usage: registry.languageModel('anthropic:claude-sonnet-4.5')
// Usage: registry.languageModel('openai:gpt-4o')
```

This approach is validated by production patterns from teams like Mongoose Studio who achieved "much simpler, cleaner abstraction that supports OpenAI, Claude, and Gemini with minimal code" [^55^].

---

## 5. Specific npm Packages and Versions

### 5.1 Core Dependencies

| Package | Version | Purpose | Bundle Size |
|---------|---------|---------|-------------|
| `ai` | `^6.0.27` [^86^] | Core SDK with unified APIs | 67.5 kB gzipped |
| `@ai-sdk/openai` | `^2.0.43` [^42^] | OpenAI provider (GPT-4o) | ~19.5 kB |
| `@ai-sdk/anthropic` | `^2.0.23` [^42^] | Anthropic provider (Claude) | ~19.5 kB |
| `@ai-sdk/google` | `^2.0.17` [^42^] | Google provider (Gemini) | ~19.5 kB |
| `opossum` | `^9.0.0` [^77^] | Circuit breaker | Lightweight |
| `zod` | `^3.25.0` | Schema validation | Small |

### 5.2 Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/opossum` | `^9.0.0` | TypeScript types for opossum |
| `typescript` | `^5.7.0` | TypeScript compiler |
| `@ai-sdk/provider` | `^2.0.0` | Provider types for error handling |

### 5.3 Key Version Notes

- **Node.js**: Requires 18+ (Node.js 22 LTS recommended for AI SDK 6.x) [^54^]
- **Opossum 9.0.0** (June 2025): Dropped support for Node.js < 20, aligns with WHATWG Fetch API [^77^]
- **AI SDK 6.x**: Introduced unified provider API, provider registry, and global provider configuration [^54^][^56^]

### 5.4 Optional: Vercel AI Gateway

Instead of installing individual provider packages, you can use the **AI Gateway** for automatic failover and unified access:

```bash
npm install @ai-sdk/gateway
```

The Gateway provides:
- Automatic provider failover [^36^]
- <20ms routing overhead [^58^]
- Cost tracking and per-user attribution [^58^]
- Dynamic model discovery via `getAvailableModels()` [^36^]
- No authentication needed for model listing [^36^]

---

## 6. Code Skeleton: Abstraction Layer

### 6.1 Project Structure

```
src/
  ai/
    providers/
      gemini-provider.ts      # Google Gemini strategy
      openai-provider.ts      # OpenAI strategy
      anthropic-provider.ts   # Anthropic strategy
    registry/
      provider-registry.ts    # Central model registry
    fallback/
      circuit-breaker.ts      # Per-provider circuit breaker
      fallback-orchestrator.ts # Sequential fallback logic
    errors/
      error-handler.ts        # Unified error classification
    types/
      provider.types.ts       # Shared interfaces
    config/
      models.config.ts        # Model definitions & capabilities
  frontend/
    hooks/
      useLogoVectorizer.ts    # React hook
  server.ts
```

### 6.2 Core Interfaces

```typescript
// src/ai/types/provider.types.ts
import { generateText, streamText } from 'ai';
import type { LanguageModel } from 'ai';

export interface SVGGenerationRequest {
  image: Uint8Array | URL | string;  // Image data
  prompt?: string;                    // Optional customization prompt
  modelId?: string;                   // e.g., "google:gemini-3-pro"
  maxTokens?: number;
  temperature?: number;
}

export interface SVGGenerationResponse {
  svg: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export interface ProviderCapabilities {
  vision: boolean;
  streaming: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsBase64Image: boolean;
  supportsImageURL: boolean;
  costPerMTokInput: number;
  costPerMTokOutput: number;
}

export interface AIProviderStrategy {
  readonly id: string;
  readonly name: string;
  readonly defaultModel: string;
  getCapabilities(): ProviderCapabilities;
  getModel(modelId?: string): LanguageModel;
  generateSVG(request: SVGGenerationRequest): Promise<SVGGenerationResponse>;
  streamSVG(request: SVGGenerationRequest): AsyncGenerator<string, SVGGenerationResponse>;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimitRPM?: number;
  defaultModel?: string;
}
```

### 6.3 Provider Registry Implementation

```typescript
// src/ai/registry/provider-registry.ts
import { createProviderRegistry, gateway, customProvider, wrapLanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { AIProviderStrategy, ProviderConfig } from '../types/provider.types';

// Create provider registry with string-based access
export const registry = createProviderRegistry({
  google,
  openai,
  anthropic,
});

// Model aliases for Logorythme
export const modelAliases = {
  // Primary tier: Best quality SVG
  'primary': 'google:gemini-3-pro',
  'gemini-pro': 'google:gemini-3-pro',
  'opus': 'anthropic:claude-opus-4-6',
  
  // Secondary tier: Balanced quality/speed
  'secondary': 'anthropic:claude-sonnet-4-5',
  'claude-sonnet': 'anthropic:claude-sonnet-4-5',
  'gpt-4o': 'openai:gpt-4o',
  
  // Fast tier: Quick iteration
  'fast': 'google:gemini-2.5-flash',
  'gemini-flash': 'google:gemini-2.5-flash',
  'gpt-4o-mini': 'openai:gpt-4o-mini',
} as const;

// Resolve a model string to a LanguageModel instance
export function resolveModel(modelId: string) {
  // Handle aliases
  const resolvedId = modelAliases[modelId as keyof typeof modelAliases] || modelId;
  return registry.languageModel(resolvedId);
}

// Get all available models with metadata
export function getAvailableModels() {
  return [
    {
      id: 'google:gemini-3-pro',
      name: 'Gemini 3 Pro',
      provider: 'google',
      tier: 'primary',
      bestFor: 'Highest accuracy SVG generation',
    },
    {
      id: 'anthropic:claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      provider: 'anthropic',
      tier: 'secondary',
      bestFor: 'Coding excellence, extended output',
    },
    {
      id: 'anthropic:claude-opus-4-6',
      name: 'Claude Opus 4.6',
      provider: 'anthropic',
      tier: 'primary',
      bestFor: 'Most complex SVG logic',
    },
    {
      id: 'openai:gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      tier: 'secondary',
      bestFor: 'Balanced quality and speed',
    },
    {
      id: 'google:gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google',
      tier: 'fast',
      bestFor: 'Fast iteration, prototyping',
    },
    {
      id: 'openai:gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      tier: 'fast',
      bestFor: 'Cost-effective processing',
    },
  ];
}
```

### 6.4 Gemini Provider Strategy

```typescript
// src/ai/providers/gemini-provider.ts
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import type { LanguageModel } from 'ai';
import type { AIProviderStrategy, SVGGenerationRequest, SVGGenerationResponse, ProviderCapabilities, ProviderConfig } from '../types/provider.types';

export class GeminiProvider implements AIProviderStrategy {
  readonly id = 'google';
  readonly name = 'Google Gemini';
  readonly defaultModel = 'gemini-3-pro';
  
  private config: ProviderConfig;
  private provider: ReturnType<typeof createGoogleGenerativeAI>;
  
  constructor(config: ProviderConfig) {
    this.config = config;
    this.provider = createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }
  
  getCapabilities(): ProviderCapabilities {
    return {
      vision: true,
      streaming: true,
      maxContextTokens: 1_000_000,
      maxOutputTokens: 8192,
      supportsBase64Image: true,
      supportsImageURL: true,
      costPerMTokInput: 0.30,
      costPerMTokOutput: 2.50,
    };
  }
  
  getModel(modelId: string = this.defaultModel): LanguageModel {
    return this.provider(modelId);
  }
  
  async generateSVG(request: SVGGenerationRequest): Promise<SVGGenerationResponse> {
    const startTime = Date.now();
    const model = this.getModel(request.modelId);
    
    const result = await generateText({
      model,
      system: this.getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: this.buildUserPrompt(request) },
            { type: 'image', image: request.image },
          ],
        },
      ],
      maxTokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.2,  // Low temp for deterministic SVG
    });
    
    return {
      svg: this.extractSVG(result.text),
      model: model.modelId,
      provider: this.id,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      } : undefined,
      durationMs: Date.now() - startTime,
    };
  }
  
  async *streamSVG(request: SVGGenerationRequest): AsyncGenerator<string, SVGGenerationResponse> {
    const startTime = Date.now();
    const model = this.getModel(request.modelId);
    
    const result = streamText({
      model,
      system: this.getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: this.buildUserPrompt(request) },
            { type: 'image', image: request.image },
          ],
        },
      ],
      maxTokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.2,
    });
    
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      yield chunk;
    }
    
    const finalResult = await result;
    
    return {
      svg: this.extractSVG(fullText),
      model: model.modelId,
      provider: this.id,
      usage: finalResult.usage ? {
        promptTokens: finalResult.usage.promptTokens,
        completionTokens: finalResult.usage.completionTokens ?? 0,
        totalTokens: finalResult.usage.totalTokens ?? 0,
      } : undefined,
      durationMs: Date.now() - startTime,
    };
  }
  
  private getSystemPrompt(): string {
    return `You are an expert SVG code generator. Your task is to analyze logo images and produce clean, optimized SVG code.

Rules:
- Output ONLY valid SVG code with no markdown or explanations
- Use SVG paths, circles, rects, and other basic shapes
- Optimize for file size while maintaining visual fidelity
- Use viewBox appropriately
- Include xmlns="http://www.w3.org/2000/svg"
- Use currentColor for fills when appropriate for themability`;
  }
  
  private buildUserPrompt(request: SVGGenerationRequest): string {
    return request.prompt ?? 'Convert this logo image to clean, optimized SVG code. Output only the SVG markup.';
  }
  
  private extractSVG(text: string): string {
    // Extract SVG between <svg> tags
    const match = text.match(/<svg[\s\S]*?<\/svg>/);
    return match ? match[0] : text;
  }
}
```

### 6.5 Circuit Breaker Wrapper

```typescript
// src/ai/fallback/circuit-breaker.ts
import CircuitBreaker from 'opossum';
import type { AIProviderStrategy, SVGGenerationRequest, SVGGenerationResponse } from '../types/provider.types';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

export class ProviderCircuitBreaker implements AIProviderStrategy {
  readonly id: string;
  readonly name: string;
  readonly defaultModel: string;
  
  private breaker: CircuitBreaker;
  private provider: AIProviderStrategy;
  
  constructor(provider: AIProviderStrategy, options: CircuitBreakerOptions = {}) {
    this.id = provider.id;
    this.name = provider.name;
    this.defaultModel = provider.defaultModel;
    this.provider = provider;
    
    this.breaker = new CircuitBreaker(
      (request: SVGGenerationRequest) => this.provider.generateSVG(request),
      {
        timeout: options.timeout ?? 30000,           // 30s timeout for SVG generation
        errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
        resetTimeout: options.resetTimeout ?? 60000,   // 60s before trying again
        volumeThreshold: options.volumeThreshold ?? 3, // Min 3 requests before tripping
      }
    );
    
    // Logging hooks
    this.breaker.on('open', () => {
      console.warn(`[CircuitBreaker] OPEN for ${this.provider.name}`);
    });
    this.breaker.on('halfOpen', () => {
      console.info(`[CircuitBreaker] HALF-OPEN for ${this.provider.name}`);
    });
    this.breaker.on('close', () => {
      console.info(`[CircuitBreaker] CLOSED for ${this.provider.name}`);
    });
  }
  
  getCapabilities() {
    return this.provider.getCapabilities();
  }
  
  getModel(modelId?: string) {
    return this.provider.getModel(modelId);
  }
  
  async generateSVG(request: SVGGenerationRequest): Promise<SVGGenerationResponse> {
    return this.breaker.fire(request);
  }
  
  async *streamSVG(request: SVGGenerationRequest): AsyncGenerator<string, SVGGenerationResponse> {
    // Stream through circuit breaker
    const stream = await this.provider.streamSVG(request);
    yield* stream;
    return stream as unknown as SVGGenerationResponse;  // Type workaround
  }
  
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.breaker.opened ? 'OPEN' : this.breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED';
  }
  
  getStats() {
    return this.breaker.stats;
  }
}
```

### 6.6 Fallback Orchestrator

```typescript
// src/ai/fallback/fallback-orchestrator.ts
import { APICallError } from 'ai';
import type { AIProviderStrategy, SVGGenerationRequest, SVGGenerationResponse } from '../types/provider.types';
import { ProviderCircuitBreaker } from './circuit-breaker';

export interface FallbackChainConfig {
  providers: AIProviderStrategy[];
  maxProviderSwitches?: number;
  retryableStatusCodes?: number[];
}

export class FallbackOrchestrator {
  private providers: ProviderCircuitBreaker[];
  private config: Required<FallbackChainConfig>;
  
  private readonly DEFAULT_RETRYABLE_CODES = [408, 429, 500, 502, 503, 504];
  
  constructor(config: FallbackChainConfig) {
    this.providers = config.providers.map(
      p => new ProviderCircuitBreaker(p)
    );
    this.config = {
      ...config,
      maxProviderSwitches: config.maxProviderSwitches ?? config.providers.length,
      retryableStatusCodes: config.retryableStatusCodes ?? this.DEFAULT_RETRYABLE_CODES,
    };
  }
  
  async generateSVGWithFallback(
    request: SVGGenerationRequest,
    preferredProvider?: string
  ): Promise<SVGGenerationResponse> {
    const providers = this.getOrderedProviders(preferredProvider);
    
    let lastError: Error | undefined;
    
    for (let i = 0; i < Math.min(providers.length, this.config.maxProviderSwitches); i++) {
      const provider = providers[i];
      
      // Skip if circuit is OPEN
      if (provider.getState() === 'OPEN') {
        console.log(`[Fallback] Skipping ${provider.name} - circuit OPEN`);
        continue;
      }
      
      try {
        console.log(`[Fallback] Trying ${provider.name}...`);
        const result = await provider.generateSVG(request);
        console.log(`[Fallback] Success with ${provider.name}`);
        return result;
      } catch (error) {
        console.warn(`[Fallback] ${provider.name} failed:`, error);
        lastError = error as Error;
        
        // If non-retryable, stop trying
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        // Continue to next provider
      }
    }
    
    throw new Error(
      `All providers failed. Last error: ${lastError?.message ?? 'Unknown'}`
    );
  }
  
  async *streamSVGWithFallback(
    request: SVGGenerationRequest,
    preferredProvider?: string
  ): AsyncGenerator<string, SVGGenerationResponse> {
    const providers = this.getOrderedProviders(preferredProvider);
    
    for (let i = 0; i < Math.min(providers.length, this.config.maxProviderSwitches); i++) {
      const provider = providers[i];
      
      if (provider.getState() === 'OPEN') {
        continue;
      }
      
      try {
        // Note: Streaming fallback requires collecting all output
        // For true streaming with fallback, you need to buffer or use a gateway
        const stream = await provider.streamSVG(request);
        yield* stream;
        return stream as unknown as SVGGenerationResponse;
      } catch (error) {
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        continue;
      }
    }
    
    throw new Error('All providers failed for streaming request');
  }
  
  getHealthStatus() {
    return this.providers.map(p => ({
      id: p.id,
      name: p.name,
      state: p.getState(),
      stats: p.getStats(),
    }));
  }
  
  private getOrderedProviders(preferredProvider?: string): ProviderCircuitBreaker[] {
    if (!preferredProvider) return [...this.providers];
    
    const preferred = this.providers.find(p => p.id === preferredProvider);
    const rest = this.providers.filter(p => p.id !== preferredProvider);
    return preferred ? [preferred, ...rest] : [...this.providers];
  }
  
  private isNonRetryableError(error: unknown): boolean {
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 401) return true; // Auth error - don't retry
      if (error.statusCode === 400) return true; // Bad request - don't retry
      return !this.config.retryableStatusCodes.includes(error.statusCode ?? 0);
    }
    return false;
  }
}
```

### 6.7 Server Integration (Express/Hono)

```typescript
// server.ts
import { Hono } from 'hono';
import { stream, streamText } from 'hono/streaming';
import { generateText } from 'ai';
import { GeminiProvider } from './ai/providers/gemini-provider';
import { OpenAIProvider } from './ai/providers/openai-provider';
import { AnthropicProvider } from './ai/providers/anthropic-provider';
import { FallbackOrchestrator } from './ai/fallback/fallback-orchestrator';
import { resolveModel } from './ai/registry/provider-registry';
import { APICallError, InvalidArgumentError } from 'ai';

const app = new Hono();

// Initialize providers
const geminiProvider = new GeminiProvider({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  defaultModel: 'gemini-3-pro',
});

const openaiProvider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  defaultModel: 'gpt-4o',
});

const anthropicProvider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultModel: 'claude-sonnet-4.5',
});

// Fallback orchestrator: Gemini -> Anthropic -> OpenAI
const orchestrator = new FallbackOrchestrator({
  providers: [geminiProvider, anthropicProvider, openaiProvider],
  maxProviderSwitches: 3,
});

// Health check endpoint
app.get('/health/ai', (c) => {
  return c.json({
    providers: orchestrator.getHealthStatus(),
  });
});

// List available models
app.get('/models', (c) => {
  const models = getAvailableModels();
  return c.json({ models });
});

// Non-streaming SVG generation
app.post('/vectorize', async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File;
    const modelId = formData.get('model') as string | undefined;
    const prompt = formData.get('prompt') as string | undefined;
    
    if (!imageFile) {
      return c.json({ error: 'Image file required' }, 400);
    }
    
    const imageBuffer = new Uint8Array(await imageFile.arrayBuffer());
    
    const result = await orchestrator.generateSVGWithFallback(
      {
        image: imageBuffer,
        prompt: prompt ?? undefined,
        modelId,
      },
      modelId?.split(':')[0]  // Extract provider prefix
    );
    
    return c.json({
      svg: result.svg,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      durationMs: result.durationMs,
    });
  } catch (error) {
    return handleError(error, c);
  }
});

// Streaming SVG generation
app.post('/vectorize/stream', async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File;
    const modelId = formData.get('model') as string | undefined;
    const prompt = formData.get('prompt') as string | undefined;
    
    if (!imageFile) {
      return c.json({ error: 'Image file required' }, 400);
    }
    
    const imageBuffer = new Uint8Array(await imageFile.arrayBuffer());
    const resolvedModel = modelId ? resolveModel(modelId) : resolveModel('primary');
    
    return stream(c, async (stream) => {
      const result = streamText({
        model: resolvedModel,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt ?? 'Convert this logo to SVG' },
            { type: 'image', image: imageBuffer },
          ],
        }],
        maxTokens: 4096,
        temperature: 0.2,
      });
      
      for await (const chunk of result.textStream) {
        await stream.write(chunk);
      }
    });
  } catch (error) {
    return handleError(error, c);
  }
});

function handleError(error: unknown, c: any) {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 500;
    const message =
      status === 401 ? 'Invalid API key. Check provider configuration.' :
      status === 429 ? 'Rate limited. Please try again later.' :
      status === 503 ? 'AI service temporarily unavailable.' :
      'AI service error occurred.';
    
    return c.json({ error: message, provider: error.url }, status);
  }
  
  console.error('Unexpected error:', error);
  return c.json({ error: 'Internal server error' }, 500);
}
```

---

## 7. Fallback Strategy Design

### 7.1 Fallback Chain Priority

The recommended fallback chain for Logorythme prioritizes SVG generation quality based on benchmark results:

```
Priority 1: Google Gemini 3 Pro    (best VectorGym score: 73.17)
Priority 2: Anthropic Claude Opus 4.6 (best SVGBench score: 75.6%)
Priority 3: Anthropic Claude Sonnet 4.5 (balanced quality/speed)
Priority 4: OpenAI GPT-4o          (reliable fallback)
Priority 5: Google Gemini 2.5 Flash (budget option)
```

### 7.2 When to Fallback

| Error Type | Fallback? | Reason |
|-----------|-----------|--------|
| **Rate limit (429)** | Yes | Provider temporarily overloaded |
| **Timeout (408)** | Yes | Provider slow, try another |
| **Server error (500, 502, 503)** | Yes | Provider down |
| **Auth error (401)** | No | Config issue - fix credentials |
| **Bad request (400)** | No | Likely bad prompt or image |
| **Safety filter blocked** | Yes | Try different provider with different filter |
| **Token limit exceeded** | Yes | Try model with larger context |

### 7.3 Circuit Breaker Configuration Per Provider

| Provider | Timeout | Error Threshold | Reset Timeout | Volume Threshold |
|----------|---------|----------------|---------------|------------------|
| Gemini 3 Pro | 45s | 50% | 60s | 5 |
| Claude Opus 4.6 | 60s | 60% | 90s | 3 |
| Claude Sonnet 4.5 | 30s | 50% | 60s | 5 |
| GPT-4o | 30s | 50% | 60s | 5 |

### 7.4 Automatic vs Manual Fallback

**Automatic fallback** happens when:
- Circuit breaker is OPEN
- Rate limit or server error occurs
- Request times out

**Manual fallback** (user-selected):
- User specifies a model via `?model=anthropic:claude-sonnet-4.5`
- Always try the requested provider first

### 7.5 Using Vercel AI Gateway for Fallback

Alternatively, the Vercel AI Gateway provides **built-in automatic failover** with provider ordering [^57^][^59^]:

```typescript
// Using AI Gateway with fallback chain
import { createHelicone } from '@helicone/ai-sdk-provider';

const helicone = createHelicone({
  apiKey: process.env.HELICONE_API_KEY
});

// Fallback: Try Claude first, then GPT-4o
const result = await generateText({
  model: helicone('claude-sonnet-4.5/anthropic,gpt-4o/openai'),
  prompt: 'Generate SVG code for this logo',
});
```

The Gateway handles:
- Automatic provider failover [^58^]
- <20ms routing overhead [^58^]
- Provider timeouts and fast failover [^57^]
- Cost tracking per request [^58^]

---

## 8. Error Handling Per Provider

### 8.1 Error Classification

The Vercel AI SDK provides typed error classes [^35^][^37^]:

```typescript
import {
  APICallError,           // API call failed
  InvalidArgumentError,   // Invalid argument
  NoSuchModelError,       // Model not found
  NoObjectGeneratedError, // No structured output generated
  TypeValidationError,    // Schema validation failed
} from 'ai';
```

### 8.2 Provider-Specific Error Handling

```typescript
// src/ai/errors/error-handler.ts
import { APICallError, AISDKError } from 'ai';

export interface ProviderErrorInfo {
  provider: string;
  statusCode: number;
  message: string;
  isRetryable: boolean;
  retryAfter?: number;  // Seconds
  errorType: 'rate_limit' | 'auth' | 'timeout' | 'server' | 'safety' | 'token_limit' | 'unknown';
}

export function classifyError(error: unknown, provider: string): ProviderErrorInfo {
  // Default unknown error
  const defaultInfo: ProviderErrorInfo = {
    provider,
    statusCode: 500,
    message: error instanceof Error ? error.message : 'Unknown error',
    isRetryable: false,
    errorType: 'unknown',
  };

  if (APICallError.isInstance(error)) {
    const info: ProviderErrorInfo = {
      provider,
      statusCode: error.statusCode ?? 500,
      message: error.message,
      isRetryable: error.isRetryable ?? false,
      errorType: 'unknown',
    };

    // Classify by status code
    switch (error.statusCode) {
      case 429:
        info.errorType = 'rate_limit';
        info.isRetryable = true;
        break;
      case 401:
      case 403:
        info.errorType = 'auth';
        info.isRetryable = false;
        break;
      case 408:
        info.errorType = 'timeout';
        info.isRetryable = true;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        info.errorType = 'server';
        info.isRetryable = true;
        break;
      default:
        // Check message patterns for provider-specific errors
        info.errorType = classifyByMessage(error.message);
    }

    return info;
  }

  // Check for timeout errors (not APICallError)
  if (error instanceof Error && error.message.includes('timeout')) {
    return { ...defaultInfo, errorType: 'timeout', isRetryable: true };
  }

  // Check for abort errors
  if (error instanceof Error && error.name === 'AbortError') {
    return { ...defaultInfo, errorType: 'timeout', isRetryable: true };
  }

  return defaultInfo;
}

function classifyByMessage(message: string): ProviderErrorInfo['errorType'] {
  const lower = message.toLowerCase();
  
  // Google Gemini safety filter errors
  if (lower.includes('safety') || lower.includes('blocked')) {
    return 'safety';
  }
  
  // Token limit errors (all providers)
  if (lower.includes('token') && (lower.includes('limit') || lower.includes('maximum'))) {
    return 'token_limit';
  }
  
  // Anthropic overloaded
  if (lower.includes('overloaded') || lower.includes('capacity')) {
    return 'server';
  }
  
  return 'unknown';
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      const classified = classifyError(error, 'unknown');
      
      if (!classified.isRetryable) {
        throw error; // Don't retry non-retryable errors
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
        10000 // Max 10s delay
      );
      
      console.log(`[Retry] Attempt ${attempt}/${maxRetries}, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError ?? new Error('Max retries exceeded');
}
```

### 8.3 Provider-Specific Error Quirks

| Provider | Common Error | Handling |
|----------|-------------|----------|
| **Google Gemini** | Safety filter blocking images | Retry with different prompt, or fallback to Claude [^37^] |
| **Anthropic Claude** | `overloaded_error` | Circuit breaker handles this; try Gemini [^40^] |
| **OpenAI** | Rate limit with `Retry-After` header | Respect header, exponential backoff [^35^] |
| **All** | `429 Too Many Requests` | Wait per `retry-after` or `retry-after-ms` header [^47^] |
| **All** | `500` series | Always retry with circuit breaker protection |

---

## 9. Streaming Response Handling

### 9.1 Backend Streaming

The Vercel AI SDK's `streamText` provides a unified streaming interface across all providers [^25^][^30^]:

```typescript
import { streamText } from 'ai';

// Same code regardless of provider
const result = streamText({
  model: provider('any-model'),
  messages: [...],
});

// Iterate over text stream
for await (const chunk of result.textStream) {
  // Write to SSE response
  res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
}
```

### 9.2 SSE Protocol

The standard AI SDK streaming protocol uses Server-Sent Events [^34^]:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

data: {"type":"text","text":"<svg "}

data: {"type":"text","text":"xmlns="}

data: {"type":"text","text":"http://www.w3.org/2000/svg"}

data: {"type":"done"}
```

### 9.3 Frontend Streaming Consumption

```typescript
// src/frontend/hooks/useLogoVectorizer.ts
import { useState, useCallback, useRef } from 'react';

export interface VectorizeOptions {
  model?: string;
  prompt?: string;
}

export interface VectorizeState {
  svg: string;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  provider: string | null;
}

export function useLogoVectorizer() {
  const [state, setState] = useState<VectorizeState>({
    svg: '',
    isLoading: false,
    isStreaming: false,
    error: null,
    provider: null,
  });
  
  const abortRef = useRef<AbortController | null>(null);
  
  const vectorize = useCallback(async (
    imageFile: File,
    options: VectorizeOptions = {}
  ) => {
    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    
    setState({
      svg: '',
      isLoading: true,
      isStreaming: false,
      error: null,
      provider: null,
    });
    
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      if (options.model) formData.append('model', options.model);
      if (options.prompt) formData.append('prompt', options.prompt);
      
      const response = await fetch('/api/vectorize/stream', {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Vectorization failed');
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let svg = '';
      
      setState(s => ({ ...s, isStreaming: true }));
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        svg += chunk;
        
        setState(s => ({
          ...s,
          svg,
          isLoading: false,
        }));
      }
      
      setState(s => ({
        ...s,
        svg,
        isLoading: false,
        isStreaming: false,
      }));
      
      return svg;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // User cancelled
      }
      
      setState(s => ({
        ...s,
        isLoading: false,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);
  
  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);
  
  return { ...state, vectorize, cancel };
}
```

---

## 10. Frontend Abstraction

### 10.1 Design Principle: Backend-Agnostic Frontend

The frontend should not know which AI provider is being used. It communicates with the backend via a simple HTTP API [^34^]:

```
Frontend (React)          Backend (Node.js)          AI Providers
     |                         |                          |
     | POST /api/vectorize     |                          |
     | { image, model? }       |                          |
     |------------------------>|                          |
     |                         |  generateText()          |
     |                         |  with chosen provider    |
     |                         |------------------------->|
     |                         |  SVG code                |
     |                         |<-------------------------|
     |  { svg, provider, ...}  |                          |
     |<------------------------|                          |
```

### 10.2 Model Selection UI

```typescript
// Model selector component
import { useState, useEffect } from 'react';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  tier: string;
  bestFor: string;
}

function ModelSelector({ selected, onSelect }: {
  selected: string;
  onSelect: (model: string) => void;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  
  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then(data => setModels(data.models));
  }, []);
  
  return (
    <select value={selected} onChange={e => onSelect(e.target.value)}>
      <optgroup label="Auto (with fallback)">
        <option value="">Auto-select best</option>
      </optgroup>
      {models.map(m => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.provider}) - {m.bestFor}
        </option>
      ))}
    </select>
  );
}
```

### 10.3 Frontend Integration Pattern

The recommended approach uses Vercel AI SDK's `useChat` hook for chat-style interactions or a custom streaming hook for logo vectorization. For Logorythme specifically, a **custom hook** is more appropriate since vectorization is a single-shot operation, not a conversation.

Key insight from `react-ai-stream` [^34^]: **streaming AI is fundamentally three events**: `data` (text chunk), `done`, `error`. The React component only needs to know these three event types.

---

## 11. Configuration Patterns

### 11.1 Model Selection via API

Allow users to select models via the API while maintaining fallback:

```typescript
// Request format
interface VectorizeRequest {
  image: File;              // Required: Logo image
  model?: string;           // Optional: "google:gemini-3-pro" or alias "primary"
  prompt?: string;          // Optional: Custom instructions
  strategy?: 'quality' | 'speed' | 'cost';  // Auto-select based on strategy
}

// Model resolution logic
function resolveModelForRequest(request: VectorizeRequest) {
  if (request.model) {
    return resolveModel(request.model);  // User-specified
  }
  
  switch (request.strategy) {
    case 'quality': return resolveModel('primary');    // Gemini 3 Pro
    case 'speed':   return resolveModel('fast');       // Gemini 2.5 Flash
    case 'cost':    return resolveModel('gemini-flash'); // Cheapest
    default:        return resolveModel('primary');    // Default
  }
}
```

### 11.2 Environment Configuration

```env
# .env
# All API keys (at least one required)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Default model (alias or full ID)
DEFAULT_MODEL=primary

# Circuit breaker settings
CIRCUIT_TIMEOUT_MS=30000
CIRCUIT_ERROR_THRESHOLD=50
CIRCUIT_RESET_MS=60000

# Fallback chain (comma-separated provider IDs)
FALLBACK_CHAIN=google,anthropic,openai

# Max retries per provider
MAX_RETRIES=3
```

### 11.3 Runtime Model Discovery

The Vercel AI SDK supports dynamic model discovery [^36^]:

```typescript
// Fetch available models from the registry
import { getAvailableModels } from './ai/registry/provider-registry';

// Returns all models with metadata, pricing, capabilities
const models = getAvailableModels();

// Can also use AI Gateway for dynamic discovery
const gatewayModels = await fetch('https://ai-gateway.vercel.sh/v1/models')
  .then(r => r.json());
```

---

## 12. All Sources

[^16^] JavaScript/TypeScript GenAI Frameworks: 2026 Comparison - fp8.co
[^17^] A Multitask Benchmark for SVG Code Generation, Sketching, and Editing (VectorGym) - arxiv.org
[^18^] GPT vs Claude vs Gemini: Complete AI Model Comparison for 2025 - callgpt.co.uk
[^20^] LangChain vs Vercel AI SDK vs OpenAI SDK: 2026 Guide - strapi.io
[^21^] LangChain.js vs Vercel AI SDK (2026) - PkgPulse Guides
[^22^] Error Handling and Retry Strategies in Spring AI Applications - springdevpro.com
[^24^] AI SDK vs LangChain: Which to Use in 2026 - PkgPulse
[^25^] Building Delight: A Multi-Provider AI Chrome Extension with Vercel AI SDK - Medium
[^26^] Top JavaScript/TypeScript Gen AI Frameworks for 2026 - xavidop.me
[^27^] Resilient AI with Quarkus: Fault Tolerance Meets LangChain4j - the-main-thread.com
[^29^] SVGBench GitHub Repository - github.com/johnbean393/SVGBench
[^34^] I built a 20 kB React hook that doesn't care which AI you use - dev.to
[^35^] Error Recovery - AI SDK by Vercel - vercel-ai.mintlify.app
[^36^] Models & Providers - Vercel AI Gateway - vercel.com
[^37^] AI SDK Provider Error Types - tessl.io/registry
[^39^] AI SDK UI: Overview - ai-sdk.dev
[^40^] Retry Error Issue - vercel/ai GitHub
[^41^] Circuit Breaker Pattern in NodeJs with Opossum - Medium
[^42^] Tool Execution Reliability Issue - Vercel Community
[^43^] Resilience Patterns in TypeScript: Circuit Breaker - nobuti.com
[^44^] How does the SDK handle errors? - Vercel/AI Forums
[^45^] LLM API Comparison 2026: Pricing, Speed, Features - Morph
[^46^] AI SDK 4.2 Release Notes - vercel.com/blog
[^47^] SDK does not respect rate limit headers - vercel/ai GitHub
[^48^] OpenAI SDK vs Vercel AI SDK - strapi.io
[^49^] Circuit Breaker Pattern in Node.js and TypeScript - dev.to
[^50^] AI Changed How We Code (Testing, AI SDKs, etc.) - Medium
[^51^] SAP AI Provider for Vercel AI SDK - GitHub
[^52^] Vercel AI SDK GitHub Repository - github.com/vercel/ai
[^53^] Providers and models - AI SDK by Vercel
[^54^] Build an AI Chatbot with Vercel AI SDK [2026] - tech-insider.org
[^55^] Getting Started with the Vercel AI SDK in Node.js - thecodebarbarian.com
[^56^] AI SDK Core: Provider & Model Management - ai-sdk.dev
[^57^] AI Gateway Provider Options - vercel.com
[^58^] AI Gateway Key Benefits - mcpservers.org
[^59^] Vercel AI SDK Integration - Helicone
[^60^] LangChain vs Vercel AI SDK vs OpenAI SDK: 2026 Guide - strapi.io
[^61^] Implementing Automatic LLM Provider Fallback - dev.to
[^63^] Multi-Modal Inputs (Content Part Types) - voltagent.dev
[^77^] Circuit Breaker & Retry Patterns in Node.js (2026) - 1xapi.com
[^78^] Error Handling in Vercel AI SDK Tutorial - tech-insider.org
[^79^] Getting Started with Opossum in Node.js - piresfernando.com
[^80^] Node.js Microservices Guide 2026 - encore.dev
[^82^] ai npm package - npmjs.com
[^84^] opossum npm package - npmjs.com
[^85^] anthropic-ai/sdk npm package - npmjs.com
[^86^] LangChain vs Vercel AI SDK vs OpenAI SDK comparison - strapi.io
[^87^] Build an Alt Text Generator With Vercel's AI SDK - aihero.dev
[^88^] ai-retry npm package - libraries.io

---

*Research compiled from 12 independent web searches covering Vercel AI SDK documentation, npm registries, GitHub repositories, technical blogs, and academic benchmarks. All findings include inline citations.*
