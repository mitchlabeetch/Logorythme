/**
 * Google Gemini AI provider implementation.
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import type { IProviderStrategy, ProviderConfig } from '../provider.js';
import type { VectorizeOptions, AIResult } from '../../types.js';
import { AIProviderError, ErrorCode } from '../../errors/index.js';
import { getSystemPrompt } from '../prompts/vectorizer.js';
import { getRequestLogger } from '../../logger.js';

export class GoogleProvider implements IProviderStrategy {
  readonly name = 'google' as const;
  readonly supportedModels = [
    'gemini-3.1-pro',
    'gemini-2.5-flash',
    'gemini-2.0-pro',
  ];

  constructor(private readonly config: ProviderConfig) {}

  async generateVectorSVG(
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult> {
    const logger = getRequestLogger();
    const modelName = options.model ?? 'gemini-3.1-pro';
    logger.info({ provider: this.name, model: modelName }, 'Generating SVG with Google Gemini');

    try {
      const result = await generateText({
        model: google(modelName),
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
      logger.error({ error, provider: this.name }, 'Gemini generation failed');
      throw this.mapError(error, modelName);
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.config.apiKey);
  }

  private extractSVG(text: string): string {
    // Remove markdown code fences
    let cleaned = text.replace(/```svg\s*/gi, '').replace(/```\s*$/gm, '').trim();
    // Remove XML declaration
    cleaned = cleaned.replace(/<\?xml[^?]*\?>/, '');
    // Remove DOCTYPE
    cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/i, '');
    // Remove HTML wrapper
    cleaned = cleaned.replace(/<code>|<\/code>/gi, '');
    // Extract just the SVG element
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
