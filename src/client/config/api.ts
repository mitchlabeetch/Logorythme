const configuredApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const isDevelopment = import.meta.env.DEV;

// In production we require explicit API configuration for static frontend deployments.
export const API_BASE = configuredApiBase || (isDevelopment ? '/api/v1' : '');
export const HAS_CONFIGURED_API = API_BASE.length > 0;
export const API_CONFIG_MESSAGE =
  'Vectorization API is not configured for this deployment. Set VITE_API_BASE_URL to your backend API base URL.';
