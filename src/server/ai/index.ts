/**
 * AI module exports.
 */

export type { IProviderStrategy, ProviderConfig, ModelId } from './provider.js';
export { parseModelId } from './provider.js';

// Direct providers
export { GoogleProvider } from './providers/google.js';
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';

// New providers
export { HuggingFaceProvider } from './providers/huggingface.js';
export { VercelGatewayProvider, ALL_GATEWAY_MODELS, GATEWAY_MODELS } from './providers/vercel-gateway.js';
export { CustomCompatibleProvider, PRESET_PROVIDERS } from './providers/custom-compatible.js';

// Registry and orchestration
export { ModelRegistry, AVAILABLE_MODELS } from './registry.js';
export type { ModelEntry } from './registry.js';
export { FallbackOrchestrator } from './orchestrator.js';

// Model ranking
export { selectBestModel, getModelInfo, getModelsByValue, RANKED_MODELS } from './model-ranker.js';
export type { ModelRanking } from './model-ranker.js';

// Prompts
export { getSystemPrompt } from './prompts/vectorizer.js';
