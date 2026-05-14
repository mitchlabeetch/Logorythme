/**
 * Settings API — password-protected endpoint for runtime AI key management.
 *
 * Routes:
 *   POST /api/v1/settings/auth     — authenticate with SETTINGS_PASSWORD, get session token
 *   DELETE /api/v1/settings/auth   — log out (revoke token)
 *   GET /api/v1/settings           — get masked current settings + active providers
 *   PUT /api/v1/settings           — update API keys and reinitialize providers
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import type { ModelRegistry, RuntimeKeys } from '../ai/registry.js';
import type { FallbackOrchestrator } from '../ai/orchestrator.js';

/** Session token -> expiry timestamp (ms) */
const sessions = new Map<string, number>();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

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

/** Mask an API key for display (show first 4 and last 4 chars) */
function maskKey(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 8, 8))}${value.slice(-4)}`;
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

export function createSettingsRouter(
  registry: ModelRegistry,
  orchestrator: FallbackOrchestrator,
): Router {
  const router = Router();

  // POST /api/v1/settings/auth — login
  router.post('/auth', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (!password || password !== config.settingsPassword) {
      res.status(401).json({ error: 'Invalid password' });
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
  router.get('/', (req: Request, res: Response) => {
    if (!isValidToken(extractToken(req))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const keys = registry.getRuntimeKeys();
    res.json({
      settings: buildMaskedSettings(keys),
      providers: Array.from(registry.getAvailableProviders()),
    });
  });

  // PUT /api/v1/settings — update API keys
  router.put('/', (req: Request, res: Response) => {
    if (!isValidToken(extractToken(req))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = req.body as Partial<RuntimeKeys>;
    registry.reinitialize(body);
    orchestrator.reinitialize();
    res.json({
      message: 'Settings updated',
      providers: Array.from(registry.getAvailableProviders()),
    });
  });

  return router;
}
