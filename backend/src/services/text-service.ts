import * as fs from 'fs';
import * as path from 'path';

/**
 * Plain text file parsing service
 * Handles encoding detection (UTF-8/GBK/GB2312) and conversion
 */

/**
 * Parse a .txt file with automatic encoding detection
 * Uses jschardet for detection and iconv-lite for decoding
 */
export async function parseText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  
  if (buffer.length === 0) {
    throw new Error('文本文件内容为空');
  }
  
  // Detect encoding using jschardet
  const jschardet = await import('jschardet');
  const detection = jschardet.detect(buffer);
  
  let encoding: string;
  let confidence: number;
  
  if (detection && detection.encoding) {
    encoding = detection.encoding.toLowerCase();
    confidence = detection.confidence || 0;
  } else {
    encoding = 'utf-8';
    confidence = 0;
  }
  
  // Normalize encoding names
  if (encoding === 'ascii') {
    encoding = 'utf-8';
  }
  // Map common variants
  if (encoding === 'gb2312' || encoding === 'gb18030') {
    encoding = 'gbk';
  }
  
  // If confidence is too low, default to UTF-8
  if (confidence < 0.5) {
    encoding = 'utf-8';
  }
  
  // Decode using iconv-lite
  const iconv = await import('iconv-lite');
  
  let text: string;
  try {
    if (iconv.default && typeof iconv.default.decode === 'function') {
      text = iconv.default.decode(buffer, encoding);
    } else if (typeof (iconv as any).decode === 'function') {
      text = (iconv as any).decode(buffer, encoding);
    } else {
      // Fallback: try direct decode
      text = buffer.toString(encoding as BufferEncoding);
    }
  } catch (err) {
    // If decoding fails, fall back to UTF-8
    try {
      text = buffer.toString('utf-8');
    } catch {
      throw new Error(`无法解码文本文件，检测到的编码: ${encoding}，请确保文件为UTF-8或GBK编码`);
    }
  }
  
  if (!text || text.trim().length === 0) {
    throw new Error('文本文件内容为空');
  }
  
  // Remove BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  
  return text;
}

/**
 * Check if a file is a text file
 */
export function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.txt';
}

/**
 * Get encoding info for a file without full parsing
 */
export async function detectEncoding(filePath: string): Promise<{ encoding: string; confidence: number }> {
  const buffer = fs.readFileSync(filePath);
  const jschardet = await import('jschardet');
  const detection = jschardet.detect(buffer);
  
  return {
    encoding: detection?.encoding || 'utf-8',
    confidence: detection?.confidence || 0,
  };
}
