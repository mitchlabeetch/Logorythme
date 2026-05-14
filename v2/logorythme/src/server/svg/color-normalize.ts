/**
 * Stage 4: Color normalization.
 * Forces all fills to #FFFFFF while preserving transparency.
 */

import { getRequestLogger } from '../logger.js';

const WHITE = "'#FFFFFF'";
const WHITE_D = '"#FFFFFF"';

/**
 * Normalize all color fills to pure white.
 * Preserves transparent elements and stroke attributes.
 */
export function normalizeColors(svg: string): string {
  const logger = getRequestLogger();
  logger.debug('Color normalization stage starting');

  let normalized = svg;

  // Replace all fill values with white
  normalized = normalized.replace(
    /fill=['"](?!none|transparent)[^'"]*['"]/gi,
    `fill=${WHITE}`,
  );

  // Replace fill inside style attributes
  normalized = normalized.replace(
    /fill:\s*[^;\s"]+/gi,
    'fill:#FFFFFF',
  );

  // Replace currentColor
  normalized = normalized.replace(/currentColor/gi, '#FFFFFF');

  // Replace color attribute
  normalized = normalized.replace(
    /\scolor=['"][^'"]*['"]/gi,
    ` color=${WHITE}`,
  );

  // Ensure elements without fill get white fill (unless they have stroke)
  // Don't override fill='none' which means transparent
  normalized = normalized.replace(
    /<(path|rect|circle|ellipse|polygon|text|tspan)\b([^>]*)>/gi,
    (match, tag, attrs) => {
      if (!/fill=/i.test(attrs) && !/fill\s*:/i.test(attrs)) {
        return `<${tag} fill=${WHITE}${attrs}>`;
      }
      return match;
    },
  );

  // Handle gradients: replace gradient fills with solid white
  // Find gradient definitions and mark them for removal
  const gradientIds = [...normalized.matchAll(/<(?:linear|radial)Gradient\s[^>]*id=['"]([^'"]*)['"]/gi)]
    .map(m => m[1]);

  // Replace url(#gradientId) references with white
  for (const id of gradientIds) {
    normalized = normalized.replace(
      new RegExp(`fill=['"]url\\(#${id}\\)['"]`, 'gi'),
      `fill=${WHITE}`,
    );
    normalized = normalized.replace(
      new RegExp(`stroke=['"]url\\(#${id}\\)['"]`, 'gi'),
      `stroke=${WHITE}`,
    );
  }

  // Remove gradient definitions (they're no longer referenced)
  normalized = normalized.replace(/<(?:linear|radial)Gradient\s[^>]*>[\s\S]*?<\/(?:linear|radial)Gradient>/gi, '');

  // Remove empty <defs> if any remain
  normalized = normalized.replace(/<defs\s*>\s*<\/defs>/gi, '');

  // Ensure no fill="none" gets overridden on elements that need to be visible
  // But keep fill="none" for background rect removals
  normalized = normalized.replace(
    /<(rect)\b([^>]*?)fill=['"]none['"]([^>]*?)>/gi,
    (match, tag, before, after) => {
      // If it's a full-size background rect, remove it entirely
      if (/width=['"]100%['"]|width=['"]\d+['"]/.test(match) && /height=['"]100%['"]|height=['"]\d+['"]/.test(match)) {
        return '';
      }
      return match;
    },
  );

  // Collapse multiple spaces
  normalized = normalized.replace(/\s{2,}/g, ' ');

  logger.debug('Color normalization complete');
  return normalized;
}
