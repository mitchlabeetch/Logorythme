/**
 * Global error handling middleware.
 * Converts all errors to RFC 7807 Problem Details format.
 */

import type { Request, Response, NextFunction } from 'express';
import type { ProblemDetails } from '../types.js';
import { getRequestLogger } from '../logger.js';
import { getRequestId } from '../context.js';
import {
  AppError,
  AIProviderError,
  SVGValidationError,
  ImageProcessingError,
  RateLimitError,
  SecurityError,
  ErrorCode,
  RETRYABLE_ERROR_CODES,
} from './index.js';
import { captureError } from './monitor.js';

/** Express error handler middleware */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const logger = getRequestLogger();
  const requestId = getRequestId();

  // Log the error
  logger.error({
    error: err.message,
    stack: err.stack,
    name: err.name,
    requestId,
  }, `Error: ${err.message}`);

  // Send to error monitoring
  captureError(err, { requestId });

  // Convert to RFC 7807 Problem Details
  const problem = errorToProblemDetails(err, requestId);

  res.status(problem.status).json(problem);
}

/** 404 Not Found handler */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = getRequestId();
  const problem: ProblemDetails = {
    type: 'https://api.logorythme.com/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: `The requested resource '${req.path}' was not found.`,
    instance: requestId,
    errorCode: 'NOT_FOUND',
    retryable: false,
  };
  res.status(404).json(problem);
}

/** Convert any Error to RFC 7807 Problem Details */
function errorToProblemDetails(err: Error, requestId: string): ProblemDetails {
  if (err instanceof RateLimitError) {
    return {
      type: 'https://api.logorythme.com/errors/rate-limit',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: err.message,
      instance: requestId,
      errorCode: err.errorCode,
      retryable: true,
      retryAfter: err.retryAfter,
    };
  }

  if (err instanceof AIProviderError) {
    return {
      type: `https://api.logorythme.com/errors/${err.errorCode.toLowerCase()}`,
      title: 'AI Provider Error',
      status: err.statusCode,
      detail: err.message,
      instance: requestId,
      errorCode: err.errorCode,
      retryable: err.retryable,
      retryAfter: err.details?.retryAfter as number | undefined,
    };
  }

  if (err instanceof SVGValidationError) {
    return {
      type: 'https://api.logorythme.com/errors/svg-validation',
      title: 'SVG Validation Failed',
      status: 422,
      detail: err.message,
      instance: requestId,
      errorCode: err.errorCode,
      retryable: false,
    };
  }

  if (err instanceof ImageProcessingError) {
    return {
      type: `https://api.logorythme.com/errors/${err.errorCode.toLowerCase()}`,
      title: 'Image Processing Error',
      status: err.statusCode,
      detail: err.message,
      instance: requestId,
      errorCode: err.errorCode,
      retryable: false,
    };
  }

  if (err instanceof SecurityError) {
    return {
      type: 'https://api.logorythme.com/errors/security',
      title: 'Security Error',
      status: 403,
      detail: err.message,
      instance: requestId,
      errorCode: err.errorCode,
      retryable: false,
    };
  }

  // Multer errors
  if (err.name === 'MulterError') {
    const isTooLarge = err.message.includes('large');
    return {
      type: 'https://api.logorythme.com/errors/upload',
      title: 'Upload Error',
      status: isTooLarge ? 413 : 400,
      detail: err.message,
      instance: requestId,
      errorCode: isTooLarge ? ErrorCode.IMAGE_TOO_LARGE : ErrorCode.INVALID_IMAGE_FORMAT,
      retryable: false,
    };
  }

  // Syntax / JSON parsing errors
  if (err instanceof SyntaxError) {
    return {
      type: 'https://api.logorythme.com/errors/bad-request',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid request body',
      instance: requestId,
      errorCode: 'BAD_REQUEST',
      retryable: false,
    };
  }

  // Generic fallback
  return {
    type: 'https://api.logorythme.com/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: isProduction ? 'An unexpected error occurred' : err.message,
    instance: requestId,
    errorCode: err instanceof AppError ? err.errorCode : ErrorCode.INTERNAL_ERROR,
    retryable: false,
  };
}

import { isProduction } from '../config.js';
