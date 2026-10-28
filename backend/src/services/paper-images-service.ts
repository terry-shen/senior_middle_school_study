/**
 * Paper Image Service
 *
 * Supports importing one exam paper from MULTIPLE photos (e.g. taken with a phone)
 * and merging them into a single downloadable PDF for students to print.
 *
 * ExamPaper stores the photo list in the `pageImages` column as a JSON array of
 * public URLs (e.g. ["/uploads/papers/paper-123.jpg", ...]).
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

/**
 * Convert a public /uploads/... URL into an absolute path on disk.
 * Returns null when the URL is not an uploads URL or escapes the uploads root.
 */
export function resolveUploadPath(url: string): string | null {
  if (!url) return null;
  let rel = url;
  if (rel.startsWith('/uploads/')) {
    rel = rel.slice('/uploads/'.length);
  } else if (rel.startsWith('uploads/')) {
    rel = rel.slice('uploads/'.length);
  } else {
    return null;
  }
  const abs = path.resolve(UPLOADS_ROOT, rel);
  // Prevent path traversal outside the uploads root
  if (!abs.startsWith(path.resolve(UPLOADS_ROOT))) return null;
  return abs;
}

/**
 * Parse the ExamPaper.pageImages JSON column into a string array.
 */
export function parsePageImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string');
    return [];
  } catch {
    return [];
  }
}

/**
 * Merge a list of image URLs into a single PDF (one page per image).
 *
 * Each page keeps the photo's native aspect ratio so the result can be printed
 * without distortion. Returns the number of images successfully embedded.
 */
export async function buildImagesPdf(imageUrls: string[], outPath: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  let embedded = 0;
  for (const url of imageUrls) {
    const abs = resolveUploadPath(url);
    if (!abs || !fs.existsSync(abs)) continue;
    try {
      const meta = await sharp(abs).metadata();
      const width = meta.width || 0;
      const height = meta.height || 0;
      if (!width || !height) continue;

      // Convert to a JPEG buffer pdfkit can embed reliably
      const buf = await sharp(abs).jpeg({ quality: 85 }).toBuffer();

      // 96 dpi pixels -> 72 pt (PDF user space)
      const pageW = width * 0.75;
      const pageH = height * 0.75;

      doc.addPage({ size: [pageW, pageH] });
      doc.image(buf, 0, 0, { width: pageW, height: pageH });
      embedded++;
    } catch (e) {
      console.warn(`[paper-images] failed to embed ${url}:`, (e as Error).message);
    }
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', (err) => reject(err));
  });

  return embedded;
}

/**
 * Resolve the on-disk file for a paper's downloadable original file.
 * For multi-photo papers (pageImages with >1 entry and no pdfUrl) a merged PDF
 * is generated on demand into uploads/papers/generated/ and its path returned.
 */
export async function resolvePaperDownloadFile(paper: {
  id: number;
  title: string;
  pdfUrl?: string | null;
  pageImages?: string | null;
}): Promise<{ filePath: string; filename: string } | null> {
  // 1) Single original file (PDF / Word / TXT)
  if (paper.pdfUrl) {
    const abs = path.join(process.cwd(), paper.pdfUrl.replace(/^\//, ''));
    if (fs.existsSync(abs)) {
      return { filePath: abs, filename: paper.title + path.extname(abs) };
    }
  }

  // 2) Multi-photo paper → generate merged PDF
  const images = parsePageImages(paper.pageImages);
  if (images.length > 0) {
    const outDir = path.join(UPLOADS_ROOT, 'papers', 'generated');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `paper-${paper.id}-merged.pdf`);

    // Reuse a previously generated file when it is still up to date
    let needsBuild = true;
    if (fs.existsSync(outPath)) {
      const stat = fs.statSync(outPath);
      needsBuild = stat.mtimeMs < (fs.statSync(path.join(UPLOADS_ROOT, 'papers')).mtimeMs || 0);
    }

    if (needsBuild) {
      const count = await buildImagesPdf(images, outPath);
      if (count === 0) return null;
    }
    if (fs.existsSync(outPath)) {
      return { filePath: outPath, filename: `${paper.title}.pdf` };
    }
  }

  return null;
}
