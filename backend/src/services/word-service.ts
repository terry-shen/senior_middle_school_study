import * as fs from 'fs';
import * as path from 'path';
import { extractEnhanced, detectMathContent, checkHealth, ExtractionResult } from './mcq-extractor-service';

/**
 * Word document parsing service
 * Supports .docx (via mammoth) and .doc (legacy fallback)
 * Enhanced with mcq-extractor microservice for math formula extraction
 */

/**
 * Parse .docx file and extract plain text
 * Uses mammoth to extract text from paragraphs and tables
 */
export async function parseDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  
  if (!result.value || result.value.trim().length === 0) {
    throw new Error('Word文档内容为空或无法解析');
  }
  
  // mammoth extracts text with paragraphs separated by newlines
  // Tables are converted to line-by-line text
  return result.value;
}

/**
 * Parse legacy .doc file
 * mammoth does not support .doc format
 * Falls back to basic text extraction (may lose formatting)
 */
export async function parseDocLegacy(filePath: string): Promise<string> {
  // Read file as buffer
  const buffer = fs.readFileSync(filePath);
  
  // Attempt basic text extraction from binary .doc format
  // .doc files are OLE compound documents - extract readable text segments
  const text = extractTextFromBinaryDoc(buffer);
  
  if (!text || text.trim().length === 0) {
    throw new Error('无法解析旧版Word文档(.doc)，建议另存为.docx格式后重新导入');
  }
  
  return text;
}

/**
 * Basic text extraction from binary .doc format
 * Scans for text segments between control characters
 */
function extractTextFromBinaryDoc(buffer: Buffer): string {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    
    // Printable ASCII or common CJK (UTF-16LE encoded in .doc)
    if (byte >= 0x20 && byte <= 0x7e) {
      currentChunk.push(String.fromCharCode(byte));
    } else if (i + 1 < buffer.length) {
      // Check for CJK characters (UTF-16LE: two bytes, high byte often 0x4e-0x9f for CJK)
      const code = buffer[i] | (buffer[i + 1] << 8);
      if (code >= 0x4e00 && code <= 0x9fff) {
        currentChunk.push(String.fromCharCode(code));
        i++; // Skip next byte
      } else if (code === 0x000a || code === 0x000d) {
        // Newline
        if (currentChunk.length > 0) {
          const chunk = currentChunk.join('').trim();
          if (chunk.length >= 2) {
            chunks.push(chunk);
          }
          currentChunk = [];
        }
      }
    }
  }
  
  // Flush remaining chunk
  if (currentChunk.length > 0) {
    const chunk = currentChunk.join('').trim();
    if (chunk.length >= 2) {
      chunks.push(chunk);
    }
  }
  
  return chunks.join('\n');
}

/**
 * Detect if a file is a valid Word document
 */
export function isWordDocument(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.docx' || ext === '.doc';
}

/**
 * Get the Word document format type
 */
export function getWordFormat(filePath: string): 'docx' | 'doc' | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') return 'docx';
  if (ext === '.doc') return 'doc';
  return null;
}

/**
 * Enhanced Word document parsing with math formula support
 * Detects math content and delegates to mcq-extractor microservice when needed
 */
export async function parseDocxEnhanced(filePath: string): Promise<ExtractionResult> {
  // First, do normal text extraction
  let basicText: string;
  const format = getWordFormat(filePath);
  if (format === 'docx') {
    basicText = await parseDocx(filePath);
  } else if (format === 'doc') {
    basicText = await parseDocLegacy(filePath);
  } else {
    throw new Error(`Unsupported file format: ${path.extname(filePath)}`);
  }
  
  // Check if text has math content
  const hasMath = detectMathContent(basicText);
  
  if (!hasMath) {
    // No math content - return basic result
    return {
      rawText: basicText,
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
      rawText: basicText,
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
      rawText: basicText,
      items: null,
      hasMathContent: true,
      fallback: true,
    };
  }
  
  // Return enhanced result
  return enhancedResult;
}
