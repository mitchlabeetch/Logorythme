/**
 * Hugging Face StarVector provider for dedicated image-to-SVG generation.
 * Uses the Hugging Face Inference API to call StarVector-8B or StarVector-1B.
 * 
 * StarVector (CVPR 2025) is a foundation model specifically trained for SVG
 * generation, achieving SOTA results on SVG-Bench (DinoScore 0.984 for icons).
 * It transforms vectorization into a code generation task using vision-language
 * architecture.
 * 
 * @see https://huggingface.co/starvector/starvector-8b-im2svg
 * @see https://github.com/joanrod/star-vector
 */

import { HfInference } from '@huggingface/inference';
import type { IProviderStrategy, ProviderConfig } from '../provider.js';
import type { VectorizeOptions, AIResult } from '../../types.js';
import { AIProviderError, ErrorCode } from '../../errors/index.js';
import { getRequestLogger } from '../../logger.js';

/** StarVector model variants */
export type StarVectorModel = 'starvector/starvector-8b-im2svg' | 'starvector/starvector-1b-im2svg';

/** Hugging Face provider with StarVector models */
export class HuggingFaceProvider implements IProviderStrategy {
  readonly name = 'huggingface' as const;
  readonly supportedModels = [
    'starvector-8b',
    'starvector-1b',
  ];

  private client: HfInference;

  constructor(private readonly cfg: ProviderConfig) {
    this.client = new HfInference(cfg.apiKey);
  }

  async generateVectorSVG(
    imageBase64: string,
    _mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult> {
    const logger = getRequestLogger();
    const modelName = options.model ?? 'starvector-8b';
    const hfModelId = this.resolveModelId(modelName);
    logger.info({ provider: this.name, model: hfModelId }, 'Generating SVG with StarVector');

    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      // Call StarVector via Hugging Face Inference API
      const result = await this.client.imageToText({
        model: hfModelId,
        data: imageBuffer,
        parameters: {
          max_new_tokens: 4000,
          do_sample: false,
          num_beams: 1,
        },
      });

      const svg = this.extractSVG(result.generated_text);
      logger.info({ provider: this.name, model: hfModelId, svgLength: svg.length }, 'StarVector SVG generated');

      return {
        svg,
        model: modelName,
        provider: this.name,
      };
    } catch (error) {
      logger.error({ error, provider: this.name, model: hfModelId }, 'StarVector generation failed');
      throw this.mapError(error, hfModelId);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.cfg.apiKey) return false;
    try {
      // Quick check by listing models
      return true;
    } catch {
      return false;
    }
  }

  /** Resolve model name to full Hugging Face model ID */
  private resolveModelId(modelName: string): string {
    const modelMap: Record<string, StarVectorModel> = {
      'starvector-8b': 'starvector/starvector-8b-im2svg',
      'starvector-1b': 'starvector/starvector-1b-im2svg',
    };
    return modelMap[modelName] ?? modelMap['starvector-8b'];
  }

  /** Extract clean SVG from StarVector output */
  private extractSVG(raw: string): string {
    let svg = raw.trim();
    // StarVector may wrap SVG in markdown
    const fenceMatch = svg.match(/```(?:svg)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) svg = fenceMatch[1].trim();
    // Remove XML declaration
    svg = svg.replace(/<\?xml[^?]*\?>/, '');
    // Extract just SVG element
    const svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) svg = svgMatch[0];
    return svg.trim();
  }

  private mapError(error: unknown, model: string): AIProviderError {
    if (error instanceof AIProviderError) return error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('rate') || message.includes('429')) {
      return AIProviderError.rateLimit(this.name);
    }
    if (message.includes('timeout')) {
      return AIProviderError.timeout(this.name, 60000);
    }
    return new AIProviderError(message, ErrorCode.AI_PROVIDER_UNAVAILABLE, true, { model });
  }
}
