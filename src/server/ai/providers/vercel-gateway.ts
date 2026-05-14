/**
 * Vercel AI Gateway provider with unified access to 100+ models.
 * 
 * The Vercel AI Gateway provides:
 * - One key, hundreds of models (OpenAI, Anthropic, Google, xAI, Meta, Mistral, DeepSeek, Cohere, Perplexity, Alibaba)
 * - Zero token markup (BYOK)
 * - Automatic failover between providers
 * - Unified billing and observability
 * - OpenAI Chat Completions API compatible
 * - Dynamic model discovery
 * 
 * @see https://vercel.com/docs/ai-gateway
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
 */

import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import type { IProviderStrategy, ProviderConfig } from '../provider.js';
import type { VectorizeOptions, AIResult } from '../../types.js';
import { AIProviderError, ErrorCode } from '../../errors/index.js';
import { getSystemPrompt } from '../prompts/vectorizer.js';
import { getRequestLogger } from '../../logger.js';

/** Model categories for intelligent selection */
export const GATEWAY_MODELS = {
  // Premium tier - best quality
  premium: [
    { id: 'anthropic/claude-opus-4.7', name: 'Claude Opus 4.7', desc: 'Best SVG code quality' },
    { id: 'openai/gpt-5.5', name: 'GPT-5.5', desc: 'Best overall quality' },
    { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro', desc: 'Excellent vision' },
  ],
  // Standard tier - best price/quality
  standard: [
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', desc: 'Great SVG quality' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', desc: 'Excellent detail recognition' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast with good quality' },
    { id: 'xai/grok-3.5', name: 'Grok 3.5', desc: 'Strong vision' },
  ],
  // Budget tier - cheapest
  budget: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Fast and affordable' },
    { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Very cheap, good quality' },
    { id: 'google/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', desc: 'Cheapest frontier' },
    { id: 'mistral/mistral-small-latest', name: 'Mistral Small', desc: 'Fast European model' },
  ],
  // Open-source / experimental
  opensource: [
    { id: 'meta/llama-4-maverick', name: 'Llama 4 Maverick', desc: 'Open-source multimodal' },
    { id: 'deepseek/deepseek-v3', name: 'DeepSeek V3', desc: 'Strong reasoning' },
    { id: 'qwen/qwen3-vl-32b', name: 'Qwen3-VL 32B', desc: 'Advanced visual agent' },
    { id: 'alibaba/qwen3-vl-32b', name: 'Qwen3-VL (Alibaba)', desc: 'Visual agent with tools' },
  ],
};

/** Flatten all available models */
export const ALL_GATEWAY_MODELS = Object.values(GATEWAY_MODELS).flat();

export class VercelGatewayProvider implements IProviderStrategy {
  readonly name = 'vercel-gateway' as const;
  readonly supportedModels = ALL_GATEWAY_MODELS.map(m => m.id);

  constructor(private readonly cfg: ProviderConfig) {}

  async generateVectorSVG(
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult> {
    const logger = getRequestLogger();
    const modelId = options.model ?? 'google/gemini-2.0-flash';
    logger.info({ provider: this.name, model: modelId }, 'Generating SVG via Vercel AI Gateway');

    try {
      const result = await generateText({
        model: gateway(modelId),
        system: getSystemPrompt(options.quality),
        temperature: 0,
        maxTokens: 8192,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Convert this logo to pure white SVG on transparent background. Follow the system instructions precisely.' },
              { type: 'image', image: Buffer.from(imageBase64, 'base64'), mimeType },
            ],
          },
        ],
      });

      const svg = this.extractSVG(result.text);
      logger.info({ provider: this.name, model: modelId, svgLength: svg.length }, 'SVG generated via Gateway');

      return {
        svg,
        model: modelId,
        provider: this.name,
        usage: result.usage ? {
          promptTokens: result.usage.promptTokens ?? 0,
          completionTokens: result.usage.completionTokens ?? 0,
        } : undefined,
      };
    } catch (error) {
      logger.error({ error, provider: this.name, model: modelId }, 'Gateway generation failed');
      throw this.mapError(error, modelId);
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.cfg.apiKey);
  }

  private extractSVG(text: string): string {
    let cleaned = text.replace(/```(?:svg|html|xml)?\s*/gi, '').replace(/```\s*$/gm, '').trim();
    cleaned = cleaned.replace(/<\?xml[^?]*\?>/, '').replace(/<!DOCTYPE[^>]*>/i, '');
    cleaned = cleaned.replace(/<code>|<\/code>/gi, '');
    const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) cleaned = svgMatch[0];
    return cleaned.trim();
  }

  private mapError(error: unknown, model: string): AIProviderError {
    if (error instanceof AIProviderError) return error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('429')) return AIProviderError.rateLimit(this.name);
    if (message.includes('timeout') || message.includes('deadline')) {
      return AIProviderError.timeout(this.name, 30000);
    }
    return new AIProviderError(message, ErrorCode.AI_PROVIDER_TIMEOUT, true, { model });
  }
}
