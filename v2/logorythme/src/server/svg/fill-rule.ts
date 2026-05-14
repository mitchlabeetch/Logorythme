/**
 * Stage 3: Semantic cutout detection.
 * Detects shapes containing inner elements and applies fill-rule='evenodd'
 * to create readable cutouts (e.g., letters inside shapes).
 */

import { getRequestLogger } from '../logger.js';

/**
 * Detect if an SVG contains shapes with inner text/elements
 * and ensure proper fill-rule for semantic cutouts.
 */
export function validateFillRule(svg: string): string {
  const logger = getRequestLogger();
  logger.debug('Fill-rule validation stage starting');

  try {
    // Find groups (<g>) that contain both a path/rect/shape and text
    // These are candidates for evenodd fill-rule
    const hasShapeWithText = /<g\b[^>]*>[\s\S]*?<(?:path|rect|circle|ellipse|polygon)\b[\s\S]*?<text[\s\S]*?<\/g>/i.test(svg) ||
      /<g\b[^>]*>[\s\S]*?<text[\s\S]*?<(?:path|rect|circle|ellipse|polygon)[\s\S]*?<\/g>/i.test(svg);

    // Find shapes that have nested tspan elements (text inside shape via foreignObject or similar)
    const hasNestedText = /<(?:path|rect|circle|ellipse|polygon)[^>]*>[\s\S]*?<tspan/i.test(svg);

    if (!hasShapeWithText && !hasNestedText) {
      logger.debug('No semantic cutouts detected');
      return svg;
    }

    logger.debug({ hasShapeWithText, hasNestedText }, 'Semantic cutouts detected');

    // Apply fill-rule='evenodd' to shapes that likely need it:
    // 1. The outermost shape in a group that also contains text
    // 2. Shapes with clip-path references
    // 3. Complex paths with multiple subpaths that might be holes

    let processed = svg;

    // Add fill-rule="evenodd" to outer shape in text-containing groups
    processed = processed.replace(
      /(<g\b[^>]*>[\s\S]*?<(?:path|rect|circle|ellipse|polygon)\b)([^>]*?)(\s*\/?>)/i,
      (match, start, attrs, end) => {
        if (!/fill-rule=/i.test(attrs)) {
          return `${start}${attrs} fill-rule='evenodd'${end}`;
        }
        return match;
      },
    );

    // Add fill-rule="evenodd" to any shape that's followed by text in the same group
    processed = processed.replace(
      /(<(?:path|rect|circle|ellipse|polygon)\b[^>]*>)[\s\S]*?(<text\b)/gi,
      (match, shape, text) => {
        if (!/fill-rule=/i.test(match)) {
          return match.replace(shape, `${shape.slice(0, -1)} fill-rule='evenodd'>`);
        }
        return match;
      },
    );

    // Ensure paths with multiple M/m commands (likely compound paths) have evenodd
    processed = processed.replace(
      /(<path\b[^>]*?d=['"])([^'"]*[Mm][^'"]*[Mm][^'"]*)(['"][^>]*>)/gi,
      (match, start, d, end) => {
        if (!/fill-rule=/i.test(match)) {
          return `${start}${d}${end.slice(0, -1)} fill-rule='evenodd'>`;
        }
        return match;
      },
    );

    logger.debug('Fill-rule validation complete');
    return processed;
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Fill-rule validation failed');
    return svg;
  }
}
