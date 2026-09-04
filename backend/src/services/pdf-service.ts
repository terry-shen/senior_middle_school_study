/**
 * PDF Parser Service
 * Extracts text content from PDF files using pdfjs-dist
 * Enhanced with mcq-extractor microservice for math formula extraction
 */

import { extractEnhanced, detectMathContent, checkHealth, assessExtractionQuality, ExtractionResult } from './mcq-extractor-service';

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  pages: string[];
}

/**
 * Extract text from PDF file using pdfjs-dist
 */
export async function extractTextFromPDF(filePath: string): Promise<PDFExtractionResult> {
  const fs = await import('fs');
  const fileData = fs.readFileSync(filePath);
  const data = new Uint8Array(fileData);
  
  // Use pdfjs-dist legacy build for Node.js compatibility
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data }).promise;
  
  const pageCount = doc.numPages;
  const pages: string[] = [];
  
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str || '')
      .join(' ');
    pages.push(pageText);
  }
  
  await doc.destroy();
  
  const text = pages.join('\n');
  
  return {
    text,
    pageCount,
    pages,
  };
}

/**
 * Get PDF page images (requires additional libraries like pdf-poppler)
 * For now, this returns placeholder
 */
export async function getPDFPageImages(filePath: string): Promise<string[]> {
  // This would require pdf-poppler or similar
  // For now, return empty array
  return [];
}

/**
 * Enhanced PDF extraction with math formula support
 * Detects math content and delegates to mcq-extractor microservice when needed
 */
export async function extractTextFromPDFEnhanced(filePath: string): Promise<ExtractionResult> {
  // First, do normal text extraction
  const basicResult = await extractTextFromPDF(filePath);
  
  // Check if text has math content
  const hasMath = detectMathContent(basicResult.text);
  
  if (!hasMath) {
    // No math content - return basic result
    return {
      rawText: basicResult.text,
      items: null,
      hasMathContent: false,
      fallback: false,
    };
  }
  
  // Math content detected - try microservice enhanced extraction
  const healthy = await checkHealth();
  if (!healthy) {
    // Microservice not available - return basic result with fallback flag
    return {
      rawText: basicResult.text,
      items: null,
      hasMathContent: true,
      fallback: true,
    };
  }
  
  // Call microservice for enhanced extraction
  const enhancedResult = await extractEnhanced(filePath);
  
  // If enhanced extraction failed (fallback), use basic result
  if (enhancedResult.fallback) {
    return {
      rawText: basicResult.text,
      items: null,
      hasMathContent: true,
      fallback: true,
    };
  }
  
  // Quality check: if enhanced extraction quality is poor (truncated questions,
  // missing options), fall back to pdfjs text which is more reliable for Chinese
  if (!assessExtractionQuality(enhancedResult)) {
    return {
      rawText: basicResult.text,
      items: null,
      hasMathContent: true,
      fallback: true,
    };
  }
  
  // Return enhanced result (quality is acceptable)
  return enhancedResult;
}