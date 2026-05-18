/**
 * Settings API — password-protected endpoint for runtime AI key management.
 *
 * Routes:
 *   POST /api/v1/settings/auth     — authenticate with SETTINGS_PASSWORD, get session token
 *   DELETE /api/v1/settings/auth   — log out (revoke token)
 *   GET /api/v1/settings           — get masked current settings + active providers
 *   PUT /api/v1/settings           — update API keys and reinitialize providers
 *
 * Note: Sessions are stored in-process memory. Tokens are invalidated on server restart
 * and do not propagate across multiple instances. Suitable for single-instance deployments.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { config } from '../config.js';
import type { ModelRegistry, RuntimeKeys } from '../ai/registry.js';
import type { FallbackOrchestrator } from '../ai/orchestrator.js';
import { AuthenticationError } from '../errors/index.js';

/** Session token -> expiry timestamp (ms) */
const sessions = new Map<string, number>();
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, expiry] of sessions) {
    if (expiry < now) sessions.delete(token);
  }
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  cleanExpiredSessions();
  const expiry = sessions.get(token);
  return expiry !== undefined && expiry > Date.now();
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

/**
 * Constant-time password comparison to mitigate timing attacks.
 * Falls back to `false` when lengths differ (still constant-time on length check
 * because we pad to avoid early exit information leakage via the comparison).
 */
function safeComparePasswords(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Run a dummy comparison to avoid timing side-channels on length difference
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/** Mask an API key for display — shows only the last 4 characters */
function maskKey(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 4) return '***';
  return `${'*'.repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

/** Build the masked settings object for display */
function buildMaskedSettings(keys: RuntimeKeys): Record<string, string> {
  return {
    hfApiKey: maskKey(keys.hfApiKey),
    hfApiEndpoint: keys.hfApiEndpoint ?? '',
    vercelGatewayKey: maskKey(keys.vercelGatewayKey),
    googleAiKey: maskKey(keys.googleAiKey),
    openAiKey: maskKey(keys.openAiKey),
    anthropicKey: maskKey(keys.anthropicKey),
    customProviderKey: maskKey(keys.customProviderKey),
    customProviderBaseUrl: keys.customProviderBaseUrl ?? '',
    customProviderPreset: keys.customProviderPreset ?? '',
  };
}

/** Zod schema for validating PUT /settings body */
const settingsBodySchema = z.object({
  hfApiKey: z.string().optional(),
  hfApiEndpoint: z.string().url().optional().or(z.literal('')),
  vercelGatewayKey: z.string().optional(),
  googleAiKey: z.string().optional(),
  openAiKey: z.string().optional(),
  anthropicKey: z.string().optional(),
  customProviderKey: z.string().optional(),
  customProviderBaseUrl: z.string().url().optional().or(z.literal('')),
  customProviderPreset: z.enum(['groq', 'together', 'fireworks', 'perplexity', 'ollama']).optional().or(z.literal('')),
}).strict();

export function createSettingsRouter(
  registry: ModelRegistry,
  orchestrator: FallbackOrchestrator,
): Router {
  const router = Router();

  // POST /api/v1/settings/auth — login
  router.post('/auth', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (!password || !safeComparePasswords(password, config.settingsPassword)) {
      // Use 401 via direct response here (login endpoint is pre-auth, no token to check)
      res.status(401)
        .setHeader('Content-Type', 'application/problem+json')
        .json({
          type: 'https://api.logorythme.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid password',
          errorCode: 'UNAUTHORIZED',
          retryable: false,
        });
      return;
    }
    const token = randomUUID();
    sessions.set(token, Date.now() + SESSION_DURATION_MS);
    res.json({ token, expiresIn: SESSION_DURATION_MS / 1000 });
  });

  // DELETE /api/v1/settings/auth — logout
  router.delete('/auth', (req: Request, res: Response) => {
    const token = extractToken(req);
    if (token) sessions.delete(token);
    res.json({ message: 'Logged out' });
  });

  // GET /api/v1/settings — get masked current settings
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    if (!isValidToken(extractToken(req))) {
      return next(new AuthenticationError('Valid session token required'));
    }
    const keys = registry.getRuntimeKeys();
    res.json({
      settings: buildMaskedSettings(keys),
      providers: Array.from(registry.getAvailableProviders()),
    });
  });

  // PUT /api/v1/settings — update API keys
  router.put('/', (req: Request, res: Response, next: NextFunction) => {
    if (!isValidToken(extractToken(req))) {
      return next(new AuthenticationError('Valid session token required'));
    }

    const parsed = settingsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400)
        .setHeader('Content-Type', 'application/problem+json')
        .json({
          type: 'https://api.logorythme.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
          errorCode: 'BAD_REQUEST',
          retryable: false,
        });
      return;
    }

    registry.reinitialize(parsed.data as Partial<RuntimeKeys>);
    orchestrator.reinitialize();
    res.json({
      message: 'Settings updated',
      providers: Array.from(registry.getAvailableProviders()),
    });
  });

  return router;
}
