import { useTranslation } from 'react-i18next';
import { Cpu, Sparkles, Zap, Star, Globe, Server } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_BASE, HAS_CONFIGURED_API } from '../config/api';

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  description: string;
  priceTier?: 'budget' | 'standard' | 'premium';
  qualityScore?: number;
}

interface Props {
  models?: ModelEntry[];
  selected?: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

/** Provider icon mapping */
function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case 'huggingface':
      return <Star className="h-3.5 w-3.5 text-yellow-500" aria-hidden="true" />;
    case 'vercel-gateway':
      return <Globe className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />;
    case 'google':
      return <Sparkles className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />;
    case 'openai':
      return <Cpu className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />;
    case 'anthropic':
      return <Sparkles className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />;
    case 'custom':
      return <Server className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />;
    default:
      return <Zap className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />;
  }
}

/** Price tier badge */
function PriceBadge({ tier }: { tier?: 'budget' | 'standard' | 'premium' }) {
  if (!tier) return null;
  const colors = {
    budget: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    standard: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    premium: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[tier]}`}>
      {tier}
    </span>
  );
}

/** Default models — expanded with all new providers */
const DEFAULT_MODELS: ModelEntry[] = [
  { id: 'auto', name: 'Auto', provider: 'system', description: 'Best available (StarVector if configured)', priceTier: 'standard', qualityScore: 10 },
  // Hugging Face — dedicated SVG
  { id: 'huggingface/starvector-8b', name: 'StarVector 8B', provider: 'huggingface', description: 'SOTA dedicated SVG model (CVPR 2025)', priceTier: 'standard', qualityScore: 10 },
  { id: 'huggingface/starvector-1b', name: 'StarVector 1B', provider: 'huggingface', description: 'Fast dedicated SVG model', priceTier: 'budget', qualityScore: 8 },
  // Vercel AI Gateway
  { id: 'vercel-gateway/google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'vercel-gateway', description: 'Very cheap, good quality', priceTier: 'budget', qualityScore: 7 },
  { id: 'vercel-gateway/openai/gpt-4o', name: 'GPT-4o', provider: 'vercel-gateway', description: 'Excellent detail recognition', priceTier: 'standard', qualityScore: 8 },
  { id: 'vercel-gateway/anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'vercel-gateway', description: 'Great SVG code quality', priceTier: 'standard', qualityScore: 8 },
  { id: 'vercel-gateway/anthropic/claude-opus-4.7', name: 'Claude Opus 4.7', provider: 'vercel-gateway', description: 'Best SVG code quality', priceTier: 'premium', qualityScore: 9 },
  { id: 'vercel-gateway/xai/grok-3.5', name: 'Grok 3.5', provider: 'vercel-gateway', description: 'Strong vision', priceTier: 'standard', qualityScore: 7 },
  { id: 'vercel-gateway/meta/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'vercel-gateway', description: 'Open-source multimodal', priceTier: 'budget', qualityScore: 6 },
  { id: 'vercel-gateway/qwen/qwen3-vl-32b', name: 'Qwen3-VL 32B', provider: 'vercel-gateway', description: 'Advanced visual agent', priceTier: 'budget', qualityScore: 7 },
  // Direct providers
  { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro (Direct)', provider: 'google', description: 'Direct Google API', priceTier: 'standard', qualityScore: 8 },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Direct)', provider: 'google', description: 'Fast, good quality', priceTier: 'standard', qualityScore: 7 },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Direct)', provider: 'openai', description: 'Direct OpenAI API', priceTier: 'standard', qualityScore: 8 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Direct)', provider: 'openai', description: 'Fast and affordable', priceTier: 'budget', qualityScore: 6 },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5 (Direct)', provider: 'anthropic', description: 'Direct Anthropic API', priceTier: 'standard', qualityScore: 8 },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5 (Direct)', provider: 'anthropic', description: 'Maximum precision', priceTier: 'premium', qualityScore: 9 },
  // Custom providers
  { id: 'custom/groq-llama-vision', name: 'Groq (Llama Vision)', provider: 'custom', description: 'Ultra-fast inference', priceTier: 'budget', qualityScore: 6 },
  { id: 'custom/together-llama-vision', name: 'Together AI', provider: 'custom', description: 'Open-source hosting', priceTier: 'budget', qualityScore: 6 },
  { id: 'custom/ollama-llava', name: 'Ollama (Local)', provider: 'custom', description: 'Local model serving', priceTier: 'budget', qualityScore: 5 },
];

export default function ModelSelector({ models = DEFAULT_MODELS, selected = 'auto', onChange, disabled }: Props) {
  const { t } = useTranslation();
  const [apiModels, setApiModels] = useState<ModelEntry[] | null>(null);

  // Fetch available models from API
  useEffect(() => {
    if (!HAS_CONFIGURED_API) return;

    fetch(`${API_BASE}/models`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.models?.length > 0) {
          setApiModels(data.models.map((m: ModelEntry) => ({
            ...m,
            id: m.id,
            name: m.name,
            provider: m.provider,
            description: m.description,
          })));
        }
      })
      .catch(() => {}); // Silently fail, use defaults
  }, []);

  const displayModels = apiModels ?? models;

  return (
    <div className="flex items-center gap-2">
      <Cpu className="h-4 w-4 text-gray-400" aria-hidden="true" />
      <label htmlFor="model-select" className="sr-only">{t('model.label')}</label>
      <select
        id="model-select"
        value={selected}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[200px]"
      >
        <optgroup label={t('model.recommended') || 'Recommended'}>
          {displayModels.filter(m => m.provider === 'huggingface' || m.id === 'auto').map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.description}
            </option>
          ))}
        </optgroup>
        <optgroup label="Vercel AI Gateway">
          {displayModels.filter(m => m.provider === 'vercel-gateway').map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.description}
            </option>
          ))}
        </optgroup>
        <optgroup label="Direct Providers">
          {displayModels.filter(m => ['google', 'openai', 'anthropic'].includes(m.provider)).map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.description}
            </option>
          ))}
        </optgroup>
        <optgroup label="Custom Providers">
          {displayModels.filter(m => m.provider === 'custom').map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.description}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
