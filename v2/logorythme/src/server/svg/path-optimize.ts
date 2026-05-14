/**
 * Stage 5: Path optimization.
 * Uses SVGO and svgpath for path optimization while preserving viewBox.
 */

import { optimize } from 'svgo';
import SVGPath from 'svgpath';
import { getRequestLogger } from '../logger.js';

/** SVGO configuration that preserves semantic cutouts */
const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    { name: 'preset-default', params: {
      overrides: {
        removeViewBox: false,
        cleanupIds: false,
        mergePaths: false, // Keep separate paths for semantic cutouts
        convertShapeToPath: true,
        removeUselessStrokeAndFill: false,
        removeEmptyAttrs: true,
        removeEmptyContainers: true,
        collapseGroups: false,
      },
    }},
    'convertPathData',
    {
      name: 'convertPathData',
      params: {
        floatPrecision: 2,
        transformPrecision: 2,
        noSpaceAfterFlags: true,
      },
    },
    {
      name: 'removeAttrs',
      params: {
        attrs: ['xmlns:xlink', 'xmlns:ev', 'xmlns:svg', 'xml:space'],
      },
    },
  ],
};

/**
 * Optimize SVG paths using SVGO and svgpath.
 * Preserves viewBox and semantic cutouts.
 */
export async function optimizePaths(svg: string): Promise<string> {
  const logger = getRequestLogger();
  logger.debug('Path optimization stage starting');

  try {
    // Run SVGO
    const result = optimize(svg, SVGO_CONFIG);
    let optimized = result.data;

    // Additional path optimization with svgpath
    optimized = optimized.replace(/d=['"]([^'"]*)['"]/gi, (match, d) => {
      try {
        const path = new SVGPath(d)
          .round(2)
          .toString();
        return `d='${path}'`;
      } catch {
        return match; // Keep original if parsing fails
      }
    });

    logger.debug({
      originalSize: svg.length,
      optimizedSize: optimized.length,
    }, 'Path optimization complete');

    return optimized;
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'SVGO optimization failed');
    return svg; // Return unoptimized on failure
  }
}
