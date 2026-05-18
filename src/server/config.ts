/**
 * Environment configuration with Zod validation.
 * Centralizes all runtime configuration for the service.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // AI Provider Keys
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Hugging Face
  HF_API_KEY: z.string().optional(),
  HF_API_ENDPOINT: z.string().optional(),
  
  // Vercel AI Gateway
  VERCEL_GATEWAY_KEY: z.string().optional(),
  
  // Custom OpenAI-compatible providers
  CUSTOM_PROVIDER_KEY: z.string().optional(),
  CUSTOM_PROVIDER_BASE_URL: z.string().optional(),
  CUSTOM_PROVIDER_PRESET: z.enum(['groq', 'together', 'fireworks', 'perplexity', 'ollama']).optional(),

  // Security
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('10'),
  CORS_ORIGIN: z.string().default('*'),

  // AI Defaults — now uses StarVector as default if available
  DEFAULT_MODEL: z.string().default('huggingface/starvector-8b'),
  FALLBACK_MODELS: z.string().default(
    'vercel-gateway/google/gemini-2.0-flash,google/gemini-2.5-flash,openai/gpt-4o',
  ),

  // File handling
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('10'),
  RETENTION_DAYS: z.string().transform(Number).default('30'),
  
  // Image preprocessing
  AI_MAX_IMAGE_DIMENSION: z.string().transform(Number).default('1024'),
  AI_IMAGE_QUALITY: z.string().transform(Number).default('90'),
  AI_TARGET_FILE_SIZE: z.string().transform(Number).default('5242880'), // 5MB

  // Monitoring
  SENTRY_DSN: z.string().optional(),

  // Settings GUI
  SETTINGS_PASSWORD: z.string().default('admin'),
});

/** Parsed and validated configuration */
export interface Config {
  readonly port: number;
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly logLevel: string;
  
  // AI Provider Keys
  readonly googleAiKey?: string;
  readonly openAiKey?: string;
  readonly anthropicKey?: string;
  readonly hfApiKey?: string;
  readonly hfApiEndpoint?: string;
  readonly vercelGatewayKey?: string;
  readonly customProviderKey?: string;
  readonly customProviderBaseUrl?: string;
  readonly customProviderPreset?: string;
  
  // Security
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
  readonly corsOrigin: string;
  
  // AI Defaults
  readonly defaultModel: string;
  readonly fallbackModels: string[];
  
  // File handling
  readonly maxFileSizeBytes: number;
  readonly retentionDays: number;
  
  // Image preprocessing
  readonly aiMaxImageDimension: number;
  readonly aiImageQuality: number;
  readonly aiTargetFileSize: number;
  
  // Monitoring
  readonly sentryDsn?: string;

  // Settings GUI
  readonly settingsPassword: string;
}

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  const env = result.data;

  return Object.freeze({
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    
    // AI Provider Keys
    googleAiKey: env.GOOGLE_AI_API_KEY,
    openAiKey: env.OPENAI_API_KEY,
    anthropicKey: env.ANTHROPIC_API_KEY,
    hfApiKey: env.HF_API_KEY,
    hfApiEndpoint: env.HF_API_ENDPOINT,
    vercelGatewayKey: env.VERCEL_GATEWAY_KEY,
    customProviderKey: env.CUSTOM_PROVIDER_KEY,
    customProviderBaseUrl: env.CUSTOM_PROVIDER_BASE_URL,
    customProviderPreset: env.CUSTOM_PROVIDER_PRESET,
    
    // Security
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    corsOrigin: env.CORS_ORIGIN,
    
    // AI Defaults
    defaultModel: env.DEFAULT_MODEL,
    fallbackModels: env.FALLBACK_MODELS.split(',').map(s => s.trim()).filter(Boolean),
    
    // File handling
    maxFileSizeBytes: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    retentionDays: env.RETENTION_DAYS,
    
    // Image preprocessing
    aiMaxImageDimension: env.AI_MAX_IMAGE_DIMENSION,
    aiImageQuality: env.AI_IMAGE_QUALITY,
    aiTargetFileSize: env.AI_TARGET_FILE_SIZE,
    
    // Monitoring
    sentryDsn: env.SENTRY_DSN,

    // Settings GUI
    settingsPassword: env.SETTINGS_PASSWORD,
  });
}

/** Runtime configuration singleton */
export const config = loadConfig();

/** Runtime environment checks */
export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';
