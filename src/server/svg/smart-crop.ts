/**
 * Stage 2: Content-aware smart crop.
 * Recalculates viewBox to tightly fit actual content.
 */

import { getRequestLogger } from '../logger.js';

interface BoundingBox {
  x: number; y: number; w: number; h: number;
}

/** Parse all path data to find geometric bounds */
function getBoundsFromPaths(svg: string): BoundingBox | null {
  const pathMatches = svg.matchAll(/d=['"]([^'"]+)['"]/gi);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasPoints = false;

  for (const match of pathMatches) {
    const d = match[1];
    // Extract all numeric coordinates from path data
    const numbers = d.match(/-?\d+\.?\d*/g);
    if (!numbers) continue;

    for (let i = 0; i < numbers.length - 1; i += 2) {
      const x = parseFloat(numbers[i]);
      const y = parseFloat(numbers[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasPoints = true;
      }
    }
  }

  if (!hasPoints) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Get bounds from rect/circle/ellipse/polygon elements */
function getBoundsFromShapes(svg: string): BoundingBox | null {
  const shapes: Array<{ x: number; y: number; w: number; h: number }> = [];

  // Rectangles
  for (const m of svg.matchAll(/<rect\s([^>]*)/gi)) {
    const attrs = m[1];
    const x = parseFloat(attrs.match(/x=['"]([\d.]+)/)?.[1] ?? '0');
    const y = parseFloat(attrs.match(/y=['"]([\d.]+)/)?.[1] ?? '0');
    const w = parseFloat(attrs.match(/width=['"]([\d.]+)/)?.[1] ?? '0');
    const h = parseFloat(attrs.match(/height=['"]([\d.]+)/)?.[1] ?? '0');
    if (w > 0 && h > 0) shapes.push({ x, y, w, h });
  }

  // Circles
  for (const m of svg.matchAll(/<circle\s([^>]*)/gi)) {
    const attrs = m[1];
    const cx = parseFloat(attrs.match(/cx=['"]([\d.]+)/)?.[1] ?? '0');
    const cy = parseFloat(attrs.match(/cy=['"]([\d.]+)/)?.[1] ?? '0');
    const r = parseFloat(attrs.match(/r=['"]([\d.]+)/)?.[1] ?? '0');
    if (r > 0) shapes.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
  }

  // Ellipses
  for (const m of svg.matchAll(/<ellipse\s([^>]*)/gi)) {
    const attrs = m[1];
    const cx = parseFloat(attrs.match(/cx=['"]([\d.]+)/)?.[1] ?? '0');
    const cy = parseFloat(attrs.match(/cy=['"]([\d.]+)/)?.[1] ?? '0');
    const rx = parseFloat(attrs.match(/rx=['"]([\d.]+)/)?.[1] ?? '0');
    const ry = parseFloat(attrs.match(/ry=['"]([\d.]+)/)?.[1] ?? '0');
    if (rx > 0 && ry > 0) shapes.push({ x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 });
  }

  // Polygons / polylines
  for (const m of svg.matchAll(/<(?:polygon|polyline)\s[^>]*points=['"]([^'"]+)['"]/gi)) {
    const points = m[1].trim().split(/[\s,]+/);
    let pminX = Infinity, pminY = Infinity, pmaxX = -Infinity, pmaxY = -Infinity;
    for (let i = 0; i < points.length - 1; i += 2) {
      const x = parseFloat(points[i]);
      const y = parseFloat(points[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        pminX = Math.min(pminX, x);
        pminY = Math.min(pminY, y);
        pmaxX = Math.max(pmaxX, x);
        pmaxY = Math.max(pmaxY, y);
      }
    }
    if (pminX !== Infinity) {
      shapes.push({ x: pminX, y: pminY, w: pmaxX - pminX, h: pmaxY - pminY });
    }
  }

  if (shapes.length === 0) return null;

  return shapes.reduce((acc, s) => ({
    x: Math.min(acc.x, s.x),
    y: Math.min(acc.y, s.y),
    w: Math.max(acc.w, s.x + s.w - acc.x),
    h: Math.max(acc.h, s.y + s.h - acc.y),
  }), { x: Infinity, y: Infinity, w: 0, h: 0 });
}

/** Compute aggregate bounding box from all visual elements */
function computeBoundingBox(svg: string): BoundingBox | null {
  const pathBounds = getBoundsFromPaths(svg);
  const shapeBounds = getBoundsFromShapes(svg);

  if (!pathBounds && !shapeBounds) return null;
  if (!pathBounds) return shapeBounds;
  if (!shapeBounds) return pathBounds;

  return {
    x: Math.min(pathBounds.x, shapeBounds.x),
    y: Math.min(pathBounds.y, shapeBounds.y),
    w: Math.max(pathBounds.x + pathBounds.w, shapeBounds.x + shapeBounds.w) - Math.min(pathBounds.x, shapeBounds.x),
    h: Math.max(pathBounds.y + pathBounds.h, shapeBounds.y + shapeBounds.h) - Math.min(pathBounds.y, shapeBounds.y),
  };
}

/**
 * Smart crop SVG by recalculating viewBox to tightly fit content.
 * Adds 5% padding for visual breathing room.
 */
export function smartCropSVG(svg: string): string {
  const logger = getRequestLogger();
  logger.debug('Smart crop stage starting');

  try {
    const bbox = computeBoundingBox(svg);
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) {
      logger.warn('Could not compute bounding box, skipping smart crop');
      return svg;
    }

    // Add 5% padding
    const padX = bbox.w * 0.05;
    const padY = bbox.h * 0.05;
    const x = bbox.x - padX;
    const y = bbox.y - padY;
    const w = bbox.w + padX * 2;
    const h = bbox.h + padY * 2;

    // Round to 2 decimal places
    const rx = Math.round(x * 100) / 100;
    const ry = Math.round(y * 100) / 100;
    const rw = Math.round(w * 100) / 100;
    const rh = Math.round(h * 100) / 100;

    // Replace existing viewBox or add new one
    let cropped = svg;
    if (/viewBox=['"][^'"]+['"]/.test(svg)) {
      cropped = svg.replace(/viewBox=['"][^'"]+['"]/i, `viewBox='${rx} ${ry} ${rw} ${rh}'`);
    } else {
      cropped = svg.replace(/<svg/i, `<svg viewBox='${rx} ${ry} ${rw} ${rh}'`);
    }

    // Remove width/height to allow responsive scaling
    cropped = cropped.replace(/\s(width|height)=['"][^'"]*['"]/gi, '');

    logger.debug({ viewBox: `${rx} ${ry} ${rw} ${rh}` }, 'Smart crop complete');
    return cropped;
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Smart crop failed, returning original');
    return svg;
  }
}
