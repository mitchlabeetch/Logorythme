# Logorythme v2 — Technical Specification

## Overview
Production-ready, provider-agnostic logo vectorization microservice. Accepts raster logo uploads, uses multi-provider AI to generate SVG, applies algorithmic post-processing, and outputs white-on-transparent PNG.

## File Structure
```
/mnt/agents/output/logorythme/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── src/
│   ├── server/
│   │   ├── index.ts                    # Entry point, graceful shutdown
│   │   ├── config.ts                   # Environment configuration
│   │   ├── app.ts                      # Express app factory (helmet, cors, middleware)
│   │   ├── types.ts                    # Shared TypeScript types
│   │   ├── logger.ts                   # Pino structured logger
│   │   ├── context.ts                  # AsyncLocalStorage request context
│   │   ├── errors/
│   │   │   ├── index.ts                # Error classes, error codes, retryable map
│   │   │   ├── middleware.ts           # Global error handler (RFC 7807)
│   │   │   └── monitor.ts              # Sentry/error monitoring integration
│   │   ├── middleware/
│   │   │   ├── security.ts             # Helmet, CSP, rate limiting, input sanitization
│   │   │   ├── request-id.ts           # Request ID generation + context
│   │   │   ├── audit-log.ts            # SOC2 audit logging
│   │   │   └── validate.ts             # Image upload validation (MIME, dimensions, magic)
│   │   ├── health/
│   │   │   └── index.ts                # /health/live, /health/ready endpoints
│   │   ├── ai/
│   │   │   ├── index.ts                # AI abstraction exports
│   │   │   ├── provider.ts             # Provider interface (IProviderStrategy)
│   │   │   ├── registry.ts             # Model registry (maps model IDs to providers)
│   │   │   ├── orchestrator.ts         # FallbackOrchestrator (circuit breaker + retry)
│   │   │   ├── providers/
│   │   │   │   ├── google.ts           # Google Gemini provider
│   │   │   │   ├── openai.ts           # OpenAI provider
│   │   │   │   └── anthropic.ts        # Anthropic Claude provider
│   │   │   └── prompts/
│   │   │       └── vectorizer.ts       # SVG generation system prompt
│   │   ├── svg/
│   │   │   ├── index.ts                # Pipeline orchestrator
│   │   │   ├── pipeline.ts             # SVGPostProcessor class (7 stages)
│   │   │   ├── cleanup.ts              # Stage 1: AI hallucination cleanup
│   │   │   ├── smart-crop.ts           # Stage 2: Content-aware bounding box
│   │   │   ├── fill-rule.ts            # Stage 3: Semantic cutout detection
│   │   │   ├── color-normalize.ts      # Stage 4: Force white, preserve transparency
│   │   │   ├── path-optimize.ts        # Stage 5: SVGO + svgpath optimization
│   │   │   ├── render.ts               # Stage 6: Sharp rendering with density/alpha
│   │   │   └── quality-check.ts        # Stage 7: Automated quality validation
│   │   └── api/
│   │       ├── routes.ts               # Route definitions
│   │       ├── vectorize.ts            # POST /api/v1/vectorize endpoint
│   │       ├── status.ts               # GET /api/v1/status/:jobId endpoint
│   │       └── webhook.ts              # POST /api/v1/webhook/:jobId endpoint
│   └── client/
│       ├── main.tsx                    # React entry point
│       ├── App.tsx                     # Root app component
│       ├── index.css                   # Tailwind + custom styles
│       ├── components/
│       │   ├── AccessibleUpload.tsx    # a11y drag-and-drop upload
│       │   ├── ProcessingStatus.tsx    # Live region status announcements
│       │   ├── SvgPreview.tsx          # Accessible SVG preview
│       │   ├── LayerEditor.tsx         # Keyboard-navigable layer editor
│       │   ├── ThemeToggle.tsx         # Light/dark mode toggle
│       │   ├── ModelSelector.tsx       # AI model selection dropdown
│       │   ├── ErrorDisplay.tsx        # Accessible error messages
│       │   └── DownloadPanel.tsx       # Download actions
│       ├── hooks/
│       │   ├── useVectorizer.ts        # Main vectorization hook
│       │   ├── useI18n.ts             # i18n hook with language switching
│       │   └── useTheme.ts            # Theme management hook
│       └── i18n/
│           ├── index.ts                # i18n configuration (15 languages)
│           ├── detector.ts             # Language detection
│           └── locales/                # Translation files
│               ├── en.json
│               ├── fr.json
│               ├── es.json
│               ├── de.json
│               ├── pt.json
│               ├── ja.json
│               ├── zh.json
│               ├── ko.json
│               ├── it.json
│               ├── nl.json
│               ├── pl.json
│               ├── tr.json
│               ├── ar.json
│               ├── vi.json
│               └── id.json
```

## Key Interfaces

### AI Provider Interface
```typescript
interface IProviderStrategy {
  readonly name: string;
  readonly supportedModels: string[];
  generateVectorSVG(imageBase64: string, mimeType: string, options: VectorizeOptions): Promise<AIResult>;
}

interface AIResult {
  svg: string;
  model: string;
  provider: string;
  usage?: { promptTokens: number; completionTokens: number };
}

interface VectorizeOptions {
  quality: 'high' | 'optimized' | 'minimal';
  forceWhite: boolean;
  model?: string;
}
```

### SVG Pipeline Interface
```typescript
interface SVGPipelineResult {
  svg: string;          // Optimized SVG
  png: Buffer;          // Rendered PNG
  validation: QualityReport;
}

interface QualityReport {
  passed: boolean;
  fillRatio: number;    // 0-1, ideal 0.15-0.70
  hasTransparency: boolean;
  hasViewBox: boolean;
  elementCount: number;
  warnings: string[];
}
```

### Error Response (RFC 7807)
```typescript
interface ProblemDetails {
  type: string;         // URI identifying error type
  title: string;        // Human-readable summary
  status: number;       // HTTP status code
  detail: string;       // Detailed explanation
  instance: string;     // Request ID
  errorCode: string;    // Machine-readable error code
  retryable: boolean;   // Can client retry?
  retryAfter?: number;  // Seconds to wait before retry
}
```

## Dependencies

### Production
```json
{
  "ai": "^4.0.0",
  "@ai-sdk/openai": "^1.0.0",
  "@ai-sdk/anthropic": "^1.0.0",
  "@ai-sdk/google": "^1.0.0",
  "express": "^4.21.0",
  "helmet": "^8.0.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.5.0",
  "multer": "^2.1.0",
  "sharp": "^0.34.0",
  "svgo": "^4.0.0",
  "svgdom": "^0.1.19",
  "svgpath": "^2.6.0",
  "cockatiel": "^3.2.0",
  "p-retry": "^6.2.0",
  "pino": "^9.0.0",
  "pino-pretty": "^13.0.0",
  "@sentry/node": "^8.0.0",
  "prom-client": "^15.0.0",
  "zod": "^3.24.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-i18next": "^15.0.0",
  "i18next": "^24.0.0",
  "i18next-browser-languagedetector": "^8.0.0",
  "i18next-http-backend": "^3.0.0",
  "lucide-react": "^0.546.0",
  "jszip": "^3.10.0",
  "file-saver": "^2.0.5"
}
```

## Implementation Order
1. Core infrastructure (config, logger, context, errors)
2. AI provider layer (interface + 3 providers + orchestrator)
3. SVG processing pipeline (7 stages)
4. Express API (routes + middleware + health checks)
5. React frontend (components + hooks + a11y)
6. i18n (15 language files)
7. Integration and wiring

## Quality Gates
- All endpoints return RFC 7807 error responses
- All AI calls go through circuit breaker + retry
- All SVGs pass quality validation before returning
- All UI components have ARIA attributes + keyboard support
- All user-facing text is i18n-keyed (15 languages)
- Security headers via Helmet on all responses
- Audit logs for all upload/processing events
