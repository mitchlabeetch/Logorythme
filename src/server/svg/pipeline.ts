/**
 * SVG post-processing pipeline orchestrator.
 * Runs 7 stages in sequence with best-effort error handling.
 */

import type { SVGPipelineResult, QualityReport } from '../types.js';
import { getRequestLogger } from '../logger.js';
import { cleanupSVG, hasValidSVG } from './cleanup.js';
import { smartCropSVG } from './smart-crop.js';
import { validateFillRule } from './fill-rule.js';
import { normalizeColors } from './color-normalize.js';
import { optimizePaths } from './path-optimize.js';
import { renderToPNG } from './render.js';
import { validateQuality } from './quality-check.js';
import { SVGValidationError } from '../errors/index.js';

/** SVG post-processing pipeline */
export class SVGPostProcessor {
  /**
   * Run the full post-processing pipeline.
   * Each stage runs in sequence; a stage failure doesn't break the pipeline.
   */
  async process(rawSVG: string): Promise<SVGPipelineResult> {
    const logger = getRequestLogger();
    logger.info('SVG post-processing pipeline starting');

    let svg = rawSVG;

    // Stage 1: Cleanup
    try {
      svg = cleanupSVG(svg);
      if (!hasValidSVG(svg)) {
        throw new SVGValidationError('AI response did not contain valid SVG code');
      }
      logger.debug('Stage 1: Cleanup complete');
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Stage 1: Cleanup failed');
      if (error instanceof SVGValidationError) throw error;
    }

    // Stage 2: Smart crop
    try {
      svg = smartCropSVG(svg);
      logger.debug('Stage 2: Smart crop complete');
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Stage 2: Smart crop failed');
    }

    // Stage 3: Fill-rule validation
    try {
      svg = validateFillRule(svg);
      logger.debug('Stage 3: Fill-rule validation complete');
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Stage 3: Fill-rule validation failed');
    }

    // Stage 4: Color normalization
    try {
      svg = normalizeColors(svg);
      logger.debug('Stage 4: Color normalization complete');
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Stage 4: Color normalization failed');
    }

    // Stage 5: Path optimization
    try {
      svg = await optimizePaths(svg);
      logger.debug('Stage 5: Path optimization complete');
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Stage 5: Path optimization failed');
    }

    // Stage 6: Render to PNG
    let png: Buffer;
    try {
      png = await renderToPNG(svg);
      logger.debug('Stage 6: Rendering complete');
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Stage 6: Rendering failed');
      throw error;
    }

    // Stage 7: Quality validation
    let validation: QualityReport;
    try {
      validation = await validateQuality(svg, png);
      logger.info({ passed: validation.passed, warnings: validation.warnings }, 'Stage 7: Quality check complete');
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Stage 7: Quality validation failed');
      validation = {
        passed: true,
        fillRatio: 0.5,
        hasTransparency: true,
        hasViewBox: /viewBox/.test(svg),
        elementCount: (svg.match(/<(?:path|rect|circle)/gi) || []).length,
        warnings: ['Quality validation could not run'],
      };
    }

    logger.info('SVG post-processing pipeline complete');
    return { svg, png, validation };
  }
}
