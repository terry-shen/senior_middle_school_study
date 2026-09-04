/**
 * MCQ Extractor Service
 * Adapter layer for calling the Python mcq-extractor-api microservice
 * Provides math-formula-aware document extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';

const MICROSERVICE_URL = 'http://localhost:8000';
const HEALTH_TIMEOUT = 5000;
const EXTRACT_TIMEOUT = 120000; // 120 seconds

export interface ExtractedMCQItem {
  question_number?: number;
  question: string;
  options?: Record<string, string>;
  correct_answer?: string;
  question_type?: string;
  has_math_content?: boolean;
  has_visual_content?: boolean;
}

export interface ExtractionResult {
  rawText: string;
  items: ExtractedMCQItem[] | null;
  hasMathContent: boolean;
  fallback: boolean;
  fileName?: string;
  fileType?: string;
}

/**
 * Check if the mcq-extractor microservice is healthy and available
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${MICROSERVICE_URL}/health`, {
      timeout: HEALTH_TIMEOUT,
    });
    return response.status === 200 && response.data?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Detect if text content likely contains mathematical symbols
 * Quick regex scan - if true, delegate to microservice for enhanced extraction
 */
export function detectMathContent(text: string): boolean {
  if (!text || text.length === 0) return false;
  
  // Mathematical symbols (Unicode)
  const mathSymbols = /[∫∑√π∂∇∞≤≥≠±×÷²³±∈∉∀∃∂∇∝∼≅≈≠≡⊥∠∴∵⊕⊗⊙αβγδεζηθικλμνξοπρστυφχψω]/;
  
  // LaTeX-style delimiters
  const latexPatterns = /\$[^$]+\$|\\\(|\\\)|\\\[|\\\]/;
  
  // Common math notation patterns
  const mathNotation = /f\(x\)|x²|x³|x⁴|y²|√\d|a²|b²|c²|sin\s*\(|cos\s*\(|tan\s*\(|log\s*\(|ln\s*\(|lim\s*[({]|\d+\^|≤|≥|≠|±|×|÷|∞/;
  
  // Fraction-like patterns
  const fractionPattern = /\/[a-zA-Z(]|\b\d+\s*\/\s*[a-zA-Z(]/;
  
  if (mathSymbols.test(text)) return true;
  if (latexPatterns.test(text)) return true;
  if (mathNotation.test(text)) return true;
  if (fractionPattern.test(text)) return true;
  
  return false;
}

/**
 * Call the microservice's /extract-mcq-enhanced endpoint
 * Uploads file and returns structured extraction result
 */
export async function extractEnhanced(filePath: string): Promise<ExtractionResult> {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  
  const formData = new FormData();
  const fileStream = fs.createReadStream(filePath);
  formData.append('file', fileStream, fileName);
  
  try {
    const response = await axios.post(
      `${MICROSERVICE_URL}/extract-mcq-enhanced`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: EXTRACT_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    
    const data = response.data;
    
    // Build raw text from extracted MCQs
    let rawText = '';
    const items: ExtractedMCQItem[] = [];
    
    if (data.mcqs && Array.isArray(data.mcqs)) {
      for (const mcq of data.mcqs) {
        let qText = mcq.question || '';
        if (mcq.options) {
          for (const [key, val] of Object.entries(mcq.options)) {
            qText += `\n${key}) ${val}`;
          }
        }
        if (mcq.correct_answer) {
          qText += `\nAnswer: ${mcq.correct_answer}`;
        }
        rawText += qText + '\n\n';
        items.push({
          question_number: mcq.question_number,
          question: mcq.question || '',
          options: mcq.options,
          correct_answer: mcq.correct_answer,
          question_type: mcq.question_type,
          has_math_content: mcq.has_math_content,
          has_visual_content: mcq.has_visual_content,
        });
      }
    }
    
    // If no MCQs extracted, use document_analysis or file_info text if available
    if (!rawText && data.document_analysis?.extracted_text) {
      rawText = data.document_analysis.extracted_text;
    }
    
    const hasMathContent = data.document_analysis?.has_mathematical_content === true ||
      (data.extraction_summary?.mathematical_questions || 0) > 0;
    
    return {
      rawText: rawText || '',
      items: items.length > 0 ? items : null,
      hasMathContent,
      fallback: false,
      fileName,
      fileType: ext,
    };
  } catch (error: any) {
    // Return fallback result - caller should use existing pdf-service/word-service
    return {
      rawText: '',
      items: null,
      hasMathContent: false,
      fallback: true,
      fileName,
      fileType: ext,
    };
  }
}

/**
 * Assess extraction quality of an enhanced result.
 * Returns true if quality is acceptable, false if poor (should trigger fallback).
 *
 * Quality criteria (any triggers poor):
 * - items null or empty
 * - fewer than 3 items (likely missing most questions)
 * - average question content length < 15 chars (truncated content)
 * - more than 60% of items have 0 or 1 options (most options missing)
 */
export function assessExtractionQuality(result: ExtractionResult): boolean {
  if (!result.items || result.items.length === 0) {
    return false;
  }

  // Too few items extracted (for a real exam paper, expect at least 5)
  if (result.items.length < 3) {
    return false;
  }

  // Average question content length check
  const totalLen = result.items.reduce((sum, item) => sum + (item.question?.length || 0), 0);
  const avgLen = totalLen / result.items.length;
  if (avgLen < 15) {
    return false;
  }

  // Missing options check - count items with 0 or 1 options
  const poorOptionsCount = result.items.filter(item => {
    const optCount = item.options ? Object.keys(item.options).length : 0;
    return optCount <= 1;
  }).length;
  const poorRatio = poorOptionsCount / result.items.length;
  if (poorRatio > 0.6) {
    return false;
  }

  return true;
}

/**
 * Extract from a file with automatic fallback
 * If microservice is available and file has math content, use enhanced extraction
 * Otherwise fall back to provided fallback function
 */
export async function extractWithFallback(
  filePath: string,
  fallbackExtract: (filePath: string) => Promise<{ text: string }>
): Promise<ExtractionResult> {
  // Check if microservice is available
  const healthy = await checkHealth();
  if (!healthy) {
    // Microservice not available - use fallback immediately
    const fallbackResult = await fallbackExtract(filePath);
    return {
      rawText: fallbackResult.text,
      items: null,
      hasMathContent: detectMathContent(fallbackResult.text),
      fallback: true,
    };
  }
  
  // Microservice is available - try enhanced extraction
  const result = await extractEnhanced(filePath);
  
  if (result.fallback) {
    // Enhanced extraction failed - use fallback
    const fallbackResult = await fallbackExtract(filePath);
    return {
      rawText: fallbackResult.text,
      items: null,
      hasMathContent: detectMathContent(fallbackResult.text),
      fallback: true,
    };
  }
  
  return result;
}

export interface PageImageResult {
  success: boolean;
  page_num: number;
  total_pages: number;
  width: number;
  height: number;
  image_base64: string;
  image_format: string;
}

export interface AllPagesResult {
  success: boolean;
  total_pages: number;
  pages: Array<{
    page_num: number;
    width: number;
    height: number;
    image_base64: string;
  }>;
}

const RENDER_TIMEOUT = 60000; // 60 seconds per page render

/**
 * Render a single PDF page as a PNG image via the Python microservice
 * @param filePath - path to the PDF file
 * @param pageNum - 1-indexed page number
 * @param dpi - rendering DPI (default 200 for good quality)
 * @returns PageImageResult with base64-encoded PNG
 */
export async function renderPage(
  filePath: string,
  pageNum: number = 1,
  dpi: number = 200
): Promise<PageImageResult | null> {
  try {
    const healthy = await checkHealth();
    if (!healthy) return null;

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('page_num', String(pageNum));
    formData.append('dpi', String(dpi));

    const response = await axios.post(
      `${MICROSERVICE_URL}/render-page`,
      formData,
      {
        timeout: RENDER_TIMEOUT,
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    return response.data as PageImageResult;
  } catch (error) {
    console.error('Error rendering PDF page:', (error as Error).message);
    return null;
  }
}

/**
 * Render ALL pages of a PDF as PNG images via the Python microservice
 * @param filePath - path to the PDF file
 * @param dpi - rendering DPI (default 150 for balance of quality/size)
 * @returns AllPagesResult with array of base64-encoded PNGs
 */
export async function renderAllPages(
  filePath: string,
  dpi: number = 150
): Promise<AllPagesResult | null> {
  try {
    const healthy = await checkHealth();
    if (!healthy) return null;

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('dpi', String(dpi));

    const response = await axios.post(
      `${MICROSERVICE_URL}/render-all-pages`,
      formData,
      {
        timeout: EXTRACT_TIMEOUT * 2, // Allow more time for all pages
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    return response.data as AllPagesResult;
  } catch (error) {
    console.error('Error rendering all PDF pages:', (error as Error).message);
    return null;
  }
}

/**
 * Save base64 image data to a PNG file in uploads/papers/pages/
 * @param base64Data - base64-encoded PNG data
 * @param fileName - output file name (without extension)
 * @returns the file path of the saved image
 */
export async function savePageImage(
  base64Data: string,
  fileName: string
): Promise<string | null> {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'papers', 'pages');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, `${fileName}.png`);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return `/uploads/papers/pages/${fileName}.png`;
  } catch (error) {
    console.error('Error saving page image:', (error as Error).message);
    return null;
  }
}
