/**
 * Smart model ranking and selection.
 * Recommends the best model based on quality needs, budget, and provider availability.
 * 
 * Pricing as of 2026 (per 1M tokens):
 * - StarVector-8B (HF): ~$0.00012/sec GPU time — DEDICATED SVG model, SOTA
 * - StarVector-1B (HF): ~$0.00006/sec GPU time — lighter version
 * - Gemini 2.0 Flash: $0.10/$0.40 — cheapest frontier
 * - GPT-4o-mini: $0.15/$0.60 — reliable budget
 * - GLM-4.1V-9B: $0.035/$0.14 — cheapest with reasoning
 * - Qwen2.5-VL-32B: $0.27/$1.08 — strong visual agent
 * - GPT-4o: $2.50/$10.00 — best quality, expensive
 * - Claude Sonnet 4.5: $3.00/$15.00 — best SVG code quality
 * - Claude Opus 4.5: $5.00/$25.00 — maximum precision
 */

import type { QualityPreset, ProviderName } from '../types.js';

/** Model ranking entry with quality/price metadata */
export interface ModelRanking {
  id: string;
  name: string;
  provider: ProviderName | 'huggingface' | 'vercel-gateway' | 'custom';
  /** Quality score 1-10 (10 = best) */
  qualityScore: number;
  /** Speed score 1-10 (10 = fastest) */
  speedScore: number;
  /** Price tier: budget/standard/premium */
  priceTier: 'budget' | 'standard' | 'premium';
  /** Estimated cost per SVG generation (USD) */
  estimatedCost: number;
  /** Whether model has vision capability */
  hasVision: boolean;
  /** Whether model is dedicated to SVG */
  svgDedicated: boolean;
  /** Description */
  description: string;
}

/** Ranked model catalog */
export const RANKED_MODELS: ModelRanking[] = [
  // Dedicated SVG models (Hugging Face)
  {
    id: 'huggingface/starvector-8b',
    name: 'StarVector 8B',
    provider: 'huggingface',
    qualityScore: 10,
    speedScore: 6,
    priceTier: 'standard',
    estimatedCost: 0.005,
    hasVision: true,
    svgDedicated: true,
    description: 'CVPR 2025 — SOTA dedicated SVG generation model',
  },
  {
    id: 'huggingface/starvector-1b',
    name: 'StarVector 1B',
    provider: 'huggingface',
    qualityScore: 8,
    speedScore: 8,
    priceTier: 'budget',
    estimatedCost: 0.002,
    hasVision: true,
    svgDedicated: true,
    description: 'Lightweight StarVector — fast and good quality',
  },
  // Premium LLM models (via Vercel Gateway)
  {
    id: 'vercel-gateway/anthropic/claude-opus-4.7',
    name: 'Claude Opus 4.7',
    provider: 'vercel-gateway',
    qualityScore: 9,
    speedScore: 4,
    priceTier: 'premium',
    estimatedCost: 0.15,
    hasVision: true,
    svgDedicated: false,
    description: 'Best SVG code quality from LLMs',
  },
  {
    id: 'vercel-gateway/openai/gpt-5.5',
    name: 'GPT-5.5',
    provider: 'vercel-gateway',
    qualityScore: 9,
    speedScore: 5,
    priceTier: 'premium',
    estimatedCost: 0.12,
    hasVision: true,
    svgDedicated: false,
    description: 'Best overall quality',
  },
  {
    id: 'vercel-gateway/anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'vercel-gateway',
    qualityScore: 8,
    speedScore: 7,
    priceTier: 'standard',
    estimatedCost: 0.08,
    hasVision: true,
    svgDedicated: false,
    description: 'Great SVG quality at good price',
  },
  {
    id: 'vercel-gateway/openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'vercel-gateway',
    qualityScore: 8,
    speedScore: 7,
    priceTier: 'standard',
    estimatedCost: 0.05,
    hasVision: true,
    svgDedicated: false,
    description: 'Excellent detail recognition',
  },
  // Budget models
  {
    id: 'vercel-gateway/google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'vercel-gateway',
    qualityScore: 7,
    speedScore: 9,
    priceTier: 'budget',
    estimatedCost: 0.002,
    hasVision: true,
    svgDedicated: false,
    description: 'Very cheap with good quality',
  },
  {
    id: 'vercel-gateway/google/gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'vercel-gateway',
    qualityScore: 6,
    speedScore: 10,
    priceTier: 'budget',
    estimatedCost: 0.001,
    hasVision: true,
    svgDedicated: false,
    description: 'Cheapest frontier option',
  },
  {
    id: 'vercel-gateway/openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'vercel-gateway',
    qualityScore: 6,
    speedScore: 9,
    priceTier: 'budget',
    estimatedCost: 0.003,
    hasVision: true,
    svgDedicated: false,
    description: 'Fast and reliable budget option',
  },
  // Open-source
  {
    id: 'vercel-gateway/qwen/qwen3-vl-32b',
    name: 'Qwen3-VL 32B',
    provider: 'vercel-gateway',
    qualityScore: 7,
    speedScore: 6,
    priceTier: 'budget',
    estimatedCost: 0.008,
    hasVision: true,
    svgDedicated: false,
    description: 'Strong open-source visual agent',
  },
  {
    id: 'vercel-gateway/google/gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'vercel-gateway',
    qualityScore: 8,
    speedScore: 6,
    priceTier: 'standard',
    estimatedCost: 0.06,
    hasVision: true,
    svgDedicated: false,
    description: 'Excellent vision capabilities',
  },
  // Direct providers (legacy)
  {
    id: 'google/gemini-3.1-pro',
    name: 'Gemini 3.1 Pro (Direct)',
    provider: 'google',
    qualityScore: 8,
    speedScore: 6,
    priceTier: 'standard',
    estimatedCost: 0.06,
    hasVision: true,
    svgDedicated: false,
    description: 'Direct Google API',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (Direct)',
    provider: 'openai',
    qualityScore: 8,
    speedScore: 7,
    priceTier: 'standard',
    estimatedCost: 0.05,
    hasVision: true,
    svgDedicated: false,
    description: 'Direct OpenAI API',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5 (Direct)',
    provider: 'anthropic',
    qualityScore: 8,
    speedScore: 7,
    priceTier: 'standard',
    estimatedCost: 0.08,
    hasVision: true,
    svgDedicated: false,
    description: 'Direct Anthropic API',
  },
];

/**
 * Select the best model based on quality preset and available providers.
 * 
 * Priority order:
 * 1. StarVector (dedicated SVG) for all quality levels if available
 * 2. Premium LLMs for 'high' quality
 * 3. Standard LLMs for 'optimized' quality
 * 4. Budget models for 'minimal' quality
 */
export function selectBestModel(
  quality: QualityPreset,
  availableProviders: Set<string>,
): string {
  // Filter to available models
  const available = RANKED_MODELS.filter(m => {
    // Check if provider is available
    return availableProviders.has(m.provider);
  });

  // For all qualities, prefer StarVector if available (it's the best at SVG)
  const starvector = available.find(m => m.svgDedicated);
  if (starvector) {
    return starvector.id;
  }

  // Select by quality tier
  switch (quality) {
    case 'high':
      // Best quality available
      return available
        .filter(m => m.qualityScore >= 8)
        .sort((a, b) => b.qualityScore - a.qualityScore)[0]?.id
        ?? available[0]?.id
        ?? 'google/gemini-3.1-pro';

    case 'optimized':
      // Best price/quality ratio
      return available
        .filter(m => m.priceTier !== 'premium')
        .sort((a, b) => (b.qualityScore / b.estimatedCost) - (a.qualityScore / a.estimatedCost))[0]?.id
        ?? available[0]?.id
        ?? 'google/gemini-2.0-flash';

    case 'minimal':
      // Cheapest with acceptable quality
      return available
        .filter(m => m.priceTier === 'budget' && m.qualityScore >= 5)
        .sort((a, b) => a.estimatedCost - b.estimatedCost)[0]?.id
        ?? available[0]?.id
        ?? 'google/gemini-2.0-flash-lite';

    default:
      return available[0]?.id ?? 'google/gemini-2.0-flash';
  }
}

/**
 * Get model info by ID.
 */
export function getModelInfo(modelId: string): ModelRanking | undefined {
  return RANKED_MODELS.find(m => m.id === modelId);
}

/**
 * Get all models sorted by price/quality ratio.
 */
export function getModelsByValue(): ModelRanking[] {
  return [...RANKED_MODELS].sort(
    (a, b) => (b.qualityScore / b.estimatedCost) - (a.qualityScore / a.estimatedCost),
  );
}
