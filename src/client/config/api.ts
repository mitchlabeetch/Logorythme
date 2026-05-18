const configuredApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

// Default to /api/v1 — works for same-origin deployments (server serves the frontend)
// and for custom deployments where VITE_API_BASE_URL is explicitly set.
export const API_BASE = configuredApiBase || '/api/v1';
export const HAS_CONFIGURED_API = API_BASE.length > 0;
export const API_CONFIG_MESSAGE = HAS_CONFIGURED_API
  ? ''
  : 'API base URL is not configured. Set VITE_API_BASE_URL or serve the app with the default /api/v1 endpoint.';
