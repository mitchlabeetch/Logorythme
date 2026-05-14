/**
 * Shared in-process job store.
 * In production this would be backed by Redis; the Map is sufficient for a
 * single-process deployment and keeps the two API handlers in sync.
 */

import type { VectorizeResponse } from '../types.js';

export interface JobEntry {
  status: 'processing' | 'completed' | 'failed';
  result?: VectorizeResponse;
  error?: string;
}

export const jobs = new Map<string, JobEntry>();
