/**
 * MinerU Service (ASYNC version)
 * Uses child_process.spawn to call MinerU CLI asynchronously
 * This prevents blocking the Node.js event loop during PDF processing (~2-5 min)
 * 
 * MinerU CLI: mineru -p <input> -o <output_dir> -b pipeline
 * Output: <outputDir>/<filename>/auto/<filename>.md + <outputDir>/<filename>/auto/images/
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFile } from 'child_process';

const PARSE_TIMEOUT = 600000; // 10 minutes

export interface MinerUParseResult {
  success: boolean;
  markdown?: string;
  images?: string[]; // extracted image file paths (relative URLs)
  latexFormulas?: string[]; // detected LaTeX formula strings
  processingTime?: number; // seconds
  fallback?: boolean;
  error?: string;
}

/**
 * Check if MinerU CLI is available (async)
 */
export async function checkMinerUAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('mineru', ['--version'], { timeout: 10000, encoding: 'utf8' }, (err, stdout) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(stdout.includes('mineru') || stdout.includes('3.'));
    });
  });
}

/**
 * Extract LaTeX formulas from Markdown text
 */
function extractLatexFormulas(markdown: string): string[] {
  const formulas: string[] = [];
  const displayRegex = /\$\$([\s\S]+?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = displayRegex.exec(markdown)) !== null) {
    formulas.push(`$$${match[1].trim()}$$`);
  }
  const inlineRegex = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g;
  while ((match = inlineRegex.exec(markdown)) !== null) {
    formulas.push(`$${match[1].trim()}$`);
  }
  return formulas;
}

/**
 * Run MinerU CLI asynchronously using spawn
 * Returns stdout/stderr on completion
 */
function runMinerUAsync(filePath: string, outputDir: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn('mineru', [
      '-p', filePath,
      '-o', outputDir,
      '-b', 'pipeline',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: PARSE_TIMEOUT,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    child.on('error', (err) => {
      reject(err);
    });

    // Set timeout via setTimeout as backup
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('MinerU parsing timed out'));
    }, PARSE_TIMEOUT);
  });
}

/**
 * Parse a document using MinerU CLI (ASYNC — does not block event loop)
 */
export async function parseWithMinerU(filePath: string): Promise<MinerUParseResult> {
  const startTime = Date.now();
  const fileName = path.basename(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));

  // Check if MinerU is available (async — does not block)
  const available = await checkMinerUAvailable();
  if (!available) {
    return {
      success: false,
      fallback: true,
      error: 'MinerU CLI is not installed or not available',
    };
  }

  // Create output directory
  const outputDir = path.join(process.cwd(), 'uploads', 'papers', 'mineru-output', `${baseName}-${Date.now()}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Prepare images directory
  const imagesDir = path.join(process.cwd(), 'uploads', 'papers', 'mineru-images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log(`[mineru-service] Parsing ${fileName} via MinerU CLI (async)...`);

  try {
    // Run MinerU asynchronously (does NOT block event loop)
    const { stdout, code } = await runMinerUAsync(filePath, outputDir);
    console.log(`[mineru-service] MinerU exit code: ${code}, stdout: ${stdout.substring(0, 200)}...`);

    // Find the output Markdown file
    // MinerU CLI output structure: <outputDir>/<filename>/auto/<filename>.md
    let mdPath: string | null = null;
    let imagesPath: string | null = null;

    function findMdAndImages(dir: string, depth: number): void {
      if (depth > 4 || mdPath) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (mdPath) break;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.md') && !mdPath) {
          mdPath = fullPath;
        } else if (entry.isDirectory()) {
          if (entry.name === 'images' && !imagesPath) {
            imagesPath = fullPath;
          }
          findMdAndImages(fullPath, depth + 1);
        }
      }
    }
    findMdAndImages(outputDir, 0);

    if (!mdPath) {
      return {
        success: false,
        fallback: true,
        error: 'MinerU did not produce any Markdown output',
        processingTime: Math.round((Date.now() - startTime) / 1000),
      };
    }

    // Read the Markdown file
    let markdown = fs.readFileSync(mdPath, 'utf8');

    if (!markdown || markdown.trim().length === 0) {
      return {
        success: false,
        fallback: true,
        error: 'MinerU returned empty markdown',
        processingTime: Math.round((Date.now() - startTime) / 1000),
      };
    }

    // Copy images from MinerU output to the mineru-images directory
    const images: string[] = [];
    const imageMap: Record<string, string> = {};

    if (imagesPath && fs.existsSync(imagesPath)) {
      const imgFiles = fs.readdirSync(imagesPath).filter(f =>
        f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.gif')
      );
      let imgCount = 0;
      for (const imgFile of imgFiles) {
        imgCount++;
        const srcPath = path.join(imagesPath, imgFile);
        const destName = `${baseName}_${imgCount}${path.extname(imgFile)}`;
        const destPath = path.join(imagesDir, destName);
        fs.copyFileSync(srcPath, destPath);
        const url = `/uploads/papers/mineru-images/${destName}`;
        imageMap[imgFile] = url;
        images.push(url);
      }
      console.log(`[mineru-service] Copied ${imgCount} images`);
    }

    // Rewrite Markdown image references
    if (Object.keys(imageMap).length > 0) {
      markdown = markdown.replace(/!\[([^\]]*)\]\(images?\/([^)]+)\)/g, (_m, alt, imgName) => {
        const mapped = imageMap[imgName];
        return mapped ? `![${alt || '图片'}](${mapped})` : _m;
      });
    }

    // Clean up output directory
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch {
      // Non-fatal cleanup failure
    }

    const latexFormulas = extractLatexFormulas(markdown);
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`[mineru-service] Parse complete: ${markdown.length} chars, ${latexFormulas.length} LaTeX formulas, ${images.length} images, ${processingTime}s`);

    return {
      success: true,
      markdown,
      images,
      latexFormulas,
      processingTime,
      fallback: false,
    };
  } catch (error: any) {
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    console.error('[mineru-service] Parse error:', error.message);

    try {
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    } catch {
      // Non-fatal
    }

    return {
      success: false,
      fallback: true,
      error: error.message,
      processingTime,
    };
  }
}

/**
 * Parse a document with fallback chain:
 * 1. MinerU (best quality, LaTeX formulas) → 
 * 2. fallback function (pdfjs-dist/mammoth)
 */
export async function parseWithFallback(
  filePath: string,
  fallbackFn?: (filePath: string) => Promise<any>
): Promise<MinerUParseResult & { fallbackResult?: any }> {
  try {
    const mineruResult = await parseWithMinerU(filePath);

    if (mineruResult.success) {
      return mineruResult;
    }

    console.warn(`[mineru-service] MinerU unavailable, falling back: ${mineruResult.error}`);

    if (fallbackFn) {
      try {
        const fallbackResult = await fallbackFn(filePath);
        return {
          success: true,
          markdown: fallbackResult.rawText || fallbackResult.text || '',
          images: [],
          latexFormulas: [],
          fallback: true,
          error: `MinerU fallback: ${mineruResult.error}`,
          fallbackResult,
        };
      } catch (fbError) {
        console.error('[mineru-service] Fallback also failed:', (fbError as Error).message);
      }
    }

    return mineruResult;
  } catch (error: any) {
    console.error('[mineru-service] Unexpected error:', error.message);
    return {
      success: false,
      fallback: true,
      error: error.message,
    };
  }
}
