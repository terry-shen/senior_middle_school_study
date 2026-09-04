/**
 * Question Image Service
 * Handles question image extraction and format conversion (Task 6.9)
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

/**
 * Convert an image to a target format (png/jpeg/webp)
 */
export async function convertImage(
  sourcePath: string,
  targetFormat: 'png' | 'jpeg' | 'webp' = 'png',
  outputPath?: string
): Promise<{ filePath: string; width: number; height: number }> {
  const extMap: Record<string, string> = { png: '.png', jpeg: '.jpg', webp: '.webp' };
  const target = outputPath || sourcePath.replace(/\.[^.]+$/, extMap[targetFormat]);

  const image = sharp(sourcePath);
  const metadata = await image.metadata();

  switch (targetFormat) {
    case 'jpeg':
      await image.jpeg({ quality: 90 }).toFile(target);
      break;
    case 'webp':
      await image.webp({ quality: 90 }).toFile(target);
      break;
    default:
      await image.png().toFile(target);
  }

  return {
    filePath: target,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Resize an image to fit within max dimensions while preserving aspect ratio
 */
export async function resizeImage(
  sourcePath: string,
  maxWidth: number,
  maxHeight: number,
  outputPath?: string
): Promise<{ filePath: string; width: number; height: number }> {
  const target = outputPath || sourcePath;
  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  let outW = width;
  let outH = height;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    outW = Math.round(width * ratio);
    outH = Math.round(height * ratio);
  }

  await image.resize(outW, outH).toFile(target);
  return { filePath: target, width: outW, height: outH };
}

/**
 * Extract a cropped region from a source image (used to extract question images)
 * @param sourcePath source image path
 * @param crop { left, top, width, height } region in pixels
 */
export async function extractRegion(
  sourcePath: string,
  crop: { left: number; top: number; width: number; height: number },
  outputPath: string
): Promise<{ filePath: string; width: number; height: number }> {
  const ext = path.extname(outputPath) || '.png';
  const image = sharp(sourcePath).extract({
    left: Math.max(0, crop.left),
    top: Math.max(0, crop.top),
    width: Math.max(1, crop.width),
    height: Math.max(1, crop.height),
  });

  if (ext === '.jpg' || ext === '.jpeg') {
    await image.jpeg({ quality: 90 }).toFile(outputPath);
  } else if (ext === '.webp') {
    await image.webp({ quality: 90 }).toFile(outputPath);
  } else {
    await image.png().toFile(outputPath);
  }

  const metadata = await sharp(outputPath).metadata();
  return {
    filePath: outputPath,
    width: metadata.width || crop.width,
    height: metadata.height || crop.height,
  };
}

/**
 * Get image dimensions
 */
export async function getImageInfo(filePath: string): Promise<{ width: number; height: number; format: string }> {
  const metadata = await sharp(filePath).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
  };
}

/**
 * Ensure question-images directory exists
 */
export function ensureQuestionImagesDir(): string {
  const dir = path.join(UPLOAD_DIR, 'question-images');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
