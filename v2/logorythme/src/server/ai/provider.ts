/**
 * Provider strategy interface and configuration types.
 * All AI providers implement this interface.
 */

import type { VectorizeOptions, AIResult, ProviderName } from '../types.js';

/** Strategy interface for AI providers */
export interface IProviderStrategy {
  /** Provider name */
  readonly name: ProviderName;
  /** Models this provider supports */
  readonly supportedModels: string[];

  /**
   * Generate SVG vectorization from an uploaded image.
   * @param imageBase64 — Base64-encoded image data
   * @param mimeType — Original image MIME type
   * @param options — Vectorization options
   */
  generateVectorSVG(
    imageBase64: string,
    mimeType: string,
    options: VectorizeOptions,
  ): Promise<AIResult>;

  /** Check if the provider is currently available */
  isAvailable(): Promise<boolean>;
}

/** Configuration for a provider */
export interface ProviderConfig {
  /** API key for the provider */
  apiKey: string;
  /** Optional custom base URL */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/** Model identifier with provider prefix */
export type ModelId = `${ProviderName}/${string}`;

/** Parse a model ID string into provider and model name */
export function parseModelId(modelId: string): { provider: ProviderName; model: string } | null {
  const parts = modelId.split('/');
  if (parts.length !== 2) return null;
  const [provider, model] = parts;
  if (!['google', 'openai', 'anthropic'].includes(provider)) return null;
  return { provider: provider as ProviderName, model };
}
