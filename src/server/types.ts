/**
 * Shared TypeScript types for the Logorythme logo vectorization microservice.
 * Defines all domain interfaces used across server modules.
 */

/** Vectorization quality preset */
export type QualityPreset = 'high' | 'optimized' | 'minimal';

/** AI model provider identifier */
export type ProviderName = 'google' | 'openai' | 'anthropic' | 'huggingface' | 'vercel-gateway' | 'custom';

/** Processing stage names */
export type ProcessingStageName =
  | 'upload'
  | 'analyze'
  | 'preprocess'
  | 'vectorize'
  | 'cleanup'
  | 'smartCrop'
  | 'fillRule'
  | 'colorNormalize'
  | 'pathOptimize'
  | 'render'
  | 'qualityCheck'
  | 'complete';

/** Options for vectorization requests */
export interface VectorizeOptions {
  /** Quality preset for the output */
  quality: QualityPreset;
  /** Force all fills to pure white */
  forceWhite: boolean;
  /** Specific model to use (optional) */
  model?: string;
}

/** Result from AI provider with SVG output */
export interface AIResult {
  /** Generated SVG code */
  svg: string;
  /** Model used for generation */
  model: string;
  /** Provider that served the request */
  provider: ProviderName;
  /** Token usage if available */
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/** Quality assessment report for generated output */
export interface QualityReport {
  /** Whether quality checks passed */
  passed: boolean;
  /** Fill ratio (0-1, ideal 0.15-0.70) */
  fillRatio: number;
  /** Whether output has transparent areas */
  hasTransparency: boolean;
  /** Whether SVG has a proper viewBox */
  hasViewBox: boolean;
  /** Number of meaningful SVG elements */
  elementCount: number;
  /** Quality warnings */
  warnings: string[];
}

/** Complete result from SVG post-processing pipeline */
export interface SVGPipelineResult {
  /** Optimized SVG code */
  svg: string;
  /** Rendered PNG buffer */
  png: Buffer;
  /** Quality validation report */
  validation: QualityReport;
}

/** RFC 7807 Problem Details error response */
export interface ProblemDetails {
  /** URI identifying the error type */
  type: string;
  /** Short human-readable summary */
  title: string;
  /** HTTP status code */
  status: number;
  /** Detailed explanation */
  detail: string;
  /** Request ID for tracking */
  instance: string;
  /** Machine-readable error code */
  errorCode: string;
  /** Whether the client may retry */
  retryable: boolean;
  /** Seconds to wait before retry */
  retryAfter?: number;
}

/** Processing job tracking */
export interface ProcessingJob {
  /** Unique job identifier */
  jobId: string;
  /** Current job status */
  status: JobStatus;
  /** Processing stages with their status */
  stages: StageProgress[];
  /** Processing result (when complete) */
  result?: VectorizeResponse;
  /** Error details (when failed) */
  error?: ProblemDetails;
  /** Creation timestamp */
  createdAt: number;
  /** Completion timestamp */
  completedAt?: number;
}

/** Job status enum */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Progress for a single processing stage */
export interface StageProgress {
  /** Stage identifier */
  name: ProcessingStageName;
  /** Stage display label */
  label: string;
  /** Whether the stage is complete */
  complete: boolean;
  /** Whether the stage failed */
  failed?: boolean;
  /** Stage duration in ms */
  durationMs?: number;
}

/** Response from the vectorize endpoint */
export interface VectorizeResponse {
  /** Job identifier */
  jobId: string;
  /** Generated SVG code */
  svg: string;
  /** PNG as base64 */
  png: string;
  /** Quality validation report */
  quality: QualityReport;
  /** Model that generated the SVG */
  modelUsed: string;
  /** Provider that served the request */
  provider: ProviderName;
  /** Total processing time in ms */
  processingTimeMs: number;
  /** Stages completed */
  stages: StageProgress[];
}

/** Provider health tracking */
export interface ProviderHealth {
  /** Provider name */
  name: ProviderName;
  /** Whether the provider is available */
  available: boolean;
  /** Health score (0-100) */
  healthScore: number;
  /** Last successful request timestamp */
  lastSuccessAt?: number;
  /** Last failure timestamp */
  lastFailureAt?: number;
  /** Consecutive failures count */
  consecutiveFailures: number;
  /** Average response time ms */
  avgResponseTimeMs?: number;
}

/** Request context stored in AsyncLocalStorage */
export interface RequestContext {
  /** Unique request identifier */
  requestId: string;
  /** Request start time */
  startTime: number;
  /** Client IP address */
  ip?: string;
  /** User agent string */
  userAgent?: string;
}

/** Audit log entry for SOC2 compliance */
export interface AuditLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Request ID */
  requestId: string;
  /** Event type */
  event: AuditEventType;
  /** Client IP */
  ip: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Event details */
  details: Record<string, unknown>;
}

/** Audit event types */
export type AuditEventType =
  | 'request_start'
  | 'file_upload'
  | 'processing_start'
  | 'processing_stage'
  | 'processing_complete'
  | 'processing_error'
  | 'request_end';
