# Algorithmic SVG Post-Processing Pipeline Research

## Executive Summary

This document presents comprehensive research on algorithmic SVG post-processing techniques to address common AI-generated SVG errors in a logo vectorization service. Based on analysis of 15+ independent sources, we propose a **7-stage post-processing pipeline** that handles transparency bleeding, smart cropping, color inversion, semantic cutouts (fill-rule), path quality, structural validation, and quality assessment.

---

## Table of Contents

1. [Proposed Pipeline Architecture](#1-proposed-pipeline-architecture)
2. [SVG Smart Cropping Algorithms](#2-svg-smart-cropping-algorithms)
3. [SVG Path Optimization Libraries](#3-svg-path-optimization-libraries)
4. [Transparency Handling in SVG Rendering](#4-transparency-handling-in-svg-rendering)
5. [SVG Fill-Rule Validation for Semantic Cutouts](#5-svg-fill-rule-validation-for-semantic-cutouts)
6. [Color Normalization Algorithms](#6-color-normalization-algorithms)
7. [SVG Structural Validation](#7-svg-structural-validation)
8. [Raster-to-Vector Quality Assessment](#8-raster-to-vector-quality-assessment)
9. [Sharp.js Advanced Options for SVG Rendering](#9-sharpjs-advanced-options-for-svg-rendering)
10. [Potrace and Alternative Tracing Libraries](#10-potrace-and-alternative-tracing-libraries)
11. [SVG Cleanup Techniques for AI Hallucinations](#11-svg-cleanup-techniques-for-ai-hallucinations)
12. [Recommended npm Dependencies](#12-recommended-npm-dependencies)
13. [Complete Pipeline Code Example](#13-complete-pipeline-code-example)
14. [Quality Validation Algorithm](#14-quality-validation-algorithm)
15. [References](#15-references)

---

## 1. Proposed Pipeline Architecture

### Current Pipeline (Problematic)
```
AI generates SVG → SVGO optimizes → sharp renders PNG (trim + resize)
```

### Recommended 7-Stage Pipeline
```
Stage 1: AI generates SVG
    ↓
Stage 2: SVG Cleanup (remove AI hallucinations, fix common errors)
    ↓
Stage 3: Smart Crop (content-aware bounding box, viewBox correction)
    ↓
Stage 4: Fill-Rule Validation (detect/repair semantic cutouts)
    ↓
Stage 5: Color Normalization (force fills, preserve transparency)
    ↓
Stage 6: Path Optimization (SVGO + svgpath + simplify)
    ↓
Stage 7: Quality Rendering (sharp with proper density/alpha)
    ↓
Stage 8: Quality Assessment (automated metrics)
```

### Pipeline by Error Type

| Error | Pipeline Stage | Library |
|---|---|---|
| Transparency bleeding | Stage 5 + Stage 7 | sharp + color normalization |
| Smart crop / tiny logos | Stage 3 | svgdom + custom bbox logic |
| Color inversion | Stage 5 | linkedom + fill rewriting |
| Semantic cutouts | Stage 4 | fill-rule detection + repair |
| Wobbly paths | Stage 6 | svgpath + svg-path-simplify |

---

## 2. SVG Smart Cropping Algorithms

### 2.1 Problem Statement

The current approach uses `sharp().trim().resize(2000)` which operates on the rasterized output, not the SVG itself. This fails because:
- SVGs with incorrect `viewBox` attributes render with excessive whitespace
- AI-generated logos often have content that occupies <10% of the declared canvas
- sharp's `trim()` uses top-left pixel color comparison, which fails on SVGs with backgrounds [^89^]

### 2.2 SVG-Native Smart Cropping Approach

The most reliable approach is **DOM-based bounding box computation** using the SVG's own geometry, followed by `viewBox` recalculation.

#### Method A: svgdom + getBBox (Recommended)

```javascript
import { createSVGWindow } from 'svgdom';
import { SVG, registerWindow } from '@svgdotjs/svg.js';

async function smartCropSVG(svgString) {
  // Create server-side SVG DOM
  const window = createSVGWindow();
  const document = window.document;
  registerWindow(window, document);
  
  // Parse the SVG
  const canvas = SVG(document.documentElement);
  canvas.svg(svgString);
  
  // Get all visual elements
  const root = canvas.node;
  const allElements = root.querySelectorAll('path, circle, rect, ellipse, polygon, text, g');
  
  // Compute aggregate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  allElements.forEach(el => {
    try {
      const bbox = el.getBBox();
      if (bbox.width > 0 && bbox.height > 0) {
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      }
    } catch (e) {
      // Element may not support getBBox
    }
  });
  
  if (minX === Infinity) {
    return svgString; // Could not determine bounds
  }
  
  // Add padding (5% of max dimension)
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const maxDim = Math.max(contentWidth, contentHeight);
  const padding = maxDim * 0.05;
  
  // Recalculate viewBox
  const newViewBox = `${minX - padding} ${minY - padding} ${contentWidth + padding * 2} ${contentHeight + padding * 2}`;
  
  // Apply to SVG
  const svg = root.querySelector('svg') || root;
  svg.setAttribute('viewBox', newViewBox);
  svg.setAttribute('width', contentWidth + padding * 2);
  svg.setAttribute('height', contentHeight + padding * 2);
  
  return canvas.svg();
}
```

**Key advantages**: [^88^]
- Works server-side without browser
- Uses actual rendered geometry, not pixel estimation
- Preserves SVG editability
- Accounts for strokes, fills, and transforms

#### Method B: Sharp trim() with Custom Threshold (Fallback)

```javascript
import sharp from 'sharp';

async function rasterSmartCrop(svgBuffer) {
  return sharp(svgBuffer, { density: 300 })
    .trim({
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      threshold: 5,          // Lower = more aggressive trimming
      lineArt: true           // Optimized for vector-like content
    })
    .resize(2000, 2000, {
      fit: 'inside',
      withoutEnlargement: false
    })
    .png()
    .toBuffer();
}
```

The `trim()` method removes pixels matching the background color from edges. For AI logos with transparency issues, set `background` to the dominant background color found in the SVG. [^89^]

#### Method C: Two-Pass Rendering (Most Accurate)

```javascript
async function twoPassSmartCrop(svgString) {
  // Pass 1: Render at high density to determine content bounds
  const rendered = await sharp(Buffer.from(svgString), {
    density: 72
  }).raw().toBuffer({ resolveWithObject: true });
  
  // Find non-transparent pixel bounds
  const { data, info } = rendered;
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
  
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const alpha = info.channels === 4 ? data[idx + 3] : 255;
      if (alpha > 10) { // Threshold for "visible"
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Pass 2: Extract and resize the content region
  return sharp(Buffer.from(svgString), { density: 300 })
    .extract({
      left: Math.floor((minX / info.width) * 300),
      top: Math.floor((minY / info.height) * 300),
      width: Math.ceil(((maxX - minX) / info.width) * 300),
      height: Math.ceil(((maxY - minY) / info.height) * 300)
    })
    .resize(2000, 2000, { fit: 'inside' })
    .png()
    .toBuffer();
}
```

### 2.3 Smart Crop Comparison

| Approach | Speed | Accuracy | Preserves SVG | Best For |
|---|---|---|---|---|
| svgdom getBBox | Fast | High (geometric) | Yes | Logos with known shapes |
| sharp trim() | Very Fast | Medium | No | Simple shapes, solid backgrounds |
| Two-pass render | Slow | Very High | No | Complex multi-element compositions |
| puppeteer + DOM | Slow | Very High | No | SVGs with webfont dependencies |

**Recommendation**: Use Method A (svgdom) for SVG-native smart cropping, then render with sharp. For edge cases, fall back to Method C (two-pass). [^88^] [^89^] [^35^]

---

## 3. SVG Path Optimization Libraries

### 3.1 Beyond SVGO: Path-Level Optimization

While SVGO does structural optimization, dedicated path libraries offer curve-level optimization critical for AI-generated paths.

### 3.2 svgpath (npm: `svgpath`) — Transform & Round

A chainable SVG path data transformation library. [^42^]

```javascript
import SvgPath from 'svgpath';

function optimizePathData(d) {
  return new SvgPath(d)
    .abs()              // Convert to absolute coordinates
    .unshort()          // Expand shorthand commands (S, T, H, V → full curves)
    .round(3)           // Round to 3 decimal places
    .rel()              // Convert back to relative (smaller output)
    .toString();
}
```

**npm**: `svgpath` (v2.2.3+)
**Best for**: Coordinate rounding, path transformation, converting between relative/absolute
**Limitations**: Does not simplify or merge path segments

### 3.3 svg-path-commander (npm: `svg-path-commander`) — Advanced Manipulation

TypeScript-based library with advanced path processing including reliable `getBBox`, path reversal, and 3D transforms. [^6^] [^34^]

```javascript
import SVGPathCommander from 'svg-path-commander';

function optimizeWithCommander(pathData) {
  const path = new SVGPathCommander(pathData, { round: 3 });
  
  // Get precise bounding box (more reliable than native getBBox)
  const bbox = path.getBBox();
  
  // Optimize: use shortest notation (absolute vs relative)
  return path.optimize().toString();
}
```

**Key capabilities**: [^34^]
- Built-in `getBBox` more reliable than native methods (within 0.002-0.05px delta)
- `optimize()` picks shortest string per segment
- Path reversal without altering commands
- Works in Node.js and browser

**npm**: `svg-path-commander` (v2.1.0+)

### 3.4 svg-path-simplify (npm: `svg-path-simplify`) — Path Simplification

Uses Ramer-Douglas-Peucker algorithm to reduce path point count. [^36^]

```javascript
import { svgPathSimplify } from 'svg-path-simplify';
import 'svg-path-simplify/node'; // Load linkedom polyfills

function simplifyPath(d) {
  return svgPathSimplify(d);
  // Reduces: M57.13 15.5c13.28 0 24.53 8.67 28.42 20.65...
  // To:      M57.1 15.5c16.5 0 29.9 13.4 29.9 29.9
}
```

**npm**: `svg-path-simplify` (v1.0.3+)
**Best for**: Reducing point count in wobbly AI-generated paths
**Note**: Requires `linkedom` for DOM parsing in Node.js

### 3.5 Paper.js (npm: `paper`) — Boolean Operations

For complex path merging/subtraction operations. Server-side requires Canvas setup. [^1^]

```javascript
// Paper.js requires a DOM/Canvas context
// Best used for: path union, intersection, subtraction (boolean ops)
```

**npm**: `paper` (v0.12.17+)
**Best for**: Path boolean operations (merge overlapping shapes)
**Note**: Requires canvas setup; heavier than alternatives

### 3.6 Recommended Path Optimization Pipeline

```javascript
import { optimize } from 'svgo';
import SVGPathCommander from 'svg-path-commander';
import { svgPathSimplify } from 'svg-path-simplify';

async function optimizePaths(svgString) {
  // Step 1: SVGO structural optimization
  const svgoResult = optimize(svgString, {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            // Keep fill-rule for semantic cutouts
            convertPathData: {
              noSpaceAfterFlags: false
            },
            removeViewBox: false
          }
        }
      }
    ]
  });
  
  // Step 2: Per-path optimization with svg-path-commander
  const svgDoc = parseSVG(svgoResult.data); // Use linkedom
  const paths = svgDoc.querySelectorAll('path');
  
  paths.forEach(pathEl => {
    const d = pathEl.getAttribute('d');
    if (d && d.length > 50) {
      try {
        // Simplify then optimize
        const simplified = svgPathSimplify(d);
        const commander = new SVGPathCommander(simplified, { round: 3 });
        pathEl.setAttribute('d', commander.optimize().toString());
      } catch (e) {
        // Keep original if optimization fails
      }
    }
  });
  
  return serializeSVG(svgDoc);
}
```

---

## 4. Transparency Handling in SVG Rendering

### 4.1 The Problem

Sharp (via librsvg) has known issues with SVG transparency: [^5^]
- Opacity on masked elements renders incorrectly
- Background patterns can bleed through (Dealinka logo issue)
- The `-background` option must be set **before** the SVG file in ImageMagick

### 4.2 sharp.js Transparency Best Practices

```javascript
import sharp from 'sharp';

// CORRECT: Transparent background rendering
async function renderTransparent(svgBuffer) {
  return sharp(svgBuffer, {
    density: 300,           // High DPI for quality
    background: {           // Explicit transparent background
      r: 0, g: 0, b: 0, alpha: 0
    }
  })
  .resize(2000, 2000, { fit: 'inside' })
  .png({                   // PNG preserves alpha
    compressionLevel: 6,
    adaptiveFiltering: true
  })
  .toBuffer();
}

// For SVGs with opacity/mask issues, use ensureAlpha()
async function renderWithAlpha(svgBuffer) {
  return sharp(svgBuffer, { density: 300 })
    .ensureAlpha()         // Force add alpha channel if missing
    .resize(2000, 2000, { fit: 'inside' })
    .png()
    .toBuffer();
}

// For flattening (removing transparency with a color)
async function renderFlattened(svgBuffer, bgColor = '#FFFFFF') {
  return sharp(svgBuffer, { density: 300 })
    .resize(2000, 2000, { fit: 'inside' })
    .flatten({ background: bgColor })  // Merge alpha with background
    .png()
    .toBuffer();
}
```

### 4.3 resvg-js Alternative Renderer

For problematic SVGs, `resvg-js` (Rust-based) offers better SVG spec compliance than sharp's librsvg. [^51^] [^55^]

```javascript
import { Resvg } from '@resvg/resvg-js';

async function renderWithResvg(svgString) {
  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'width',
      value: 2000
    },
    background: 'transparent',
    logLevel: 'error'
  });
  
  const pngData = resvg.render();
  return pngData.asPng();
}
```

**Trade-offs**: [^55^]
- sharp is ~3.5x faster for batch operations
- resvg-js has better SVG spec compliance (preprocesses edge cases)
- resvg-js crashes on malformed paths (sharp is more forgiving)

### 4.4 Puppeteer Fallback for Complex SVGs

When sharp/librsvg fails (custom fonts, complex masks, CSS styles): [^116^] [^118^]

```javascript
import puppeteer from 'puppeteer';

let browser;

async function renderWithPuppeteer(svgString, width = 2000, height = 2000) {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  
  const html = `
<!DOCTYPE html>
<html><head><style>
* { margin: 0; padding: 0; }
body { background: transparent; width: ${width}px; height: ${height}px; }
svg { width: 100%; height: 100%; }
</style></head>
<body>${svgString}</body></html>`;
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  
  const screenshot = await page.screenshot({
    type: 'png',
    omitBackground: true,
    clip: { x: 0, y: 0, width, height }
  });
  
  await page.close();
  return screenshot;
}
```

### 4.5 Rendering Strategy Decision Matrix

| Scenario | Renderer | Why |
|---|---|---|
| Simple paths, no transparency issues | sharp | Fastest, most reliable |
| Complex SVGs, masks, patterns | resvg-js | Better spec compliance |
| Custom fonts, CSS animations | puppeteer | Full browser engine |
| Batch processing (1000+ files) | sharp | 3.5x faster than resvg-js |

---

## 5. SVG Fill-Rule Validation for Semantic Cutouts

### 5.1 The Problem: Semantic Cutouts

When AI generates logos with holes (letters inside shapes), the inner paths can get filled incorrectly if `fill-rule="evenodd"` is missing or removed by optimization. [^8^] [^11^]

Example: A wheel with spokes - the center hole must remain transparent:
```svg
<!-- CORRECT: fill-rule="evenodd" preserves the hole -->
<path fill="#D8D8D8" fill-rule="evenodd" 
      d="M48,96 C74.5,96 96,74.5 96,48 C96,21.5 74.5,0 48,0 ...
         M48,64 C56.8,64 64,56.8 64,48 C64,39.2 56.8,32 48,32 ..."/>

<!-- INCORRECT: Without evenodd, the inner circle fills solid -->
<path fill="#D8D8D8" 
      d="M48,96 C74.5,96 96,74.5 96,48 ... 
         M48,64 C56.8,64 64,56.8 64,48 ..."/>
```

### 5.2 Algorithmic Detection and Repair

```javascript
import { parseSVG, serializeSVG } from './svg-utils'; // linkedom-based

/**
 * Detects paths that need fill-rule="evenodd" by analyzing path sub-count
 */
function detectFillRuleIssues(svgString) {
  const doc = parseSVG(svgString);
  const paths = doc.querySelectorAll('path[d]');
  const issues = [];
  
  paths.forEach((path, index) => {
    const d = path.getAttribute('d') || '';
    const fill = path.getAttribute('fill');
    
    // Skip if no fill or already has fill-rule
    if (!fill || fill === 'none' || path.hasAttribute('fill-rule')) {
      return;
    }
    
    // Count sub-paths by counting M/m commands
    const subPathCount = (d.match(/[Mm]/g) || []).length;
    
    // If more than one sub-path with a fill, it likely needs evenodd
    if (subPathCount > 1) {
      // Check if paths are nested (indicating holes/cutouts)
      const isNested = checkNestedSubPaths(d);
      if (isNested) {
        issues.push({
          element: path,
          index,
          reason: `${subPathCount} sub-paths with nested geometry`
        });
      }
    }
  });
  
  return issues;
}

/**
 * Check if sub-paths are nested within each other
 */
function checkNestedSubPaths(d) {
  const subPaths = extractSubPaths(d);
  if (subPaths.length < 2) return false;
  
  // Get bounding boxes of each sub-path
  const bboxes = subPaths.map(sp => computeSubPathBBox(sp));
  
  // Check if any sub-path is contained within another
  for (let i = 0; i < bboxes.length; i++) {
    for (let j = 0; j < bboxes.length; j++) {
      if (i !== j && contains(bboxes[j], bboxes[i])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Repair fill-rule issues
 */
function repairFillRule(svgString) {
  const issues = detectFillRuleIssues(svgString);
  
  issues.forEach(({ element }) => {
    element.setAttribute('fill-rule', 'evenodd');
  });
  
  return {
    svg: serializeSVG(doc),
    repairs: issues.length
  };
}
```

### 5.3 SVGO Configuration to Preserve fill-rule

```javascript
// svgo.config.mjs - Critical: preserve fill-rule for semantic cutouts
export default {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // DO NOT convertTransform if it removes fill-rule context
          convertPathData: {
            applyTransforms: false,  // Don't merge paths that need separate rules
            noSpaceAfterFlags: false
          },
          // NEVER remove viewBox (breaks scaling)
          removeViewBox: false,
          // Be careful with mergePaths - it can break semantic cutouts
          mergePaths: {
            force: false,           // Don't force-merge paths
            noCombine: true         // Don't combine paths with different fills
          }
        }
      }
    }
  ]
};
```

### 5.4 Fill-Rule Algorithm Comparison

| Algorithm | Behavior | Use Case |
|---|---|---|
| `nonzero` (default) | Winding number counting. Direction matters. | Simple shapes, single paths |
| `evenodd` | Ray crossing count. Odd = inside. | Holes, cutouts, letters in shapes |
| `inherit` | Inherits from parent | Cascading rules |

**Key insight**: `evenodd` is direction-independent - it simply counts path boundary crossings. If a ray from a point crosses path boundaries an odd number of times, the point is inside. This is essential for letter cutouts where the inner path direction may not be controllable. [^8^]

---

## 6. Color Normalization Algorithms

### 6.1 The Problem

AI-generated SVGs often have:
- Inconsistent fill colors (e.g., text that should be white appears transparent)
- Colors that are nearly-white but not exactly (`#FEFEFE` instead of `#FFFFFF`)
- Missing fill attributes (defaults to black in some renderers)

### 6.2 Color Normalization Pipeline

```javascript
import { parseSVG, serializeSVG } from './svg-utils';

/**
 * Normalize all fills to white while preserving transparency
 */
function normalizeColors(svgString, options = {}) {
  const {
    targetFill = '#FFFFFF',
    targetStroke = '#FFFFFF',
    preserveTransparent = true,
    fillOpacity = 1,
    tolerance = 5  // Color distance threshold for "nearly white"
  } = options;
  
  const doc = parseSVG(svgString);
  const elements = doc.querySelectorAll(
    'path, rect, circle, ellipse, polygon, text, g'
  );
  
  elements.forEach(el => {
    const fill = el.getAttribute('fill');
    const style = el.getAttribute('style') || '';
    
    // Case 1: No fill attribute and no style fill → set to white
    if (!fill && !style.includes('fill:') && el.tagName !== 'g') {
      el.setAttribute('fill', targetFill);
    }
    
    // Case 2: Fill is "none" → keep as is (intended transparent)
    if (fill === 'none') {
      // Preserve intentional transparency
    }
    
    // Case 3: Fill exists but is nearly white → normalize to pure white
    if (fill && fill !== 'none') {
      const normalized = normalizeColor(fill, targetFill, tolerance);
      if (normalized !== fill) {
        el.setAttribute('fill', normalized);
      }
    }
    
    // Case 4: Handle CSS style fills
    if (style.includes('fill:')) {
      const newStyle = style.replace(
        /fill:\s*([^;]+)/,
        (match, color) => `fill: ${normalizeColor(color.trim(), targetFill, tolerance)}`
      );
      if (newStyle !== style) {
        el.setAttribute('style', newStyle);
      }
    }
    
    // Case 5: Remove fill-opacity that makes content invisible
    const fillOpacity = el.getAttribute('fill-opacity');
    if (fillOpacity === '0') {
      el.setAttribute('fill-opacity', '1');
    }
  });
  
  return serializeSVG(doc);
}

/**
 * Simple color normalization - if color is "close enough" to target, snap to it
 */
function normalizeColor(color, target, tolerance) {
  // Parse color to RGB
  const rgb = parseColor(color);
  if (!rgb) return color;
  
  const targetRgb = parseColor(target);
  
  // Check if color is within tolerance of target
  const distance = Math.sqrt(
    Math.pow(rgb.r - targetRgb.r, 2) +
    Math.pow(rgb.g - targetRgb.g, 2) +
    Math.pow(rgb.b - targetRgb.b, 2)
  );
  
  return distance <= tolerance ? target : color;
}

function parseColor(color) {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
  }
  // Handle named colors
  const namedColors = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    // ... add more as needed
  };
  return namedColors[color.toLowerCase()];
}
```

### 6.3 Handling Transparent Backgrounds

For logos that need transparent backgrounds (no fill behind the logo):

```javascript
function ensureTransparentBackground(svgString) {
  const doc = parseSVG(svgString);
  const svg = doc.querySelector('svg');
  
  // Remove background rectangles (common AI artifact)
  const bgElements = doc.querySelectorAll(
    'rect[width="100%"], rect[height="100%"], rect[width="100vw"]'
  );
  bgElements.forEach(el => {
    // Only remove if it's at the root level and filled (not transparent)
    const fill = el.getAttribute('fill');
    if (fill && fill !== 'none' && fill !== 'transparent') {
      el.remove();
    }
  });
  
  // Ensure SVG has no background color in style
  const style = svg.getAttribute('style') || '';
  const cleanedStyle = style.replace(/background(?:-color)?:\s*[^;]+;?/gi, '');
  svg.setAttribute('style', cleanedStyle);
  
  return serializeSVG(doc);
}
```

---

## 7. SVG Structural Validation

### 7.1 Beyond XML Validation

Geometric correctness requires checking:
- Self-intersecting paths
- Invalid viewBox coordinates
- Negative/zero dimensions
- Missing required attributes
- Orphaned clipPath/mask references

### 7.2 Structural Validation Suite

```javascript
/**
 * Comprehensive SVG structural validation
 */
function validateSVGStructure(svgString) {
  const doc = parseSVG(svgString);
  const issues = [];
  
  // Check 1: Valid SVG root element
  const svg = doc.querySelector('svg');
  if (!svg) {
    issues.push({ severity: 'error', message: 'No SVG root element found' });
    return { valid: false, issues };
  }
  
  // Check 2: viewBox or width/height present
  const viewBox = svg.getAttribute('viewBox');
  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');
  if (!viewBox && (!width || !height)) {
    issues.push({
      severity: 'warning',
      message: 'Missing viewBox and/or width/height - may not render correctly'
    });
  }
  
  // Check 3: All paths have valid 'd' attributes
  const paths = doc.querySelectorAll('path');
  paths.forEach((path, i) => {
    const d = path.getAttribute('d');
    if (!d || d.trim() === '') {
      issues.push({
        severity: 'error',
        message: `Path #${i} has empty 'd' attribute`
      });
    }
    if (d && /[a-zA-Z]/.test(d) === false) {
      issues.push({
        severity: 'error',
        message: `Path #${i} has invalid path data`
      });
    }
  });
  
  // Check 4: No self-intersecting paths (basic check)
  paths.forEach((path, i) => {
    const d = path.getAttribute('d') || '';
    // Count sub-paths - excessive M commands may indicate issues
    const moveCount = (d.match(/M/g) || []).length;
    if (moveCount > 50) {
      issues.push({
        severity: 'warning',
        message: `Path #${i} has ${moveCount} sub-paths - possible fragmentation`
      });
    }
  });
  
  // Check 5: Referenced IDs exist (clipPath, mask, use href)
  const references = doc.querySelectorAll('[clip-path], [mask], [href], [xlink\\:href]');
  references.forEach(el => {
    const clipPath = el.getAttribute('clip-path');
    if (clipPath && clipPath.startsWith('url(#')) {
      const id = clipPath.slice(5, -1);
      if (!doc.getElementById(id)) {
        issues.push({ severity: 'error', message: `Missing clipPath reference: #${id}` });
      }
    }
  });
  
  // Check 6: Element count reasonable
  const allElements = doc.querySelectorAll('*');
  if (allElements.length > 1000) {
    issues.push({
      severity: 'warning',
      message: `Excessive element count: ${allElements.length} elements`
    });
  }
  
  // Check 7: Empty groups
  const emptyGroups = doc.querySelectorAll('g:empty');
  if (emptyGroups.length > 0) {
    issues.push({
      severity: 'info',
      message: `${emptyGroups.length} empty <g> elements found`
    });
  }
  
  return {
    valid: !issues.some(i => i.severity === 'error'),
    issues,
    stats: {
      elementCount: allElements.length,
      pathCount: paths.length,
      viewBox,
      dimensions: { width, height }
    }
  };
}
```

---

## 8. Raster-to-Vector Quality Assessment

### 8.1 Automated Quality Metrics

Research paper "Towards Human-Aligned Evaluation for SVG Generation" introduces **SVGauge**, the first human-aligned metric for SVG quality. [^16^] Key approaches:

#### 8.2 Per-Element Leave-One-Out (LOO) Analysis

A powerful technique for identifying harmful elements in AI-generated SVGs: [^21^]

```javascript
import { createSVGWindow } from 'svgdom';
import sharp from 'sharp';

/**
 * Leave-One-Out analysis: remove each element and measure visual impact
 */
async function analyzeElementQuality(svgString) {
  const window = createSVGWindow();
  // ...setup svgdom...
  
  // Render baseline
  const baselinePng = await renderSVG(svgString);
  
  const doc = parseSVG(svgString);
  const elements = doc.querySelectorAll('path, rect, circle, text');
  const elementScores = [];
  
  for (let i = 0; i < elements.length; i++) {
    // Create SVG without this element
    const clone = doc.cloneNode(true);
    const el = clone.querySelectorAll('path, rect, circle, text')[i];
    el.remove();
    
    // Render without element
    const withoutPng = await renderSVG(serializeSVG(clone));
    
    // Compare with baseline (SSIM or pixel difference)
    const similarity = await computeSimilarity(baselinePng, withoutPng);
    
    elementScores.push({
      index: i,
      tagName: el.tagName,
      impact: similarity,        // How much removing it changes the image
      isHarmful: similarity < 0.005  // Negligible impact = potentially harmful
    });
  }
  
  return elementScores;
}

async function computeSimilarity(png1, png2) {
  // Use sharp to compute normalized cross-correlation
  const raw1 = await sharp(png1).greyscale().raw().toBuffer();
  const raw2 = await sharp(png2).greyscale().raw().toBuffer();
  
  let diff = 0;
  for (let i = 0; i < raw1.length; i++) {
    diff += Math.abs(raw1[i] - raw2[i]);
  }
  return 1 - (diff / (raw1.length * 255));
}
```

### 8.3 Quality Score Framework

```javascript
/**
 * Comprehensive SVG quality scoring
 */
async function scoreSVGQuality(svgString, renderedPng) {
  const scores = {
    structural: scoreStructural(svgString),
    visual: await scoreVisual(renderedPng),
    complexity: scoreComplexity(svgString),
    pathQuality: scorePathQuality(svgString)
  };
  
  // Weighted composite
  scores.overall = (
    scores.structural * 0.25 +
    scores.visual * 0.35 +
    scores.complexity * 0.20 +
    scores.pathQuality * 0.20
  );
  
  return scores;
}

function scoreStructural(svgString) {
  const validation = validateSVGStructure(svgString);
  const errorCount = validation.issues.filter(i => i.severity === 'error').length;
  const warningCount = validation.issues.filter(i => i.severity === 'warning').length;
  return Math.max(0, 1 - errorCount * 0.25 - warningCount * 0.05);
}

async function scoreVisual(pngBuffer) {
  // Check for: blank images, excessive whitespace, low contrast
  const { data, info } = await sharp(pngBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const pixelCount = info.width * info.height;
  let nonTransparentPixels = 0;
  let totalAlpha = 0;
  
  for (let i = 3; i < data.length; i += 4) {
    totalAlpha += data[i];
    if (data[i] > 10) nonTransparentPixels++;
  }
  
  const fillRatio = nonTransparentPixels / pixelCount;
  const avgAlpha = totalAlpha / pixelCount / 255;
  
  // Ideal fill ratio for a logo: 15-60% of canvas
  const fillScore = fillRatio > 0.15 && fillRatio < 0.6 ? 1.0 :
                    fillRatio > 0.05 && fillRatio < 0.8 ? 0.5 : 0.0;
  
  return fillScore;
}

function scoreComplexity(svgString) {
  const pathCount = (svgString.match(/<path/g) || []).length;
  // Ideal: 1-20 paths for a clean logo
  return pathCount >= 1 && pathCount <= 20 ? 1.0 :
         pathCount <= 50 ? 0.7 : 0.3;
}

function scorePathQuality(svgString) {
  // Check for excessive decimal precision (AI artifact)
  const matches = svgString.match(/\d+\.\d{5,}/g);
  const excessivePrecision = matches ? matches.length : 0;
  return Math.max(0, 1 - excessivePrecision * 0.01);
}
```

### 8.4 Quality Assessment Metrics Summary

| Metric | Method | Target |
|---|---|---|
| Structural | Validation rules | 0 errors |
| Visual fill | Pixel analysis | 15-60% canvas filled |
| Path complexity | Element counting | 1-20 paths ideal |
| Path precision | Decimal digit analysis | Max 3-4 decimal places |
| Per-element LOO | Element removal + compare | All elements should have >0.5% impact |

---

## 9. Sharp.js Advanced Options for SVG Rendering

### 9.1 Complete Option Reference

```javascript
import sharp from 'sharp';

// SVG rendering with all quality options
async function renderSVGAdvanced(svgBuffer, options = {}) {
  const {
    width = 2000,
    height = 2000,
    density = 300,          // DPI for SVG rendering
    fit = 'inside',
    bgTransparent = true,
    trimWhitespace = true,
    trimThreshold = 5,
    outputFormat = 'png'
  } = options;
  
  let processor = sharp(svgBuffer, {
    density,               // Controls SVG rendering resolution [^37^]
    // density 72 = 1:1 pixel mapping
    // density 300 = ~4.17x supersampling for sharp output
  });
  
  // Step 1: Optional trim before resize
  if (trimWhitespace) {
    processor = processor.trim({
      threshold: trimThreshold,    // Color difference tolerance (0-255) [^89^]
      background: '#FFFFFF',       // Color to trim against
      lineArt: true                // Optimize for vector/line art
    });
  }
  
  // Step 2: Resize with proper fit
  processor = processor.resize(width, height, {
    fit,                          // 'inside', 'outside', 'cover', 'contain'
    withoutEnlargement: false,    // Allow upscaling from small SVGs
    kernel: sharp.kernel.lanczos3 // Best for vector upscaling
  });
  
  // Step 3: Handle transparency
  if (bgTransparent) {
    processor = processor.ensureAlpha();
  } else {
    processor = processor.flatten({
      background: { r: 255, g: 255, b: 255 }
    });
  }
  
  // Step 4: Output format optimization
  if (outputFormat === 'png') {
    processor = processor.png({
      compressionLevel: 6,         // 0=fast/large, 9=slow/small
      adaptiveFiltering: true,     // Better compression for logos
      palette: false               // True color for logos (no banding)
    });
  }
  
  return processor.toBuffer();
}
```

### 9.2 Density Setting Deep Dive

The `density` option is critical for SVG quality but often misunderstood. [^37^] [^30^]

```javascript
// SVG with width="300" at different densities:
// density: 72  → output: 300px (1:1)
// density: 190 → output: 792px (300 * 190/72)
// density: 300 → output: 1250px (300 * 300/72)

// For a 2000px target output:
// Calculate required density: 72 * (2000 / svgIntrinsicWidth)
function calculateDensity(svgWidth, targetWidth) {
  return Math.min(2400, Math.ceil(72 * (targetWidth / svgWidth)));
}
```

**Important**: Setting density too high causes memory issues. Cap at 2400 DPI. [^30^]

### 9.3 Common sharp SVG Issues and Fixes

| Issue | Cause | Fix |
|---|---|---|
| Poor quality output | Default 72 DPI | Set density to 300+ |
| Transparency lost | librsvg bug with masks | Use `ensureAlpha()` or switch to resvg-js |
| Trim cuts actual image | Default threshold too high | Lower threshold, set explicit background |
| Wrong colors | Color profile issues | Use `toColourspace('srgb')` |
| Small output | SVG has small intrinsic size | Calculate density from target size |

---

## 10. Potrace and Alternative Tracing Libraries

### 10.1 When to Use Algorithmic Tracing vs AI

| Approach | Best For | Output Quality | Speed |
|---|---|---|---|
| AI Generation (LLM) | Complex logos, text, creative designs | Variable | Slow |
| Potrace | B&W line art, silhouettes | High (curves) | Fast |
| VTracer | Color graphics, gradients | High (multi-color) | Medium |
| Vecburner | Color logos, photos | High (JS-native) | Medium |
| Vectorizer.AI | Photos to vector | Very High | Cloud API |

### 10.2 Potrace (npm wrappers)

**Best for**: Black & white bitmaps, silhouette tracing. [^104^] [^97^]

```javascript
// Install: npm install potrace
import potrace from 'potrace';
import { createCanvas, loadImage } from 'canvas';

async function traceWithPotrace(imageBuffer) {
  const params = {
    turdSize: 2,        // Suppress speckles up to this pixel area
    alphaMax: 1.0,      // Corner threshold (0 = sharp, 1.334 = smooth)
    optCurve: true,     // Enable curve optimization
    optTolerance: 0.2,  // Curve optimization tolerance
    threshold: 128,     // Binarization threshold
    blackOnWhite: true  // Color direction
  };
  
  return new Promise((resolve, reject) => {
    potrace.trace(imageBuffer, params, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}
```

### 10.3 VTracer (Rust-based)

**Best for**: Color images with gradients, multi-color logos. [^25^]

- Supports color quantization (K-means clustering)
- Sub-pixel contour tracing with marching squares
- VTracer-style 4-point subdivision for smooth curves
- Available via Node.js native binding: `@neplex/vectorizer` [^121^]

### 10.4 Vecburner (Pure JavaScript)

**Best for**: In-browser or Node.js without native dependencies. [^117^]

```javascript
import { Vecburner } from 'vecburner';

// Requires ImageData-like input
const imageData = {
  data: new Uint8ClampedArray([...]), // RGBA pixels
  width: 500,
  height: 500
};

// Use presets: 'logo', 'lineart', 'photo', 'illustration'
const result = await Vecburner.vectorizeWithPreset(imageData, 'logo');
console.log(result.svg);
```

### 10.5 Tracing Library Comparison

| Library | Type | Colors | Dependencies | Speed | Use Case |
|---|---|---|---|---|---|
| potrace | C++ (Node binding) | 2 (B&W) | None | Fast | Simple B&W logos |
| VTracer | Rust (WASM/native) | Multi | None | Medium | Color logos with gradients |
| vecburner | Pure JS | Multi | None | Medium | Server-side color vectorization |
| SVGcode | Web app | Multi | Browser | Varies | Interactive workflow |
| resvg | Rust | N/A (renderer) | None | Fast | SVG→PNG rendering |

### 10.6 Integration with AI Pipeline

```javascript
/**
 * Fallback to algorithmic tracing when AI output is poor quality
 */
async function generateWithFallback(imageBuffer) {
  // Step 1: Try AI generation
  let svg = await aiGenerateSVG(imageBuffer);
  let quality = await scoreSVGQuality(svg);
  
  // Step 2: If quality too low, try algorithmic tracing
  if (quality.overall < 0.5) {
    console.log('AI quality low, falling back to algorithmic tracing');
    
    // Preprocess: remove background, threshold
    const processed = await preprocessForTracing(imageBuffer);
    svg = await traceWithPotrace(processed);
    
    // Post-process: colorize, add details
    svg = await postProcessTracedSVG(svg);
  }
  
  return svg;
}
```

---

## 11. SVG Cleanup Techniques for AI Hallucinations

### 11.1 Common AI SVG Errors

| Error Pattern | Cause | Cleanup Strategy |
|---|---|---|
| Excessive whitespace | Large viewBox, tiny content | Smart crop (Section 2) |
| `fill-rule` stripped | SVGO over-optimization | Add back for multi-subpath elements |
| Background rectangles | AI adds visible background | Remove full-canvas rects |
| Invisible elements | `opacity="0"`, `fill="none"` | Remove or fix |
| Invalid transforms | Nested/malformed transforms | Normalize with svgpath |
| Excessive decimals | `0.123456789` coordinates | Round to 2-3 places |
| Duplicate paths | AI redundancy | Deduplicate by path data hash |
| Missing viewBox | AI omits sizing attribute | Compute from content bounds |
| Comment pollution | `<!-- AI generated -->` | Strip comments |
| Namespace issues | Wrong/missing xmlns | Ensure `http://www.w3.org/2000/svg` |

### 11.2 Cleanup Pipeline

```javascript
/**
 * Comprehensive AI SVG cleanup
 */
function cleanupAISVG(svgString) {
  let cleaned = svgString;
  
  // 1. Ensure proper XML namespace
  if (!cleaned.includes('xmlns=')) {
    cleaned = cleaned.replace(
      '<svg',
      '<svg xmlns="http://www.w3.org/2000/svg"'
    );
  }
  
  // 2. Remove AI-generated comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // 3. Remove invisible/empty elements
  cleaned = cleaned.replace(
    /<\w+[^>]*(?:opacity="0"|fill="none"[^>]*width="0")[^>]*\/>/g,
    ''
  );
  
  // 4. Round excessive decimal places in path data
  cleaned = cleaned.replace(
    /([\d.-])(\d{3,})(\.\d{5,})/g,
    (match, sign, intPart, decPart) => {
      return match.slice(0, match.indexOf('.') + 4); // Max 3 decimal places
    }
  );
  
  // 5. Remove empty groups
  cleaned = cleaned.replace(/<g[^>]*>\s*<\/g>/g, '');
  
  // 6. Fix double spaces in path data
  cleaned = cleaned.replace(/d="([^"]*)"/g, (match, pathData) => {
    return `d="${pathData.replace(/\s+/g, ' ').trim()}"`;
  });
  
  // 7. Remove background rectangles (full-canvas filled rects)
  cleaned = cleaned.replace(
    /<rect[^>]*(?:width="100%"|width="\d+"[^>]*height="\d+")[^>]*fill="(?!none)[^"]*"[^>]*\/>/gi,
    (match) => {
      // Keep if it's explicitly a visible design element
      return match.includes('id=') && !match.includes('bg') ? match : '';
    }
  );
  
  // 8. Ensure viewBox if dimensions exist
  if (!cleaned.includes('viewBox=')) {
    const widthMatch = cleaned.match(/width="(\d+(?:\.\d+)?)"/);
    const heightMatch = cleaned.match(/height="(\d+(?:\.\d+)?)"/);
    if (widthMatch && heightMatch) {
      cleaned = cleaned.replace(
        '<svg',
        `<svg viewBox="0 0 ${widthMatch[1]} ${heightMatch[1]}"`
      );
    }
  }
  
  // 9. Remove sketch/type attributes (common AI artifacts)
  cleaned = cleaned.replace(/\ssketch:type="[^"]*"/g, '');
  
  // 10. Normalize fill-opacity values
  cleaned = cleaned.replace(
    /fill-opacity="0(\.0+)?"/g,
    'fill-opacity="0"'
  );
  cleaned = cleaned.replace(
    /fill-opacity="1(\.0+)?"/g,
    'fill-opacity="1"'
  );
  
  return cleaned;
}
```

---

## 12. Recommended npm Dependencies

### 12.1 Core Dependencies

```json
{
  "dependencies": {
    "sharp": "^0.33.0",
    "svgo": "^3.2.0",
    "svgdom": "^0.1.19",
    "@svgdotjs/svg.js": "^3.2.0",
    "svgpath": "^2.2.3",
    "svg-path-commander": "^2.1.0",
    "svg-path-simplify": "^1.0.3",
    "linkedom": "^0.18.0"
  },
  "optionalDependencies": {
    "@resvg/resvg-js": "^2.6.0",
    "puppeteer": "^22.0.0",
    "potrace": "^2.1.8",
    "vecburner": "^1.0.0"
  }
}
```

### 12.2 Dependency Roles

| Package | Version | Purpose | Critical |
|---|---|---|---|
| `sharp` | ^0.33.0 | PNG rendering, trim, resize | Yes |
| `svgo` | ^3.2.0 | SVG structural optimization | Yes |
| `svgdom` | ^0.1.19 | Server-side SVG DOM with getBBox | Yes |
| `@svgdotjs/svg.js` | ^3.2.0 | SVG manipulation API | Yes |
| `svgpath` | ^2.2.3 | Path data transformation | Yes |
| `svg-path-commander` | ^2.1.0 | Advanced path optimization | Recommended |
| `svg-path-simplify` | ^1.0.3 | Path point reduction | Recommended |
| `linkedom` | ^0.18.0 | Fast DOM parser alternative | Optional |
| `@resvg/resvg-js` | ^2.6.0 | Alternative SVG renderer | Optional |
| `puppeteer` | ^22.0.0 | Browser fallback rendering | Optional |
| `potrace` | ^2.1.8 | Algorithmic tracing fallback | Optional |
| `vecburner` | ^1.0.0 | Pure JS color vectorization | Optional |

---

## 13. Complete Pipeline Code Example

```javascript
// svg-pipeline.js - Complete post-processing pipeline

import sharp from 'sharp';
import { optimize } from 'svgo';
import { createSVGWindow } from 'svgdom';
import { SVG, registerWindow } from '@svgdotjs/svg.js';
import SVGPathCommander from 'svg-path-commander';
import { svgPathSimplify } from 'svg-path-simplify';

class SVGPostProcessor {
  constructor(options = {}) {
    this.options = {
      targetWidth: 2000,
      targetHeight: 2000,
      density: 300,
      trimThreshold: 5,
      pathPrecision: 3,
      padding: 0.05,      // 5% of max dimension
      ...options
    };
    
    // Initialize svgdom
    this.window = createSVGWindow();
    this.document = this.window.document;
    registerWindow(this.window, this.document);
  }
  
  async process(svgString) {
    const pipeline = [
      { name: 'cleanup', fn: this.stageCleanup },
      { name: 'validate', fn: this.stageValidate },
      { name: 'smartCrop', fn: this.stageSmartCrop },
      { name: 'fillRule', fn: this.stageFillRule },
      { name: 'colorNormalize', fn: this.stageColorNormalize },
      { name: 'pathOptimize', fn: this.stagePathOptimize },
      { name: 'svgoOptimize', fn: this.stageSvgoOptimize },
      { name: 'render', fn: this.stageRender }
    ];
    
    let result = { svg: svgString, png: null, quality: null };
    const logs = [];
    
    for (const stage of pipeline) {
      try {
        const startTime = Date.now();
        result = await stage.fn.call(this, result);
        logs.push({
          stage: stage.name,
          duration: Date.now() - startTime,
          status: 'ok'
        });
      } catch (error) {
        logs.push({
          stage: stage.name,
          duration: Date.now() - startTime,
          status: 'error',
          error: error.message
        });
        // Continue to next stage unless critical
        if (stage.name === 'render') throw error;
      }
    }
    
    // Quality assessment
    if (result.png) {
      result.quality = await this.assessQuality(result);
    }
    
    result.logs = logs;
    return result;
  }
  
  // Stage 1: Cleanup AI hallucinations
  stageCleanup({ svg }) {
    let cleaned = svg;
    
    // Ensure namespace
    if (!cleaned.includes('xmlns=')) {
      cleaned = cleaned.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // Remove AI comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove background rectangles
    cleaned = cleaned.replace(
      /<rect[^>]*(?:width="100%"[^>]*height="100%")[^>]*\/>/gi,
      ''
    );
    
    // Round excessive decimals
    cleaned = cleaned.replace(
      /([-+]?\d+\.\d{5,})/g,
      (match) => parseFloat(match).toFixed(this.options.pathPrecision)
    );
    
    return { svg: cleaned };
  }
  
  // Stage 2: Validate structure
  stageValidate({ svg }) {
    const hasSvgTag = svg.includes('<svg');
    const hasClosingTag = svg.includes('</svg>');
    const hasViewBox = svg.includes('viewBox=');
    
    if (!hasSvgTag || !hasClosingTag) {
      throw new Error('Invalid SVG: missing root element');
    }
    
    // Add viewBox if missing but width/height present
    if (!hasViewBox) {
      const w = svg.match(/width="(\d+)/);
      const h = svg.match(/height="(\d+)/);
      if (w && h) {
        svg = svg.replace('<svg', `<svg viewBox="0 0 ${w[1]} ${h[1]}"`);
      }
    }
    
    return { svg };
  }
  
  // Stage 3: Smart crop using getBBox
  stageSmartCrop({ svg }) {
    const canvas = SVG(this.document.documentElement);
    canvas.clear();
    canvas.svg(svg);
    
    const root = canvas.node;
    const elements = root.querySelectorAll(
      'path, circle, rect, ellipse, polygon, text'
    );
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    elements.forEach(el => {
      try {
        const bbox = el.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          minX = Math.min(minX, bbox.x);
          minY = Math.min(minY, bbox.y);
          maxX = Math.max(maxX, bbox.x + bbox.width);
          maxY = Math.max(maxY, bbox.y + bbox.height);
        }
      } catch (e) {}
    });
    
    if (minX === Infinity) return { svg }; // No content found
    
    const width = maxX - minX;
    const height = maxY - minY;
    const maxDim = Math.max(width, height);
    const pad = maxDim * this.options.padding;
    
    const svgEl = root.querySelector('svg') || root;
    svgEl.setAttribute('viewBox', 
      `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`
    );
    svgEl.setAttribute('width', width + pad * 2);
    svgEl.setAttribute('height', height + pad * 2);
    
    return { svg: canvas.svg() };
  }
  
  // Stage 4: Fix fill-rule for semantic cutouts
  stageFillRule({ svg }) {
    let modified = svg;
    const subPathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
    
    modified = modified.replace(subPathRegex, (match, d) => {
      const subPathCount = (d.match(/[Mm]/g) || []).length;
      const hasFillRule = match.includes('fill-rule=');
      
      if (subPathCount > 1 && !hasFillRule) {
        // Check if any sub-path is likely a hole (starts inside outer bounds)
        return match.replace('<path', '<path fill-rule="evenodd"');
      }
      return match;
    });
    
    return { svg: modified };
  }
  
  // Stage 5: Normalize colors
  stageColorNormalize({ svg }) {
    let modified = svg;
    
    // Ensure all filled elements have explicit fill
    modified = modified.replace(
      /<(path|rect|circle|ellipse|polygon)([^>]*?(?!(fill|style))>)\s*(?![^<]*fill)/g,
      '<$1$2 fill="#FFFFFF">'
    );
    
    // Fix fill-opacity="0" that makes content invisible
    modified = modified.replace(
      /fill-opacity="0"/g,
      'fill-opacity="1"'
    );
    
    return { svg: modified };
  }
  
  // Stage 6: Path optimization
  stagePathOptimize({ svg }) {
    let modified = svg;
    
    // Optimize path data with svg-path-commander
    modified = modified.replace(
      /d="([^"]*)"/g,
      (match, d) => {
        try {
          if (d.length > 50) {
            const simplified = svgPathSimplify(d);
            const commander = new SVGPathCommander(simplified, {
              round: this.options.pathPrecision
            });
            return `d="${commander.optimize().toString()}"`;
          }
        } catch (e) {}
        return match;
      }
    );
    
    return { svg: modified };
  }
  
  // Stage 7: SVGO optimization
  stageSvgoOptimize({ svg }) {
    const result = optimize(svg, {
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox: false,
              mergePaths: { force: false, noCombine: true },
              convertPathData: { noSpaceAfterFlags: false }
            }
          }
        }
      ]
    });
    return { svg: result.data };
  }
  
  // Stage 8: Render to PNG
  async stageRender({ svg }) {
    const png = await sharp(Buffer.from(svg), {
      density: this.options.density,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .resize(this.options.targetWidth, this.options.targetHeight, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3
    })
    .ensureAlpha()
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer();
    
    return { svg, png };
  }
  
  // Quality assessment
  async assessQuality({ svg, png }) {
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const totalPixels = info.width * info.height;
    
    let nonTransparent = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) {
        nonTransparent++;
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
      }
    }
    
    const fillRatio = nonTransparent / totalPixels;
    const avgColor = nonTransparent > 0 ? {
      r: Math.round(rSum / nonTransparent),
      g: Math.round(gSum / nonTransparent),
      b: Math.round(bSum / nonTransparent)
    } : { r: 0, g: 0, b: 0 };
    
    return {
      fillRatio,
      canvasEfficiency: fillRatio > 0.15 && fillRatio < 0.7 ? 'good' : 'poor',
      averageColor: avgColor,
      dimensions: { width: info.width, height: info.height },
      isBlank: nonTransparent < 100
    };
  }
}

// Usage
const processor = new SVGPostProcessor({
  targetWidth: 2000,
  targetHeight: 2000,
  density: 300
});

const result = await processor.process(aiGeneratedSVG);
console.log(result.svg);   // Optimized SVG
console.log(result.png);   // Rendered PNG buffer
console.log(result.quality); // Quality metrics
```

---

## 14. Quality Validation Algorithm

```javascript
/**
 * Quality validation with pass/fail criteria
 */
function validateOutput(svg, pngBuffer, quality) {
  const checks = {
    // SVG structure checks
    hasValidSVG: svg.includes('<svg') && svg.includes('</svg>'),
    hasViewBox: svg.includes('viewBox='),
    hasContent: (svg.match(/<path/g) || []).length > 0,
    
    // Rendering checks
    renderedSuccessfully: pngBuffer && pngBuffer.length > 0,
    notBlank: quality && !quality.isBlank,
    
    // Composition checks
    goodFillRatio: quality && quality.fillRatio > 0.1 && quality.fillRatio < 0.8,
    
    // Path quality checks
    reasonablePathCount: (() => {
      const count = (svg.match(/<path/g) || []).length;
      return count >= 1 && count <= 100;
    })(),
    
    noExcessivePrecision: !/\d\.\d{7,}/.test(svg)
  };
  
  const passed = Object.values(checks).every(v => v);
  const failures = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  
  return {
    passed,
    checks,
    failures,
    shouldRetry: failures.includes('notBlank') || failures.includes('hasContent')
  };
}
```

---

## 15. References

### Web Sources

[^1^] Volcengine Article on Paper.js SVG path manipulation. Python服务端应用嵌入Paper.js处理SVG路径. https://www.volcengine.com/article/212339

[^2^] The Rise of AI and the Need for SVG to PNG Conversion. Dev.to. https://dev.to/czmilo/the-rise-of-ai-and-the-need-for-svg-to-png-conversion-mli

[^5^] Sharp GitHub Issue #2246: Opacity on SVG's is rendered inconsistently. https://github.com/lovell/sharp/issues/2246

[^6^] svg-path-commander GitHub: TypeScript tools for advanced SVG path processing. https://github.com/thednp/svg-path-commander

[^8^] Understanding the SVG fill-rule Property. SitePoint. https://www.sitepoint.com/understanding-svg-fill-rule-property/

[^11^] SVGO Issue #191: svgo removes fill-rule. https://github.com/svg/svgo/issues/191

[^12^] Stack Overflow: Preserving transparent colors when converting SVG to PNG. https://superuser.com/questions/1819823

[^16^] Towards Human-Aligned Evaluation for SVG Generation (arXiv 2025). https://arxiv.org/html/2509.07127v1

[^21^] Structural Evaluation Metrics for SVG Generation via Leave-One-Out Analysis (arXiv 2026). https://arxiv.org/html/2604.08809v1

[^25^] VTracer: Raster to Vector Graphics Converter (GitHub). https://github.com/visioncortex/vtracer

[^30^] Sharp GitHub Issue #729: Resize SVG and output PNG file. https://github.com/lovell/sharp/issues/729

[^34^] npm: svg-path-commander. https://www.npmjs.com/package/svg-path-commander

[^35^] MDN: SVGGraphicsElement.getBBox(). https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getBBox

[^36^] svg-path-simplify GitHub. https://github.com/herrstrietzel/svg-path-simplify

[^37^] Sharp GitHub Issue #2431: Density option behavior. https://github.com/lovell/sharp/issues/2431

[^42^] npm: svgpath. https://www.npmjs.com/package/svgpath

[^51^] resvg documentation (Rust SVG rendering library). https://docs.rs/crate/resvg/0.3.0

[^55^] sharp-vs-resvg-js benchmark comparison. https://github.com/privatenumber/sharp-vs-resvgjs

[^88^] npm: svgdom. https://www.npmjs.com/package/svgdom

[^89^] Sharp API: trim options. https://sharp.pixelplumbing.com/api-resize/

[^91^] SVGO Docs: removeViewBox plugin. https://svgo.dev/docs/plugins/removeViewBox/

[^97^] Potrace Library API documentation. https://potrace.sourceforge.net/potracelib.pdf

[^104^] Potrace official website. https://potrace.sourceforge.net/

[^116^] SVG-to-PNG conversion tool using Puppeteer. Cloud.tencent.com. https://cloud.tencent.com/developer/article/2616900

[^117^] npm: vecburner. https://libraries.io/npm/vecburner

[^118^] Convert SVG to PNG using Headless Chrome. Imgix docs. https://docs.imgix.com/getting-started/tutorials/developer-guides/convert-svg-to-png-using-headless-chrome

[^121^] VTracer Node.js binding discussion. https://github.com/visioncortex/vtracer/discussions/71

[^125^] SVGO Preset Default documentation. https://svgo.dev/docs/preset-default/

[^130^] SVGO GitHub repository. https://github.com/svg/svgo

[^132^] linkedom GitHub (DOM implementation). https://github.com/WebReflection/linkedom

[^133^] SVGO Plugins documentation. https://svgo.dev/docs/plugins/
