/**
 * Stage 6: High-quality rendering.
 * Converts SVG to PNG using sharp.js with optimal settings.
 */

import sharp from 'sharp';
import { getRequestLogger } from '../logger.js';

/**
 * Render SVG to high-quality PNG.
 * Uses high-density rendering for crisp output.
 */
export async function renderToPNG(svg: string): Promise<Buffer> {
  const logger = getRequestLogger();
  logger.debug('Render stage starting');

  try {
    const svgBuffer = Buffer.from(svg, 'utf-8');

    // Render at high resolution then resize for crisp output
    const rendered = await sharp(svgBuffer, {
      density: 300,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
      .png()
      .toBuffer();

    // Trim transparent edges
    const trimmed = await sharp(rendered)
      .trim({ threshold: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Resize to max width 2000px
    const final = await sharp(trimmed)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .png({ compressionLevel: 9, quality: 100 })
      .toBuffer();

    const metadata = await sharp(final).metadata();
    logger.debug({ width: metadata.width, height: metadata.height }, 'Render complete');

    return final;
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Render failed');
    throw error;
  }
}
