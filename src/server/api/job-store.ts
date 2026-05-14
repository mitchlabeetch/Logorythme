/**
 * Shared in-process job store.
 * In production this would be backed by Redis; the Map is sufficient for a
 * single-process deployment and keeps the two API handlers in sync.
 *
 * Completed and failed jobs are automatically purged after JOB_TTL_MS to
 * prevent unbounded memory growth from stored SVG/PNG base64 payloads.
 */

import type { VectorizeResponse } from '../types.js';

export interface JobEntry {
  status: 'processing' | 'completed' | 'failed';
  result?: VectorizeResponse;
  error?: string;
  /** Epoch ms when the job reached a terminal state (completed | failed). */
  completedAt?: number;
}

export const jobs = new Map<string, JobEntry>();

/** Time-to-live for completed/failed jobs (default: 30 minutes). */
const JOB_TTL_MS = 30 * 60 * 1000;

/** Purge interval — runs every 5 minutes. */
const PURGE_INTERVAL_MS = 5 * 60 * 1000;

function purgeExpiredJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (
      job.status !== 'processing' &&
      job.completedAt !== undefined &&
      job.completedAt < cutoff
    ) {
      jobs.delete(id);
    }
  }
}

// Run periodic cleanup; unref() so this timer doesn't keep the process alive.
const purgeTimer = setInterval(purgeExpiredJobs, PURGE_INTERVAL_MS);
purgeTimer.unref();
