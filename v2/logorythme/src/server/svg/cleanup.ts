/**
 * Stage 1: AI hallucination cleanup.
 * Extracts raw SVG from markdown-wrapped responses and removes common AI artifacts.
 */

import { getRequestLogger } from '../logger.js';

const MARKDOWN_FENCE = /```(?:svg|html|xml)?\s*([\s\S]*?)```/i;
const XML_DECL = /<\?xml[^?]*\?>/gi;
const DOCTYPE = /<!DOCTYPE[^>]*>/gi;
const COMMENT = /<!--[\s\S]*?-->/gi;
const CDATA = /<!\[CDATA\[[\s\S]*?\]\]>/gi;
const EMPTY_ELEMENTS = /<(?:g|path|rect|circle|ellipse|polygon|polyline|line|text|tspan)\s[^>]*\/>/gi;
const STYLE_ATTR_COLOR = /fill:\s*[^;"]+|stroke:\s*[^;"]+/gi;

/** Extract and clean SVG from AI response text */
export function cleanupSVG(raw: string): string {
  const logger = getRequestLogger();
  logger.debug('SVG cleanup stage starting');

  let svg = raw.trim();

  // Extract from markdown code fence
  const fenceMatch = MARKDOWN_FENCE.exec(svg);
  if (fenceMatch) {
    svg = fenceMatch[1].trim();
    logger.debug('Extracted SVG from markdown fence');
  }

  // Remove XML declaration
  svg = svg.replace(XML_DECL, '');

  // Remove DOCTYPE
  svg = svg.replace(DOCTYPE, '');

  // Remove HTML wrapper tags
  svg = svg.replace(/<\/?(?:html|body|head|code|pre)[^>]*>/gi, '');

  // Remove comments
  svg = svg.replace(COMMENT, '');

  // Remove CDATA
  svg = svg.replace(CDATA, '');

  // Extract just the SVG element if wrapped in other content
  const svgMatch = svg.match(/(<svg[\s\S]*<\/svg>)/i);
  if (svgMatch) {
    svg = svgMatch[1];
  }

  // Remove empty style blocks
  svg = svg.replace(/<style\s*>\s*<\/style>/gi, '');
  svg = svg.replace(/<defs\s*>\s*<\/defs>/gi, '');

  // Remove empty groups
  svg = svg.replace(/<g\s[^>]*>\s*<\/g>/gi, '');

  // Normalize whitespace
  svg = svg.replace(/>\s+</g, '><').trim();

  logger.debug({ originalLength: raw.length, cleanedLength: svg.length }, 'SVG cleanup complete');
  return svg;
}

/** Validate that string contains a valid SVG element */
export function hasValidSVG(svg: string): boolean {
  return /<svg\b[^>]*>/.test(svg) && /<\/svg>/i.test(svg);
}
