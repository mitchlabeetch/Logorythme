import { useState, useCallback } from 'react';
import type { VectorizeResponse } from '@server/types';
import { API_BASE, API_CONFIG_MESSAGE, HAS_CONFIGURED_API } from '../config/api';

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
    if (!HAS_CONFIGURED_API) {
      setError(API_CONFIG_MESSAGE);
      setState('error');
      return;
    }

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
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const problem = await response
            .json()
            .catch(() => null) as { detail?: string; title?: string } | null;
          message = problem?.detail || problem?.title || message;
        } else if (response.status === 404) {
          message = API_CONFIG_MESSAGE;
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
