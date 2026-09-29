/**
 * MinerU Service (PERSISTENT API version)
 * Uses a persistent local MinerU FastAPI service (mineru-api) instead of the
 * CLI's temp-API mode. The CLI's `mineru -b pipeline` spawns a temporary local
 * API whose health check fails (502) in this environment; a persistent API
 * started once and reused works reliably (validated: 118 LaTeX formulas).
 *
 * API protocol (MinerU 3.4.5 FastAPI):
 *   GET  /health                     -> {status:"healthy",...}
 *   POST /file_parse                 -> multipart(files, backend=pipeline, return_md, return_images)
 *                                       -> {task_id, status, ...} (may block until completed)
 *   GET  /tasks/{task_id}            -> task status (poll while pending/processing)
 *   GET  /tasks/{task_id}/result     -> {results: {[baseName]: {md_content, images:{name: dataURI}}}}
 *
 * Markdown image refs `![](images/<hash>.jpg)` are rewritten to
 * `/uploads/papers/mineru-images/<baseName>-<n>.<ext>` after saving the
 * base64-decoded images to disk.
 */

import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import { spawn, execFile } from 'child_process';

const PARSE_TIMEOUT = 1200000; // 20 minutes — large scanned PDFs can take ~15 min
const MINERU_API_PORT = 56090;
const MINERU_API_URL = `http://127.0.0.1:${MINERU_API_PORT}`;
const API_STARTUP_TIMEOUT = 90000; // 90s for the API process to become healthy
const API_POLL_INTERVAL = 3000;

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
 * Quick check: is the mineru CLI installed (no side effects)?
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

/* ------------------------------------------------------------------ */
/* Persistent MinerU API management                                     */
/* ------------------------------------------------------------------ */

function apiGet(urlPath: string, timeoutMs = 5000): Promise<{ status: number; body: string } | null> {
  return new Promise((resolve) => {
    const req = http.get(`${MINERU_API_URL}${urlPath}`, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function apiHealthy(): Promise<boolean> {
  const res = await apiGet('/health', 3000);
  return !!res && res.status === 200;
}

let apiStartPromise: Promise<boolean> | null = null;

/**
 * Ensure the persistent MinerU FastAPI service is running (auto-start if down).
 * Concurrent callers share one startup attempt.
 */
export async function ensureMinerUApi(): Promise<boolean> {
  if (await apiHealthy()) {
    return true;
  }
  if (!apiStartPromise) {
    apiStartPromise = startMinerUApi().finally(() => {
      apiStartPromise = null;
    });
  }
  return apiStartPromise;
}

async function startMinerUApi(): Promise<boolean> {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  console.log(`[mineru-service] Starting persistent MinerU API on port ${MINERU_API_PORT}...`);
  try {
    const child = spawn('mineru-api', ['--host', '127.0.0.1', '--port', String(MINERU_API_PORT)], {
      detached: true,
      stdio: [
        'ignore',
        fs.openSync(path.join(logsDir, 'mineru-api.log'), 'a'),
        fs.openSync(path.join(logsDir, 'mineru-api.err.log'), 'a'),
      ],
      windowsHide: true,
    });
    child.unref();
  } catch (err: any) {
    console.error('[mineru-service] Failed to spawn mineru-api:', err.message);
    return false;
  }

  const deadline = Date.now() + API_STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, API_POLL_INTERVAL));
    if (await apiHealthy()) {
      console.log('[mineru-service] MinerU API is healthy');
      return true;
    }
  }
  console.error('[mineru-service] MinerU API did not become healthy within timeout');
  return false;
}

/* ------------------------------------------------------------------ */
/* /file_parse protocol helpers                                         */
/* ------------------------------------------------------------------ */

function postFileParse(filePath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const boundary = `----minerunode${Date.now()}`;
    const fileData = fs.readFileSync(filePath);
    const fn = path.basename(filePath);
    const fields = { backend: 'pipeline', return_md: 'true', return_images: 'true' };

    const parts: Buffer[] = [];
    for (const [k, v] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, 'utf8'));
    }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${fn}"\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf8'));
    parts.push(fileData);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
    const body = Buffer.concat(parts);

    const req = http.request(
      `${MINERU_API_URL}/file_parse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: PARSE_TIMEOUT,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('file_parse request timed out')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

interface MinerUTask {
  task_id: string;
  status: string; // pending | processing | completed | failed
  error?: string;
}

async function pollTaskUntilDone(taskId: string): Promise<MinerUTask> {
  const deadline = Date.now() + PARSE_TIMEOUT;
  let last: MinerUTask = { task_id: taskId, status: 'processing' };
  while (Date.now() < deadline) {
    const res = await apiGet(`/tasks/${taskId}`, 10000);
    if (res && res.status === 200) {
      last = JSON.parse(res.body);
      if (last.status === 'completed' || last.status === 'failed') {
        return last;
      }
    }
    await new Promise((r) => setTimeout(r, API_POLL_INTERVAL));
  }
  throw new Error(`MinerU task ${taskId} timed out`);
}

/* ------------------------------------------------------------------ */
/* Public parsing API                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a document (PDF preferred; docx is converted by the caller first)
 * using the persistent MinerU API. Async — never blocks the event loop.
 */
export async function parseWithMinerU(filePath: string): Promise<MinerUParseResult> {
  const startTime = Date.now();
  const fileName = path.basename(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));

  // Ensure the persistent API is up (auto-starts when down)
  const apiUp = await ensureMinerUApi();
  if (!apiUp) {
    return {
      success: false,
      fallback: true,
      error: 'MinerU API is not available (failed to start/health-check)',
      processingTime: Math.round((Date.now() - startTime) / 1000),
    };
  }

  const imagesDir = path.join(process.cwd(), 'uploads', 'papers', 'mineru-images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log(`[mineru-service] Parsing ${fileName} via MinerU API (pipeline backend)...`);

  try {
    // 1. Submit parse job
    const submit = await postFileParse(filePath);
    let task: MinerUTask;
    try {
      task = JSON.parse(submit.body);
    } catch {
      return {
        success: false,
        fallback: true,
        error: `MinerU API returned invalid response (HTTP ${submit.status}): ${submit.body.substring(0, 200)}`,
        processingTime: Math.round((Date.now() - startTime) / 1000),
      };
    }
    if (submit.status >= 400 && task.status !== 'failed') {
      return {
        success: false,
        fallback: true,
        error: `MinerU API submit failed (HTTP ${submit.status})`,
        processingTime: Math.round((Date.now() - startTime) / 1000),
      };
    }

    // 2. Wait for completion (POST may block until done; otherwise poll)
    if (task.status !== 'completed' && task.status !== 'failed') {
      task = await pollTaskUntilDone(task.task_id);
    }
    if (task.status === 'failed') {
      return {
        success: false,
        fallback: true,
        error: `MinerU task failed: ${task.error || 'unknown error'}`,
        processingTime: Math.round((Date.now() - startTime) / 1000),
      };
    }

    // 3. Fetch result
    const resultRes = await apiGet(`/tasks/${task.task_id}/result`, 60000);
    if (!resultRes || resultRes.status !== 200) {
      return {
        success: false,
        fallback: true,
        error: `Failed to fetch MinerU task result (HTTP ${resultRes?.status ?? 'network error'})`,
        processingTime: Math.round((Date.now() - startTime) / 1000),
      };
    }
    const result = JSON.parse(resultRes.body) as {
      results: Record<string, { md_content?: string; images?: Record<string, string> }>;
    };

    // Result is keyed by file base name; fall back to the first entry
    const fileResult = result.results?.[baseName] ?? Object.values(result.results ?? {})[0];
    let markdown = fileResult?.md_content || '';

    if (!markdown || markdown.trim().length === 0) {
      return {
        success: false,
        fallback: true,
        error: 'MinerU returned empty markdown',
        processingTime: Math.round((Date.now() - startTime) / 1000),
      };
    }

    // 4. Save extracted images (base64 data URIs) and rewrite markdown refs
    const images: string[] = [];
    const imageMap: Record<string, string> = {};
    const rawImages = fileResult?.images || {};
    let imgCount = 0;
    for (const [imgName, dataUri] of Object.entries(rawImages)) {
      imgCount++;
      const m = /^data:image\/(\w+);base64,(.*)$/s.exec(dataUri);
      const ext = m ? `.${m[1].replace('jpeg', 'jpg')}` : path.extname(imgName) || '.jpg';
      const b64 = m ? m[2] : dataUri;
      const destName = `${baseName}-${imgCount}${ext}`;
      const destPath = path.join(imagesDir, destName);
      try {
        fs.writeFileSync(destPath, Buffer.from(b64, 'base64'));
        const url = `/uploads/papers/mineru-images/${destName}`;
        imageMap[imgName] = url;
        images.push(url);
      } catch (e: any) {
        console.error(`[mineru-service] Failed to save image ${imgName}: ${e.message}`);
      }
    }
    if (imgCount > 0) {
      console.log(`[mineru-service] Saved ${imgCount} images`);
    }

    // Rewrite `![](images/<hash>.jpg)` -> `![图片](/uploads/papers/mineru-images/...)`
    if (Object.keys(imageMap).length > 0) {
      markdown = markdown.replace(
        /!\[([^\]]*)\]\(images?\/([^)]+)\)/g,
        (whole, alt: string, imgName: string) => {
          const mapped = imageMap[imgName];
          return mapped ? `![${alt || '图片'}](${mapped})` : whole;
        }
      );
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

const WORD_TO_PDF_TIMEOUT = 180000; // 3 minutes for large documents

/**
 * Convert a Word document (.docx/.doc) to PDF using MS Word COM automation
 * (Windows, requires MS Word installed).
 *
 * Why: MinerU's vision pipeline (formula detection → LaTeX recognition) only
 * runs on PDF/image inputs. Word documents with MathType/EQ3.0 OLE formula
 * objects (WMF images internally) carry no readable math structure — Word
 * renders them faithfully to PDF, then MinerU's pipeline recognizes the
 * rendered formulas as LaTeX.
 *
 * Returns the path of the converted PDF (same directory, .pdf extension).
 * Caller is responsible for deleting the temp PDF after parsing.
 */
export async function convertWordToPdf(filePath: string): Promise<string> {
  const outPdf = filePath.replace(/\.(docx|doc)$/i, '.pdf');
  if (fs.existsSync(outPdf)) {
    return outPdf; // idempotent: reuse existing conversion
  }

  // Escape single quotes for PowerShell string literals ('' = ')
  const src = filePath.replace(/'/g, "''");
  const dst = outPdf.replace(/'/g, "''");
  const psScript = [
    "$ErrorActionPreference = 'Stop'",
    '$word = $null',
    'try {',
    '  $word = New-Object -ComObject Word.Application',
    '  $word.Visible = $false',
    '  $word.DisplayAlerts = 0',
    `  $doc = $word.Documents.Open('${src}', $false, $true)`,
    `  $doc.SaveAs([ref]'${dst}', [ref]17)`, // 17 = wdFormatPDF
    '  $doc.Close($false)',
    "  Write-Output 'OK'",
    '} catch {',
    "  Write-Output ('FAIL:' + $_.Exception.Message)",
    '} finally {',
    '  if ($word -ne $null) { try { $word.Quit() } catch {} }',
    '}',
  ].join('\r\n');

  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      { timeout: WORD_TO_PDF_TIMEOUT, encoding: 'utf8' },
      (err, stdout, stderr) => {
        const out = (stdout || '').trim();
        if (out.startsWith('OK') && fs.existsSync(outPdf)) {
          resolve(outPdf);
          return;
        }
        const reason = out.startsWith('FAIL:')
          ? out.substring(5)
          : err?.message || stderr || 'unknown error';
        reject(new Error(`Word COM conversion failed: ${reason}`));
      }
    );
  });
}
