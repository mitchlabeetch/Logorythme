/**
 * GET /api/v1/status/:jobId — Job status endpoint.
 */

import type { Request, Response, NextFunction } from 'express';
import { getRequestLogger } from '../logger.js';
import { jobs } from './job-store.js';

/** Status request handler */
export function statusHandler(req: Request, res: Response, next: NextFunction): void {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      res.status(404).json({
        type: 'https://api.logorythme.com/errors/not-found',
        title: 'Job Not Found',
        status: 404,
        detail: `No job found with ID: ${jobId}`,
        instance: jobId,
        errorCode: 'NOT_FOUND',
        retryable: false,
      });
      return;
    }

    res.status(200).json({
      jobId,
      status: job.status,
      result: job.status === 'completed' ? job.result : undefined,
      error: job.status === 'failed' ? job.error : undefined,
    });
  } catch (error) {
    next(error);
  }
}
