/**
 * SVG generation system prompts with quality presets.
 */

import type { QualityPreset } from '../../types.js';

const BASE_RULES = `You are an expert graphic design AI and SVG engineer. Trace the uploaded raster logo and reconstruct it as clean, highly accurate SVG code.

Strict Rules:
1) Pure White: Every core path/polygon must have fill='#FFFFFF'. All strokes must use stroke='#FFFFFF'.
2) Semantic Cutouts: If the logo consists of a shape with a contrasting letter/symbol inside it, you MUST use SVG path rules (like fill-rule='evenodd') to punch the letter out so it remains readable. Do not merge them into a solid blob.
3) Background Removal: Ignore all background colors and non-essential bounding boxes. Remove any dots, patterns, or textures that are not part of the logo itself.
4) Output ONLY raw, valid SVG code without markdown formatting or conversational text.
5) Do not add comments, doctype, XML declaration, or CDATA sections.
6) Set viewBox to tightly fit the logo content. No excessive whitespace.
7) Use only single quotes for attributes.
8) The output MUST start with <svg and end with </svg>.
9) All paths should be clean and simplified. No excessive control points.
10) Preserve the brand's visual identity: proportions, recognizable shapes, and overall geometry.`;

const QUALITY_PROMPTS: Record<QualityPreset, string> = {
  high: `${BASE_RULES}

Quality: MAXIMUM PRECISION
- Use high-detail path data with accurate curves
- Preserve fine details, sharp corners, and subtle design elements
- Use compound paths for complex shapes
- Ensure all letterforms are precise and readable
- Output may be larger but must be visually faithful to the original`,

  optimized: `${BASE_RULES}

Quality: BALANCED
- Good path accuracy with reasonable detail
- Simplify complex curves where it doesn't affect brand identity
- Balance file size and visual quality
- Standard for most logos`,

  minimal: `${BASE_RULES}

Quality: FAST AND CLEAN
- Simplify paths aggressively for fastest generation
- Focus on the core silhouette and major elements
- Minimal detail, maximum speed
- Good for simple logos and quick previews`,
};

/**
 * Get the system prompt for a given quality preset.
 * @param quality — Quality preset
 */
export function getSystemPrompt(quality: QualityPreset): string {
  return QUALITY_PROMPTS[quality] ?? QUALITY_PROMPTS.optimized;
}
