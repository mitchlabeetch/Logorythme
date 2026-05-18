import { useState, useCallback } from 'react';
import type { VectorizeResponse } from '@server/types';
import { API_BASE } from '../config/api';

export type ProcessingState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface UseVectorizerResult {
  state: ProcessingState;
  progress: number;
  result: VectorizeResponse | null;
  error: string | null;
  upload: (file: File, quality?: string, model?: string) => Promise<void>;
  reset: () => void;
}

export function useVectorizer(): UseVectorizerResult {
  const [state, setState] = useState<ProcessingState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VectorizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, quality = 'optimized', model?: string) => {
    setState('uploading');
    setProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('quality', quality);
      if (model) formData.append('model', model);

      setState('processing');
      setProgress(30);

      const response = await fetch(`${API_BASE}/vectorize`, {
        method: 'POST',
        body: formData,
      });

      setProgress(80);

      if (!response.ok) {
        let message = `Processing failed (${response.status})`;
        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        const isJsonResponse =
          contentType.includes('application/json') ||
          contentType.includes('+json') ||
          contentType.includes('/json');
        if (isJsonResponse) {
          let problem: unknown | undefined;
          try {
            problem = await response.json();
          } catch {
            // Non-JSON error payload; keep generic status-based message.
          }
          if (problem && typeof problem === 'object') {
            const details = problem as { detail?: unknown; title?: unknown };
            if (typeof details.detail === 'string' && details.detail.length > 0) {
              message = details.detail;
            } else if (typeof details.title === 'string' && details.title.length > 0) {
              message = details.title;
            }
          }
        }
        throw new Error(message);
      }

      const data: VectorizeResponse = await response.json();
      setResult(data);
      setState('done');
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  return { state, progress, result, error, upload, reset };
}
