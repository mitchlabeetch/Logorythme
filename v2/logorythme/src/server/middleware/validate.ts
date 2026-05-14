/**
 * File upload validation.
 */

import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { ImageProcessingError } from '../errors/index.js';

// Whitelist MIME types
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// File magic numbers
const MAGIC_NUMBERS: Record<string, Buffer> = {
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
};

/** Multer upload middleware */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new ImageProcessingError.invalidFormat(file.mimetype) as unknown as null);
      return;
    }
    cb(null, true);
  },
});

/** Validate uploaded image (MIME + magic numbers) */
export function validateImageFile(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next(new ImageProcessingError.invalidFormat('No file provided'));
    return;
  }

  const file = req.file;

  // Check MIME type
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    next(ImageProcessingError.invalidFormat(file.mimetype));
    return;
  }

  // Check magic numbers (not just file extension)
  const magic = MAGIC_NUMBERS[file.mimetype];
  if (magic && !file.buffer.slice(0, magic.length).equals(magic)) {
    next(ImageProcessingError.invalidFormat('File content does not match declared type'));
    return;
  }

  // Check for SVG uploads (we only accept raster)
  if (file.mimetype === 'image/svg+xml' || file.buffer.toString('utf-8', 0, 100).includes('<svg')) {
    next(ImageProcessingError.invalidFormat('SVG uploads are not accepted'));
    return;
  }

  // Size check
  if (file.size > config.maxFileSizeBytes) {
    next(ImageProcessingError.tooLarge(file.size, config.maxFileSizeBytes));
    return;
  }

  next();
}
