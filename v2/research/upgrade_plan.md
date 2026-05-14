# Logorythme v2.1 — Comprehensive Upgrade Plan

## Research Summary

### Best Vision Models for SVG Generation (Price/Quality Ratio)

| Model | Provider | Input $/M | Output $/M | Vision | SVG Quality | Best For |
|-------|----------|-----------|------------|--------|-------------|----------|
| **StarVector-8B** | Hugging Face | $0.00012/sec | GPU time | Yes | **SOTA** (DinoScore 0.984) | Primary: dedicated SVG generation |
| **StarVector-1B** | Hugging Face | $0.00006/sec | GPU time | Yes | Excellent (DinoScore 0.978) | Budget option |
| **Gemini 2.0 Flash** | Google | $0.10 | $0.40 | Yes | Good | Cheapest frontier option |
| **GPT-4o-mini** | OpenAI | $0.15 | $0.60 | Yes | Good | Reliable, fast |
| **Qwen2.5-VL-32B** | Alibaba/Qwen | $0.27 | $1.08 | Yes | Very Good | Strong visual agent |
| **GLM-4.1V-9B** | Z.ai | $0.035 | $0.14 | Yes | Good+ | Cheapest with reasoning |
| **Claude Haiku 3.5** | Anthropic | $0.80 | $4.00 | Yes | Good | Fast, reliable |
| **GPT-4o** | OpenAI | $2.50 | $10.00 | Yes | Excellent | Best quality, expensive |
| **Claude Sonnet 4.6** | Anthropic | $3.00 | $15.00 | Yes | Excellent | Best SVG code quality |

### Key Finding: StarVector
StarVector (CVPR 2025) is a dedicated image-to-SVG foundation model that outperforms all general-purpose LLMs on SVG generation tasks. It transforms vectorization into a code generation task. This should be the **primary** provider, with LLMs as fallback.

### Vercel AI Gateway
- Package: `@ai-sdk/gateway`
- Provides unified access to 100+ models via `gateway("provider/model")`
- Zero token markup, BYOK support
- Automatic failover between providers
- OpenAI Chat Completions API compatible
- Dynamic model discovery via `/v1/models`
- Providers: OpenAI, Anthropic, Google, xAI, Meta, Mistral, DeepSeek, Cohere, Perplexity, Alibaba

### OpenAI-Compatible Providers
- Package: `@ai-sdk/openai-compatible`
- `createOpenAICompatible({ baseURL, apiKey, name })`
- Supports: Groq, Together AI, Fireworks, Ollama, LM Studio, NIM, custom endpoints
- Custom headers, query params, request body transforms
- Metadata extractors for provider-specific responses

## Current Pipeline Audit

### Data Flow Analysis
```
Client Upload → Multer (memory) → Base64 → AI Provider → SVG (raw)
  → Cleanup (regex) → Smart Crop (parse paths) → Fill Rule (heuristics)
  → Color Normalize (regex replace) → Path Optimize (SVGO + svgpath)
  → Render (sharp 300dpi → trim → resize 2000px) → Quality Check (pixel analysis)
```

### Issues Found
1. **No StarVector integration** — missing the best dedicated SVG model
2. **No Vercel AI Gateway** — limited to 3 providers instead of 100+
3. **No custom URL providers** — can't use Groq, Together, Ollama, etc.
4. **Provider list too small** — only 6 models vs 100+ available
5. **No Hugging Face Inference API** — can't use StarVector serverlessly
6. **Image processing before AI** — should validate dimensions before sending
7. **No image preprocessing** — should resize large images before AI to save tokens
8. **No response streaming** — blocks until full SVG received
9. **No quality-based retry** — if quality check fails, should retry with different model

## Implementation Plan

### New Architecture
```
Client Upload → Multer → Image Preprocessing (resize/validate) 
  → Provider Router (StarVector primary, Vercel AI Gateway fallback)
    → Hugging Face Inference API (StarVector-8B/1B)
    → Vercel AI Gateway (100+ models)
    → Custom OpenAI-Compatible (Groq, Together, Ollama, etc.)
  → SVG Post-Processing (7 stages)
  → Quality Check → Auto-Retry if failed
  → Render → Return
```

### New Files
- `src/server/ai/providers/huggingface.ts` — StarVector via HF Inference API
- `src/server/ai/providers/vercel-gateway.ts` — Vercel AI Gateway provider
- `src/server/ai/providers/custom-compatible.ts` — Custom OpenAI-compatible URLs
- `src/server/ai/providers/index.ts` — Provider barrel exports
- `src/server/image/preprocess.ts` — Image preprocessing before AI
- `src/server/ai/model-ranker.ts` — Smart model selection by price/quality
