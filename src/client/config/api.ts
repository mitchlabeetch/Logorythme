const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE = configuredApiBase || (import.meta.env.DEV ? '/api/v1' : '');
export const HAS_CONFIGURED_API = API_BASE.length > 0;
export const API_CONFIG_MESSAGE =
  'Vectorization API is not configured for this deployment. Set VITE_API_BASE_URL to a live backend URL ending with /api/v1.';
