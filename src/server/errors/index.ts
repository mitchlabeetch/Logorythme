/**
 * Error classification, codes, and custom error classes.
 * All errors extend AppError and carry structured metadata
 * for RFC 7807 Problem Details conversion.
 */

/** Machine-readable error codes for classification */
export enum ErrorCode {
  // Transient errors (retryable)
  AI_PROVIDER_TIMEOUT = 'AI_TIMEOUT',
  AI_PROVIDER_RATE_LIMIT = 'AI_RATE_LIMIT',
  AI_PROVIDER_OVERLOADED = 'AI_OVERLOADED',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Permanent errors (non-retryable)
  INVALID_IMAGE_FORMAT = 'INVALID_FORMAT',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  IMAGE_CORRUPTED = 'IMAGE_CORRUPTED',
  SVG_VALIDATION_FAILED = 'SVG_VALIDATION',
  SVG_RENDERING_FAILED = 'SVG_RENDER',
  UNSUPPORTED_COLOR_SPACE = 'UNSUPPORTED_COLOR',

  // Dependency errors
  AI_PROVIDER_UNAVAILABLE = 'AI_UNAVAILABLE',
  ALL_PROVIDERS_DOWN = 'ALL_PROVIDERS_DOWN',

  // Infrastructure errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIG_ERROR',
}

/** Set of error codes that support client retry */
export const RETRYABLE_ERROR_CODES = new Set([
  ErrorCode.AI_PROVIDER_TIMEOUT,
  ErrorCode.AI_PROVIDER_RATE_LIMIT,
  ErrorCode.AI_PROVIDER_OVERLOADED,
  ErrorCode.NETWORK_ERROR,
]);

/** Base application error */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: ErrorCode;

  constructor(
    message: string,
    public readonly retryable = false,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

/** AI provider errors: timeouts, rate limits, API failures */
export class AIProviderError extends AppError {
  readonly statusCode = 502;
  readonly errorCode: ErrorCode;

  constructor(
    message: string,
    errorCode: ErrorCode = ErrorCode.AI_PROVIDER_TIMEOUT,
    retryable?: boolean,
    details?: Record<string, unknown>,
  ) {
    const isRetryable = retryable ?? RETRYABLE_ERROR_CODES.has(errorCode);
    super(message, isRetryable, details);
    this.errorCode = errorCode;
  }

  static rateLimit(provider: string, retryAfter?: number): AIProviderError {
    return new AIProviderError(
      `Rate limited by ${provider}`,
      ErrorCode.AI_PROVIDER_RATE_LIMIT,
      true,
      { provider, retryAfter },
    );
  }

  static timeout(provider: string, timeoutMs: number): AIProviderError {
    return new AIProviderError(
      `AI provider ${provider} timed out after ${timeoutMs}ms`,
      ErrorCode.AI_PROVIDER_TIMEOUT,
      true,
      { provider, timeoutMs },
    );
  }

  static unavailable(provider: string): AIProviderError {
    return new AIProviderError(
      `AI provider ${provider} is unavailable`,
      ErrorCode.AI_PROVIDER_UNAVAILABLE,
      false,
      { provider },
    );
  }
}

/** SVG validation errors: malformed output, structural issues */
export class SVGValidationError extends AppError {
  readonly statusCode = 422;
  readonly errorCode = ErrorCode.SVG_VALIDATION_FAILED;
  readonly retryable = false;
}

/** Image processing errors: invalid format, corrupted files */
export class ImageProcessingError extends AppError {
  readonly statusCode = 400;
  readonly errorCode: ErrorCode;
  readonly retryable = false;

  constructor(message: string, errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR) {
    super(message, false);
    this.errorCode = errorCode;
  }

  static invalidFormat(mimeType: string): ImageProcessingError {
    return new ImageProcessingError(
      `Unsupported image format: ${mimeType}`,
      ErrorCode.INVALID_IMAGE_FORMAT,
    );
  }

  static tooLarge(size: number, max: number): ImageProcessingError {
    return new ImageProcessingError(
      `Image too large: ${Math.round(size / 1024 / 1024)}MB (max ${Math.round(max / 1024 / 1024)}MB)`,
      ErrorCode.IMAGE_TOO_LARGE,
    );
  }

  static corrupted(reason: string): ImageProcessingError {
    return new ImageProcessingError(
      `Image appears to be corrupted: ${reason}`,
      ErrorCode.IMAGE_CORRUPTED,
    );
  }
}

/** Rate limit errors: client exceeded rate limit */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly errorCode = ErrorCode.AI_PROVIDER_RATE_LIMIT;
  readonly retryable = true;

  constructor(
    message = 'Too many requests',
    public readonly retryAfter = 60,
  ) {
    super(message, true, { retryAfter });
  }
}

/** Security errors: blocked uploads, sanitization failures */
export class SecurityError extends AppError {
  readonly statusCode = 403;
  readonly errorCode = ErrorCode.INTERNAL_ERROR;
  readonly retryable = false;

  constructor(message: string) {
    super(message, false);
  }
}

/** All providers are down */
export class AllProvidersDownError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.ALL_PROVIDERS_DOWN;
  readonly retryable = true;

  constructor() {
    super('All AI providers are currently unavailable. Please try again later.', true);
  }
}
