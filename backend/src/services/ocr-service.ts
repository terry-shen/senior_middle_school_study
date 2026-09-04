/**
 * OCR Service
 * Extracts text from images using Tesseract.js
 */

import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

/**
 * Recognize text from image
 */
export async function recognizeTextFromImage(
  imagePath: string,
  language: string = 'chi_sim+eng' // Chinese Simplified + English
): Promise<OCRResult> {
  const result = await Tesseract.recognize(imagePath, language, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    words: (result.data as any).words?.map((w: any) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    })) || [],
  };
}

/**
 * Recognize text from image buffer
 */
export async function recognizeTextFromBuffer(
  imageBuffer: Buffer,
  language: string = 'chi_sim+eng'
): Promise<OCRResult> {
  const result = await Tesseract.recognize(imageBuffer, language, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    words: (result.data as any).words?.map((w: any) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    })) || [],
  };
}

/**
 * Batch OCR for multiple images
 */
export async function batchOCR(
  imagePaths: string[],
  language: string = 'chi_sim+eng'
): Promise<OCRResult[]> {
  const results: OCRResult[] = [];
  
  for (const path of imagePaths) {
    const result = await recognizeTextFromImage(path, language);
    results.push(result);
  }
  
  return results;
}