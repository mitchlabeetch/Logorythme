/**
 * Model registry for provider discovery and selection.
 * Supports 6 provider families with 20+ models:
 * - Hugging Face (StarVector-8B, StarVector-1B) — dedicated SVG models
 * - Vercel AI Gateway (100+ models from 15+ providers)
 * - Google (Gemini 2.5 Flash, Gemini 3.1 Pro)
 * - OpenAI (GPT-4o, GPT-4o-mini)
 * - Anthropic (Claude Sonnet 4.5, Claude Opus 4.5)
 * - Custom OpenAI-compatible (Groq, Together, Fireworks, Ollama, Perplexity, custom URLs)
 */

import type { IProviderStrategy, ModelId } from './provider.js';
import type { ProviderName } from '../types.js';
import { config } from '../config.js';
import { getRequestLogger } from '../logger.js';
import { HuggingFaceProvider } from './providers/huggingface.js';
import { VercelGatewayProvider } from './providers/vercel-gateway.js';
import { CustomCompatibleProvider } from './providers/custom-compatible.js';
import { GoogleProvider } from './providers/google.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';

export interface ModelEntry {
  id: ModelId;
  name: string;
  provider: string;
  description: string;
  priceTier: 'budget' | 'standard' | 'premium';
  qualityScore: number;
}

/** Extended model catalog with all providers */
export const AVAILABLE_MODELS: ModelEntry[] = [
  // Hugging Face — dedicated SVG models (RECOMMENDED)
  { id: 'huggingface/starvector-8b', name: 'StarVector 8B', provider: 'huggingface', description: 'CVPR 2025 — SOTA dedicated SVG generation', priceTier: 'standard', qualityScore: 10 },
  { id: 'huggingface/starvector-1b', name: 'StarVector 1B', provider: 'huggingface', description: 'Lightweight StarVector — fast and good', priceTier: 'budget', qualityScore: 8 },
  
  // Vercel AI Gateway — 100+ models
  { id: 'vercel-gateway/google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'vercel-gateway', description: 'Very cheap, good quality', priceTier: 'budget', qualityScore: 7 },
  { id: 'vercel-gateway/google/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'vercel-gateway', description: 'Cheapest frontier option', priceTier: 'budget', qualityScore: 6 },
  { id: 'vercel-gateway/google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'vercel-gateway', description: 'Fast with good quality', priceTier: 'standard', qualityScore: 7 },
  { id: 'vercel-gateway/google/gemini-3.1-pro', name: 'Gemini 3.1 Pro', provider: 'vercel-gateway', description: 'Excellent vision', priceTier: 'standard', qualityScore: 8 },
  { id: 'vercel-gateway/openai/gpt-4o', name: 'GPT-4o', provider: 'vercel-gateway', description: 'Excellent detail recognition', priceTier: 'standard', qualityScore: 8 },
  { id: 'vercel-gateway/openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'vercel-gateway', description: 'Fast and affordable', priceTier: 'budget', qualityScore: 6 },
  { id: 'vercel-gateway/anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'vercel-gateway', description: 'Great SVG code quality', priceTier: 'standard', qualityScore: 8 },
  { id: 'vercel-gateway/anthropic/claude-opus-4.7', name: 'Claude Opus 4.7', provider: 'vercel-gateway', description: 'Best SVG code quality', priceTier: 'premium', qualityScore: 9 },
  { id: 'vercel-gateway/xai/grok-3.5', name: 'Grok 3.5', provider: 'vercel-gateway', description: 'Strong vision', priceTier: 'standard', qualityScore: 7 },
  { id: 'vercel-gateway/meta/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'vercel-gateway', description: 'Open-source multimodal', priceTier: 'budget', qualityScore: 6 },
  { id: 'vercel-gateway/deepseek/deepseek-v3', name: 'DeepSeek V3', provider: 'vercel-gateway', description: 'Strong reasoning', priceTier: 'budget', qualityScore: 7 },
  { id: 'vercel-gateway/qwen/qwen3-vl-32b', name: 'Qwen3-VL 32B', provider: 'vercel-gateway', description: 'Advanced visual agent', priceTier: 'budget', qualityScore: 7 },
  { id: 'vercel-gateway/alibaba/qwen3-vl-32b', name: 'Qwen3-VL (Alibaba)', provider: 'vercel-gateway', description: 'Visual agent with tools', priceTier: 'budget', qualityScore: 7 },
  
  // Direct providers
  { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro (Direct)', provider: 'google', description: 'Best overall quality (direct)', priceTier: 'standard', qualityScore: 8 },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Direct)', provider: 'google', description: 'Fast, good quality (direct)', priceTier: 'standard', qualityScore: 7 },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Direct)', provider: 'openai', description: 'Excellent detail (direct)', priceTier: 'standard', qualityScore: 8 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Direct)', provider: 'openai', description: 'Fast and affordable (direct)', priceTier: 'budget', qualityScore: 6 },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5 (Direct)', provider: 'anthropic', description: 'Superior SVG code (direct)', priceTier: 'standard', qualityScore: 8 },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5 (Direct)', provider: 'anthropic', description: 'Maximum precision (direct)', priceTier: 'premium', qualityScore: 9 },
  
  // Custom OpenAI-compatible providers
  { id: 'custom/groq-llama-vision', name: 'Groq Llama Vision', provider: 'custom', description: 'Ultra-fast inference', priceTier: 'budget', qualityScore: 6 },
  { id: 'custom/together-llama-vision', name: 'Together Llama Vision', provider: 'custom', description: 'Open-source hosting', priceTier: 'budget', qualityScore: 6 },
  { id: 'custom/fireworks-llama-vision', name: 'Fireworks Llama Vision', provider: 'custom', description: 'Fast inference', priceTier: 'budget', qualityScore: 6 },
  { id: 'custom/perplexity-sonar', name: 'Perplexity Sonar', provider: 'custom', description: 'Research-focused', priceTier: 'standard', qualityScore: 7 },
  { id: 'custom/ollama-llava', name: 'Ollama (Local)', provider: 'custom', description: 'Local model serving', priceTier: 'budget', qualityScore: 5 },
];

/** Registry mapping model IDs to provider instances */
export class ModelRegistry {
  private providers = new Map<string, IProviderStrategy>();
  private logger = getRequestLogger();

  constructor() {
    this.initializeProviders();
  }

  /** Auto-discover and initialize providers based on API keys */
  private initializeProviders(): void {
    // 1. Hugging Face — StarVector (BEST for SVG)
    if (config.hfApiKey) {
      this.providers.set('huggingface', new HuggingFaceProvider({
        apiKey: config.hfApiKey,
        baseUrl: config.hfApiEndpoint,
        timeout: 60000,
      }));
      this.logger.info('Initialized Hugging Face (StarVector) provider');
    }

    // 2. Vercel AI Gateway — 100+ models
    if (config.vercelGatewayKey) {
      this.providers.set('vercel-gateway', new VercelGatewayProvider({
        apiKey: config.vercelGatewayKey,
        timeout: 60000,
      }));
      this.logger.info('Initialized Vercel AI Gateway provider');
    }

    // 3. Google (Direct)
    if (config.googleAiKey) {
      this.providers.set('google', new GoogleProvider({
        apiKey: config.googleAiKey,
        timeout: 60000,
      }));
      this.logger.info('Initialized Google provider');
    }

    // 4. OpenAI (Direct)
    if (config.openAiKey) {
      this.providers.set('openai', new OpenAIProvider({
        apiKey: config.openAiKey,
        timeout: 60000,
      }));
      this.logger.info('Initialized OpenAI provider');
    }

    // 5. Anthropic (Direct)
    if (config.anthropicKey) {
      this.providers.set('anthropic', new AnthropicProvider({
        apiKey: config.anthropicKey,
        timeout: 60000,
      }));
      this.logger.info('Initialized Anthropic provider');
    }

    // 6. Custom OpenAI-compatible provider
    if (config.customProviderKey && config.customProviderBaseUrl) {
      this.providers.set('custom', new CustomCompatibleProvider({
        apiKey: config.customProviderKey,
        baseURL: config.customProviderBaseUrl,
        preset: config.customProviderPreset as 'groq' | 'together' | 'fireworks' | 'perplexity' | 'ollama',
        timeout: 60000,
      }));
      this.logger.info(`Initialized custom provider (${config.customProviderPreset ?? 'custom URL'})`);
    }

    const count = this.providers.size;
    if (count === 0) {
      this.logger.warn('No AI providers configured! Set at least one API key (HF_API_KEY recommended for StarVector).');
    } else {
      this.logger.info(`${count} AI providers initialized`);
    }
  }

  /** Get a provider by name */
  getProvider(name: string): IProviderStrategy | undefined {
    return this.providers.get(name);
  }

  /** Get provider for a model ID (e.g., "google/gemini-3.1-pro") */
  getProviderForModel(modelId: string): IProviderStrategy | undefined {
    // Extract provider prefix
    const [providerPrefix] = modelId.split('/');
    
    // Try direct match first
    const provider = this.providers.get(providerPrefix);
    if (provider) return provider;
    
    // For vercel-gateway models, try the gateway
    return this.providers.get('vercel-gateway');
  }

  /** Get the model name part from a model ID */
  getModelName(modelId: string): string {
    const parts = modelId.split('/');
    // For vercel-gateway/google/gemini-2.0-flash, model = google/gemini-2.0-flash
    if (parts[0] === 'vercel-gateway') return parts.slice(1).join('/');
    return parts.slice(1).join('/');
  }

  /** List all available models (with available providers) */
  async listAvailableModels(): Promise<ModelEntry[]> {
    const available: ModelEntry[] = [];
    for (const model of AVAILABLE_MODELS) {
      const provider = this.getProviderForModel(model.id);
      if (provider && await provider.isAvailable()) {
        available.push(model);
      }
    }
    return available;
  }

  /** Get default model ID — prefers StarVector if available */
  getDefaultModel(): string {
    return config.defaultModel;
  }

  /** Get fallback model IDs */
  getFallbackModels(): string[] {
    return config.fallbackModels;
  }

  /** Get all initialized providers */
  getAllProviders(): IProviderStrategy[] {
    return Array.from(this.providers.values());
  }

  /** Get available provider names */
  getAvailableProviders(): Set<string> {
    return new Set(this.providers.keys());
  }
}
