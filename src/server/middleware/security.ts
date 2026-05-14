/**
 * Security middleware: Helmet, CORS, rate limiting.
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, isDevelopment } from '../config.js';
import { RateLimitError } from '../errors/index.js';

/** Helmet security headers */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: !isDevelopment,
  xContentTypeOptions: true,
  xFrameOptions: { action: 'deny' },
});

/** CORS middleware */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isDevelopment) return callback(null, true);
    const allowed = config.corsOrigin === '*' || config.corsOrigin.split(',').includes(origin);
    if (allowed) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400,
});

/** Rate limiting middleware */
export const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/health'),
  handler: (_req, _res, _next, options) => {
    throw new RateLimitError(
      `Too many requests. Limit: ${options.max} per ${options.windowMs / 1000}s`,
      Math.ceil(options.windowMs / 1000),
    );
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});
