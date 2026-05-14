/**
 * Custom OpenAI-compatible provider.
 * Supports any provider with an OpenAI-compatible API endpoint:
 * - Groq (groq.com) - ultra-fast inference
 * - Together AI (together.xyz) - open-source model hosting
 * - Fireworks AI (fireworks.ai) - fast inference
 * - Ollama (localhost) - local model serving
 * - LM Studio - local GUI for models
 * - Perplexity - pplx API
 * - Any custom endpoint
 * 
 * Uses @ai-sdk/openai-compatible for maximum flexibility.
 * 
 * @see https://ai-sdk.dev/providers/openai-compatible-providers
 */

import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { IProviderStrategy, ProviderConfig } from '../provider.js';
import type { VectorizeOptions, AIResult } from '../../types.js';
import { AIProviderError, ErrorCode } from '../../errors/index.js';
import { getSystemPrompt } from '../prompts/vectorizer.js';
import { getRequestLogger } from '../../logger.js';

/** Pre-configured custom providers */
export const PRESET_PROVIDERS: Record<string, { baseURL: string; name: string; models: string[] }> = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    name: 'Groq',
    models: ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 'mixtral-8x7b-32768'],
  },
  together: {
    baseURL: 'https://api.together.xyz/v1',
    name: 'Together AI',
    models: ['meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', 'Qwen/Qwen2-VL-72B-Instruct'],
  },
  fireworks: {
    baseURL: 'https://api.fireworks.ai/inference/v1',
    name: 'Fireworks AI',
    models: ['accounts/fireworks/models/llama-v3p2-90b-vision-instruct', 'accounts/fireworks/models/qwen2p5-vl-72b-instruct'],
  },
  perplexity: {
    baseURL: 'https://api.perplexity.ai',
    name: 'Perplexity',
    models: ['sonar-pro', 'sonar-reasoning'],
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    name: 'Ollama',
    models: ['llava', 'bakllava', 'moondream'],
  },
};

export class CustomCompatibleProvider implements IProviderStrategy {
  readonly name: 'custom' = 'custom';
  readonly supportedModels: string[];
  private provider: ReturnType<typeof createOpenAICompatible>;

  constructor(private readonly cfg: ProviderConfig & { preset?: string; baseURL: string }) {
    // Resolve baseURL from preset or direct config
    const baseURL = cfg.preset && PRESET_PROVIDERS[cfg.preset]
      ? PRESET_PROVIDERS[cfg.preset].baseURL
      : cfg.baseURL;

    this.provider = createOpenAICompatible({
      name: cfg.preset ?? 'custom',
      apiKey: cfg.apiKey,
      baseURL,
      headers: cfg.preset ? {} : undefined,
    });

    this.supportedModels = cfg.preset && PRESET_PROVIDERS[cfg.preset]
      ? PRESET_PROVIDERS[cfg.preset].models
      : ['custom-model'];
  }

  async generateVectorSVG(
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult> {
    const logger = getRequestLogger();
    const modelId = options.model ?? this.supportedModels[0];
    logger.info({ provider: this.name, preset: this.cfg.preset, model: modelId }, 'Generating SVG with custom provider');

    try {
      // For Ollama/local providers, images may need different handling
      const messages = this.cfg.preset === 'ollama'
        ? this.buildOllamaMessages(imageBase64, options)
        : this.buildStandardMessages(imageBase64, mimeType, options);

      const result = await generateText({
        model: this.provider.chatModel(modelId),
        system: getSystemPrompt(options.quality),
        temperature: 0,
        maxTokens: 8192,
        messages,
      });

      const svg = this.extractSVG(result.text);
      logger.info({ provider: this.name, model: modelId, svgLength: svg.length }, 'Custom provider SVG generated');

      return {
        svg,
        model: modelId,
        provider: this.name,
      };
    } catch (error) {
      logger.error({ error, provider: this.name, model: modelId }, 'Custom provider generation failed');
      throw this.mapError(error, modelId);
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.cfg.apiKey || this.cfg.preset === 'ollama');
  }

  private buildStandardMessages(imageBase64: string, mimeType: string, options: VectorizeOptions) {
    return [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Convert this logo to pure white SVG on transparent background.' },
          { type: 'image' as const, image: Buffer.from(imageBase64, 'base64'), mimeType },
        ],
      },
    ];
  }

  private buildOllamaMessages(imageBase64: string, _options: VectorizeOptions) {
    // Ollama uses different image format
    return [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Convert this logo to pure white SVG. Output only valid SVG code without markdown.' },
          { type: 'image' as const, image: `data:image/png;base64,${imageBase64}` },
        ],
      },
    ];
  }

  private extractSVG(text: string): string {
    let cleaned = text.replace(/```(?:svg|html|xml)?\s*/gi, '').replace(/```\s*$/gm, '').trim();
    cleaned = cleaned.replace(/<\?xml[^?]*\?>/, '').replace(/<!DOCTYPE[^>]*>/i, '');
    const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) cleaned = svgMatch[0];
    return cleaned.trim();
  }

  private mapError(error: unknown, model: string): AIProviderError {
    if (error instanceof AIProviderError) return error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('429') || message.includes('rate')) return AIProviderError.rateLimit(this.name);
    if (message.includes('timeout')) return AIProviderError.timeout(this.name, 30000);
    if (message.includes('ECONNREFUSED')) {
      return new AIProviderError(
        `Cannot connect to ${this.cfg.baseURL}. Is the service running?`,
        ErrorCode.AI_PROVIDER_UNAVAILABLE,
        false,
        { model, baseURL: this.cfg.baseURL },
      );
    }
    return new AIProviderError(message, ErrorCode.AI_PROVIDER_TIMEOUT, true, { model });
  }
}
