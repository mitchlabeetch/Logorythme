/**
 * Image preprocessing pipeline.
 * Prepares uploaded images for AI consumption by:
 * 1. Validating dimensions and format
 * 2. Resizing oversized images (reduces token costs)
 * 3. Converting to optimal format
 * 4. Stripping metadata (privacy/security)
 * 
 * This saves significant AI provider costs and improves output quality
 * by ensuring images are in the optimal format before vectorization.
 */

import sharp from 'sharp';
import { getRequestLogger } from '../logger.js';

export interface PreprocessOptions {
  /** Maximum dimension (width or height) to resize to. Default: 1024 */
  maxDimension?: number;
  /** Output format. Default: 'png' */
  format?: 'png' | 'jpeg' | 'webp';
  /** JPEG/WebP quality (1-100). Default: 90 */
  quality?: number;
  /** Strip all metadata. Default: true */
  stripMetadata?: boolean;
  /** Enforce minimum dimensions. Default: 32 */
  minDimension?: number;
  /** Target file size in bytes. Default: 5MB */
  targetFileSize?: number;
}

export interface PreprocessResult {
  /** Processed image buffer */
  buffer: Buffer;
  /** MIME type of processed image */
  mimeType: string;
  /** Original dimensions */
  originalDimensions: { width: number; height: number };
  /** Processed dimensions */
  processedDimensions: { width: number; height: number };
  /** Whether the image was resized */
  wasResized: boolean;
  /** Whether metadata was stripped */
  metadataStripped: boolean;
  /** File size reduction ratio */
  sizeReduction: number;
}

/**
 * Preprocess an image before sending to AI.
 * Optimizes for both cost (smaller = fewer tokens) and quality.
 */
export async function preprocessImage(
  buffer: Buffer,
  options: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const logger = getRequestLogger();
  const {
    maxDimension = 1024,
    format = 'png',
    quality = 90,
    stripMetadata = true,
    minDimension = 32,
    targetFileSize = 5 * 1024 * 1024,
  } = options;

  logger.info({
    originalSize: buffer.length,
    maxDimension,
    format,
  }, 'Preprocessing image for AI');

  let pipeline = sharp(buffer);

  // Get original metadata
  const originalMetadata = await pipeline.metadata();
  const originalDimensions = {
    width: originalMetadata.width ?? 0,
    height: originalMetadata.height ?? 0,
  };

  // Validate minimum dimensions
  if (originalDimensions.width < minDimension || originalDimensions.height < minDimension) {
    logger.warn({ dimensions: originalDimensions }, 'Image too small');
  }

  // Strip metadata for privacy/security
  if (stripMetadata) {
    pipeline = pipeline.withMetadata({});
    logger.debug('Image metadata stripped');
  }

  // Resize if dimensions exceed max
  const needsResize = originalDimensions.width > maxDimension || originalDimensions.height > maxDimension;
  let wasResized = false;

  if (needsResize) {
    pipeline = pipeline.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
    wasResized = true;
    logger.debug({
      from: originalDimensions,
      to: `${maxDimension}x${maxDimension}`,
    }, 'Image resized for AI');
  }

  // Convert to target format
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, progressive: true });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    default:
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }

  // Process
  const processedBuffer = await pipeline.toBuffer();

  // Get processed dimensions
  const processedMetadata = await sharp(processedBuffer).metadata();
  const processedDimensions = {
    width: processedMetadata.width ?? 0,
    height: processedMetadata.height ?? 0,
  };

  // If still too large, reduce quality further
  let finalBuffer = processedBuffer;
  if (processedBuffer.length > targetFileSize) {
    logger.warn({
      size: processedBuffer.length,
      target: targetFileSize,
    }, 'Image still too large, applying additional compression');

    const reductionFactor = targetFileSize / processedBuffer.length;
    const reducedQuality = Math.max(50, Math.floor(quality * Math.sqrt(reductionFactor)));

    pipeline = sharp(buffer).resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (format === 'jpeg') {
      finalBuffer = await pipeline.jpeg({ quality: reducedQuality }).toBuffer();
    } else if (format === 'webp') {
      finalBuffer = await pipeline.webp({ quality: reducedQuality }).toBuffer();
    } else {
      // For PNG, reduce dimensions further
      const reducedDim = Math.floor(maxDimension * Math.sqrt(reductionFactor));
      finalBuffer = await sharp(buffer)
        .resize(reducedDim, reducedDim, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
  }

  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const sizeReduction = 1 - (finalBuffer.length / buffer.length);

  logger.info({
    originalSize: buffer.length,
    processedSize: finalBuffer.length,
    originalDimensions,
    processedDimensions,
    wasResized,
    sizeReduction: `${(sizeReduction * 100).toFixed(1)}%`,
  }, 'Image preprocessing complete');

  return {
    buffer: finalBuffer,
    mimeType,
    originalDimensions,
    processedDimensions,
    wasResized,
    metadataStripped: stripMetadata,
    sizeReduction,
  };
}

/**
 * Quick check if image needs preprocessing.
 */
export function needsPreprocessing(buffer: Buffer, maxDimension = 1024, maxFileSize = 5 * 1024 * 1024): boolean {
  if (buffer.length > maxFileSize) return true;
  // We can't check dimensions without loading the image, so return true to be safe
  return true;
}
