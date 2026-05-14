/**
 * Stage 7: Quality validation.
 * Automated quality checks on rendered output.
 */

import sharp from 'sharp';
import type { QualityReport } from '../types.js';
import { getRequestLogger } from '../logger.js';

/**
 * Validate rendered SVG quality.
 */
export async function validateQuality(svg: string, pngBuffer: Buffer): Promise<QualityReport> {
  const logger = getRequestLogger();
  logger.debug('Quality check stage starting');

  const warnings: string[] = [];

  // Check 1: SVG has viewBox
  const hasViewBox = /viewBox=['"]\s*[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s*['"]/i.test(svg);
  if (!hasViewBox) warnings.push('SVG missing viewBox');

  // Check 2: SVG has content
  const meaningfulElements = [
    ...svg.matchAll(/<(path|rect|circle|ellipse|polygon|polyline|text|g\b[^>]*)\b/gi),
  ].length;
  if (meaningfulElements === 0) {
    warnings.push('SVG has no meaningful elements');
  }

  // Check 3: Check PNG for transparency
  const { channels, width, height } = await sharp(pngBuffer).metadata();
  const hasTransparency = channels === 4;
  if (!hasTransparency) warnings.push('PNG may lack transparency (expected 4 channels)');

  // Check 4: Compute fill ratio from alpha channel
  const raw = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();

  let totalPixels = width! * height!;
  let whitePixels = 0;

  for (let i = 0; i < raw.length; i += 4) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    const a = raw[i + 3];
    // Count pixels that are white-ish and visible
    if (a > 10 && r > 200 && g > 200 && b > 200) {
      whitePixels++;
    }
  }

  const fillRatio = totalPixels > 0 ? whitePixels / totalPixels : 0;

  // Quality checks
  if (fillRatio < 0.05) warnings.push('Logo appears nearly empty (low fill ratio)');
  if (fillRatio > 0.95) warnings.push('Logo appears as a solid blob (possible missing cutouts)');

  const passed = warnings.length === 0 || (warnings.length <= 2 && fillRatio >= 0.05 && fillRatio <= 0.95);

  logger.debug({ fillRatio: Math.round(fillRatio * 100) / 100, warnings: warnings.length }, 'Quality check complete');

  return {
    passed,
    fillRatio: Math.round(fillRatio * 100) / 100,
    hasTransparency,
    hasViewBox,
    elementCount: meaningfulElements,
    warnings,
  };
}
