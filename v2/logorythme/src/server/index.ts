/**
 * Server entry point.
 */

import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { initMonitoring, flushMonitoring } from './errors/monitor.js';
import { httpRequestsTotal } from './health/index.js';

// Track in-flight requests for graceful shutdown
let inFlightRequests = 0;
let server: import('http').Server;
let isShuttingDown = false;

function startServer(): void {
  // Initialize error monitoring
  initMonitoring();

  const app = createApp();

  // Track in-flight requests
  app.use((req, res, next) => {
    if (isShuttingDown) {
      res.status(503).json({ error: 'Server is shutting down' });
      return;
    }
    inFlightRequests++;
    res.on('finish', () => { inFlightRequests--; });
    next();
  });

  server = app.listen(config.port, () => {
    logger.info({
      port: config.port,
      env: config.nodeEnv,
      logLevel: config.logLevel,
    }, 'Logorythme server started');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Unhandled errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Graceful shutdown starting');
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Wait for in-flight requests (max 30 seconds)
  const deadline = setTimeout(() => {
    logger.warn('Forcing shutdown: in-flight requests timed out');
    process.exit(1);
  }, 30000);

  // Poll in-flight requests
  const pollInterval = setInterval(() => {
    if (inFlightRequests === 0) {
      clearInterval(pollInterval);
      clearTimeout(deadline);
      logger.info('All requests completed');
      flushMonitoring().then(() => process.exit(0));
    }
  }, 100);

  logger.info({ inFlightRequests }, 'Waiting for in-flight requests');
}

// Start
startServer();
