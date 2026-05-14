/**
 * SOC2 audit logging middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import { getRequestLogger, auditLog } from '../logger.js';
import { getRequestId } from '../context.js';
import type { AuditEventType } from '../types.js';

/** Audit logging middleware */
export function auditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const logger = getRequestLogger();
  const requestId = getRequestId();

  auditLog('request_start', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Log file uploads
  if (req.file) {
    auditLog('file_upload', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  }

  const startTime = Date.now();

  res.on('finish', () => {
    auditLog('request_end', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
    });
  });

  next();
}

/** Log a specific audit event */
export function logAuditEvent(event: AuditEventType, details: Record<string, unknown>): void {
  auditLog(event, details);
}
