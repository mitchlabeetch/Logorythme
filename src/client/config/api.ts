const configuredApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

// Default to /api/v1 — works for same-origin deployments (server serves the frontend)
// and for custom deployments where VITE_API_BASE_URL is explicitly set.
export const API_BASE = configuredApiBase || '/api/v1';
export const HAS_CONFIGURED_API = true;
export const API_CONFIG_MESSAGE = '';
