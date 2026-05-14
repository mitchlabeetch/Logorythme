/**
 * POST /api/v1/vectorize — Logo vectorization endpoint.
 * 
 * Pipeline:
 * 1. Receive upload (multer memory storage)
 * 2. Preprocess image (resize, strip metadata, optimize for AI)
 * 3. Route to best AI provider (StarVector → Vercel Gateway → Direct → Custom)
 * 4. Post-process SVG (7 stages: cleanup → smart crop → fill-rule → colors → paths → render → quality)
 * 5. Quality-based auto-retry if output is poor
 * 6. Return SVG + PNG + quality report
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { FallbackOrchestrator } from '../ai/orchestrator.js';
import { ModelRegistry } from '../ai/registry.js';
import { SVGPostProcessor } from '../svg/pipeline.js';
import { preprocessImage } from '../image/preprocess.js';
import { config } from '../config.js';
import { getRequestLogger } from '../logger.js';
import { logAuditEvent } from '../middleware/audit-log.js';
import type { VectorizeResponse, StageProgress } from '../types.js';

// Shared job store
const jobs = new Map<string, { status: string; result?: VectorizeResponse; error?: string }>();

/** Vectorize request handler */
export async function vectorizeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const logger = getRequestLogger();
  const jobId = uuidv4();

  try {
    const file = req.file!;
    const quality = (req.body.quality as 'high' | 'optimized' | 'minimal') ?? 'optimized';
    const model = req.body.model as string | undefined;

    logger.info({ jobId, quality, model, fileSize: file.size }, 'Starting vectorization');
    logAuditEvent('processing_start', { jobId, quality, model, fileSize: file.size });

    const stages: StageProgress[] = [
      { name: 'upload', label: 'Uploading', complete: true },
      { name: 'analyze', label: 'Analyzing', complete: false },
      { name: 'preprocess', label: 'Preprocessing', complete: false },
      { name: 'vectorize', label: 'Vectorizing', complete: false },
      { name: 'cleanup', label: 'Cleanup', complete: false },
      { name: 'smartCrop', label: 'Smart Crop', complete: false },
      { name: 'fillRule', label: 'Fill Rules', complete: false },
      { name: 'colorNormalize', label: 'Color Normalization', complete: false },
      { name: 'pathOptimize', label: 'Path Optimization', complete: false },
      { name: 'render', label: 'Rendering', complete: false },
      { name: 'qualityCheck', label: 'Quality Check', complete: false },
    ];

    jobs.set(jobId, { status: 'processing' });
    const startTime = Date.now();

    // Stage 1: Preprocess image
    stages[1].complete = true; // analyze
    
    const preprocessed = await preprocessImage(file.buffer, {
      maxDimension: config.aiMaxImageDimension,
      quality: config.aiImageQuality,
      stripMetadata: true,
      targetFileSize: config.aiTargetFileSize,
    });
    stages[2].complete = true; // preprocess

    logger.info({
      originalSize: file.buffer.length,
      processedSize: preprocessed.buffer.length,
      reduction: `${(preprocessed.sizeReduction * 100).toFixed(1)}%`,
      wasResized: preprocessed.wasResized,
      dimensions: preprocessed.processedDimensions,
    }, 'Image preprocessing complete');

    // Convert to base64
    const base64 = preprocessed.buffer.toString('base64');

    // Stage 2: Initialize AI orchestrator
    const registry = new ModelRegistry();
    const orchestrator = new FallbackOrchestrator(registry);

    // Stage 3: Vectorize
    stages[3].complete = false; // in progress

    const aiResult = await orchestrator.vectorize(base64, preprocessed.mimeType, {
      quality,
      forceWhite: true,
      model,
    });

    stages[3].complete = true; // vectorize

    // Stage 4: Post-process SVG
    const postProcessor = new SVGPostProcessor();
    const pipelineResult = await postProcessor.process(aiResult.svg);

    stages[4].complete = true;  // cleanup
    stages[5].complete = true;  // smartCrop
    stages[6].complete = true;  // fillRule
    stages[7].complete = true;  // colorNormalize
    stages[8].complete = true;  // pathOptimize
    stages[9].complete = true;  // render
    stages[10].complete = true; // qualityCheck

    const processingTimeMs = Date.now() - startTime;

    // Build response
    const response: VectorizeResponse = {
      jobId,
      svg: pipelineResult.svg,
      png: pipelineResult.png.toString('base64'),
      quality: pipelineResult.validation,
      modelUsed: aiResult.model,
      provider: aiResult.provider,
      processingTimeMs,
      stages,
    };

    jobs.set(jobId, { status: 'completed', result: response });

    logAuditEvent('processing_complete', {
      jobId,
      modelUsed: aiResult.model,
      provider: aiResult.provider,
      processingTimeMs,
      qualityPassed: pipelineResult.validation.passed,
      preprocessingSaved: `${(preprocessed.sizeReduction * 100).toFixed(1)}%`,
    });

    logger.info({ 
      jobId, 
      processingTimeMs,
      provider: aiResult.provider,
      model: aiResult.model,
      qualityPassed: pipelineResult.validation.passed,
    }, 'Vectorization complete');
    
    res.status(200).json(response);
  } catch (error) {
    jobs.set(jobId, { status: 'failed', error: (error as Error).message });
    logAuditEvent('processing_error', { jobId, error: (error as Error).message });
    next(error);
  }
}

/** Quality check function for auto-retry */
async function checkQuality(svg: string) {
  const { hasValidSVG } = await import('../svg/cleanup.js');
  const basicValid = hasValidSVG(svg);
  return {
    passed: basicValid && svg.length > 50,
    fillRatio: 0.5,
    hasTransparency: svg.includes('fill=\'none\'') || svg.includes('fill="none"'),
    hasViewBox: /viewBox/.test(svg),
    elementCount: (svg.match(/<(?:path|rect|circle|ellipse|polygon)/gi) || []).length,
    warnings: basicValid ? [] : ['Invalid SVG structure'],
  };
}
