/**
 * Anthropic Claude provider implementation.
 */

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { IProviderStrategy, ProviderConfig } from '../provider.js';
import type { VectorizeOptions, AIResult } from '../../types.js';
import { AIProviderError, ErrorCode } from '../../errors/index.js';
import { getSystemPrompt } from '../prompts/vectorizer.js';
import { getRequestLogger } from '../../logger.js';

export class AnthropicProvider implements IProviderStrategy {
  readonly name = 'anthropic' as const;
  readonly supportedModels = ['claude-sonnet-4.5', 'claude-opus-4.5', 'claude-3-5-sonnet-20241022'];

  constructor(private readonly config: ProviderConfig) {}

  async generateVectorSVG(
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult> {
    const logger = getRequestLogger();
    const modelName = options.model ?? 'claude-sonnet-4.5';
    logger.info({ provider: this.name, model: modelName }, 'Generating SVG with Anthropic');

    try {
      const result = await generateText({
        model: anthropic(modelName),
        system: getSystemPrompt(options.quality),
        temperature: 0,
        maxTokens: 8192,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Convert this logo to a pure white SVG on transparent background. Follow the system instructions precisely.' },
              { type: 'image', image: Buffer.from(imageBase64, 'base64'), mimeType },
            ],
          },
        ],
      });

      const svg = this.extractSVG(result.text);
      logger.info({ provider: this.name, model: modelName, svgLength: svg.length }, 'SVG generated');

      return {
        svg,
        model: modelName,
        provider: this.name,
        usage: result.usage ? {
          promptTokens: result.usage.promptTokens ?? 0,
          completionTokens: result.usage.completionTokens ?? 0,
        } : undefined,
      };
    } catch (error) {
      logger.error({ error, provider: this.name }, 'Anthropic generation failed');
      throw this.mapError(error, modelName);
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.config.apiKey);
  }

  private extractSVG(text: string): string {
    let cleaned = text.replace(/```svg\s*/gi, '').replace(/```\s*$/gm, '').trim();
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
    if (message.includes('timeout')) return AIProviderError.timeout(this.name, 30000);
    return new AIProviderError(message, ErrorCode.AI_PROVIDER_TIMEOUT, true, { model });
  }
}
