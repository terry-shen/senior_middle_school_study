/**
 * Exam Paper Import Routes
 * API endpoints for exam paper import and question management
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractTextFromPDF, extractTextFromPDFEnhanced } from '../services/pdf-service';
import { renderAllPages, savePageImage } from '../services/mcq-extractor-service';
import { parseWithMinerU, checkMinerUAvailable, convertWordToPdf } from '../services/mineru-service';
import { recognizeTextFromImage } from '../services/ocr-service';
import { splitQuestionsFromPaper, splitQuestionsFromMarkdown, autoTagQuestions, splitQuestionsByTags, splitQuestionsByTagsAndSave } from '../services/question-splitting-service';
import {
  enrichPaper,
  getEnrichmentStatus,
  setProposalStatus,
  getAcceptedProposals,
  clearProposals,
} from '../services/enricher-service';
import { requireAuth, requireAdmin } from '../middleware/permission';
import {
  validateAllQuestions,
  validatePaperQuestions,
  getQualityStats
} from '../services/quality-validation-service';
import { generateExamPDF, generateExamWord, ExportQuestion } from '../services/export-service';
import { convertImage, ensureQuestionImagesDir, resizeImage } from '../services/question-image-service';
import { parseDocx, parseDocLegacy, getWordFormat, parseDocxEnhanced } from '../services/word-service';
import { parseText } from '../services/text-service';
import { autoExtractMetadata } from '../services/paper-metadata-service';

const router = Router();
const prisma = new PrismaClient();

/**
 * Check if a question is referenced by any in-progress online exam or mock exam.
 * Returns { blocked: boolean, examNames: string[] }.
 * A question is blocked if it appears in an AnswerRecord whose ExamRecord.status='in_progress',
 * or in a MockExamAnswer whose MockExam.status='in_progress'.
 */
async function checkQuestionInUse(questionId: number): Promise<{ blocked: boolean; examNames: string[] }> {
  const examNames = new Set<string>();

  // 1) Online exams: AnswerRecord -> ExamRecord (status in_progress)
  const onlineRefs = await prisma.answerRecord.findMany({
    where: { questionId, record: { status: 'in_progress' } },
    include: { record: { include: { exam: { select: { title: true } } } } },
  });
  for (const r of onlineRefs) {
    const title = r.record?.exam?.title;
    if (title) examNames.add(title);
  }

  // 2) Mock exams: MockExamAnswer -> MockExam (status in_progress)
  const mockRefs = await prisma.mockExamAnswer.findMany({
    where: { questionId, mockExam: { status: 'in_progress' } },
    include: { mockExam: { select: { title: true } } },
  });
  for (const m of mockRefs) {
    const title = m.mockExam?.title;
    if (title) examNames.add(title);
  }

  return { blocked: examNames.size > 0, examNames: Array.from(examNames) };
}

// Simple wrapper functions
async function parsePdf(filePath: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const result = await extractTextFromPDF(filePath);
    return { success: true, text: result.text };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function performOcr(filePath: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const result = await recognizeTextFromImage(filePath);
    return { success: true, text: result.text };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(__dirname, '../../uploads/papers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `paper-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * POST /api/papers/import-whole
 * Import a whole exam paper (PDF/Word) as raw file WITHOUT MinerU parsing or question splitting.
 * Stores the original file + metadata and creates ExamPaper(purpose='whole_paper').
 */
router.post('/import-whole', requireAuth, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未选择文件' });
    }

    // Parse metadata from form fields (user-provided values take priority)
    const originalFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // Auto-extract metadata from filename (whole-paper import has no Markdown)
    const autoMeta = autoExtractMetadata({
      filename: originalFileName,
      markdown: null,
      userProvided: {
        ...(req.body.title ? { title: req.body.title as string } : {}),
        ...(req.body.year ? { year: parseInt(req.body.year) } : {}),
        ...(req.body.region ? { region: req.body.region as string } : {}),
        ...(req.body.examType ? { examType: req.body.examType as string } : {}),
        ...(req.body.totalScore ? { totalScore: parseInt(req.body.totalScore) } : {}),
        ...(req.body.duration ? { duration: parseInt(req.body.duration) } : {}),
        ...(req.body.subject ? { subject: req.body.subject as string } : {}),
        ...(req.body.school ? { school: req.body.school as string } : {}),
      },
    });

    const paper = await prisma.examPaper.create({
      data: {
        title: autoMeta.title || req.body.title || originalFileName.replace(/\.[^.]+$/, ''),
        year: autoMeta.year,
        region: autoMeta.region,
        examType: autoMeta.examType,
        totalScore: autoMeta.totalScore,
        duration: autoMeta.duration,
        subject: autoMeta.subject,
        school: req.body.school as string | undefined,
        sourceFormat: req.file.mimetype.includes('pdf') ? 'pdf' : 'word',
        purpose: 'whole_paper',
        pdfUrl: `/uploads/papers/${req.file.filename}`,
        status: 'uploaded',
      },
    });

    res.status(201).json({ success: true, paper });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/import-whole-multiple
 * Import MULTIPLE exam papers (folder import) as whole papers:
 * stores each original file + auto-extracted metadata, NO MinerU parse / question splitting.
 * Creates an ExamPaper(purpose='whole_paper') per file.
 */
const wholeMultiUpload = upload.array('files', 50);

router.post('/import-whole-multiple', requireAuth, requireAdmin, (req: Request, res: Response) => {
  wholeMultiUpload(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results: any[] = [];
    for (const file of files) {
      try {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        // Auto-extract metadata from filename (whole-paper has no parsed markdown)
        const autoMeta = autoExtractMetadata({
          filename: originalName,
          markdown: null,
          userProvided: {
            ...(req.body.title ? { title: req.body.title as string } : {}),
            ...(req.body.year ? { year: parseInt(req.body.year) } : {}),
            ...(req.body.region ? { region: req.body.region as string } : {}),
            ...(req.body.examType ? { examType: req.body.examType as string } : {}),
            ...(req.body.subject ? { subject: req.body.subject as string } : {}),
            ...(req.body.school ? { school: req.body.school as string } : {}),
          },
        });

        const paper = await prisma.examPaper.create({
          data: {
            title: autoMeta.title || originalName.replace(/\.[^.]+$/, ''),
            year: autoMeta.year,
            region: autoMeta.region,
            examType: autoMeta.examType,
            totalScore: autoMeta.totalScore,
            duration: autoMeta.duration,
            subject: autoMeta.subject,
            school: req.body.school as string | undefined,
            sourceFormat: file.mimetype.includes('pdf') ? 'pdf' : (file.mimetype.includes('word') || file.originalname.toLowerCase().endsWith('.docx') || file.originalname.toLowerCase().endsWith('.doc')) ? 'word' : 'image',
            purpose: 'whole_paper',
            pdfUrl: `/uploads/papers/${file.filename}`,
            status: 'uploaded',
          },
        });

        results.push({
          fileName: originalName,
          success: true,
          paperId: paper.id,
          title: paper.title,
          sourceFormat: paper.sourceFormat,
          purpose: 'whole_paper',
          contentLength: 0,
          hasMathContent: false,
        });
      } catch (fileErr: any) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        results.push({ fileName: originalName, success: false, error: fileErr.message });
      }
    }

    res.status(201).json({ success: true, results });
  });
});

/**
 * POST /api/papers/import
 * Import an exam paper from file upload
 */
router.post('/import', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, source, year, region, examType, totalScore, duration } = req.body;
    const filePath = file.path;
    const ext = path.extname(filePath).toLowerCase();
    // Fix mojibake: multer receives UTF-8 filename as Latin1
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    let rawContent = '';
    let imageUrl = '';
    let pdfUrl = '';
    let sourceFormat = '';
    let hasMathContent = false;
    let extractionFallback = false;
    let pageImages: string[] = [];
    let parsedMarkdown: string | null = null;
    let editedMarkdown: string | null = null;
    let parserUsed = 'unknown';

    // Process file based on extension
    if (ext === '.pdf') {
      pdfUrl = `/uploads/papers/${path.basename(filePath)}`;
      sourceFormat = 'pdf';

      // Try MinerU first (best quality: outputs Markdown with LaTeX formulas)
      const mineruAvailable = await checkMinerUAvailable();
      if (mineruAvailable) {
        console.log('[papers-import] Using MinerU for PDF parsing...');
        const mineruResult = await parseWithMinerU(filePath);
        if (mineruResult.success && mineruResult.markdown) {
          parsedMarkdown = mineruResult.markdown;
          rawContent = mineruResult.markdown; // Store markdown as rawContent for splitting
          hasMathContent = (mineruResult.latexFormulas?.length || 0) > 0;
          extractionFallback = false;
          parserUsed = 'mineru';
          console.log(`[papers-import] MinerU success: ${mineruResult.markdown.length} chars, ${mineruResult.latexFormulas?.length || 0} LaTeX formulas, ${mineruResult.processingTime}s`);
          // Auto-tag questions in the markdown for later tag-based splitting
          try {
            const tagged = autoTagQuestions(mineruResult.markdown);
            if (tagged !== mineruResult.markdown) {
              editedMarkdown = tagged;
              console.log(`[papers-import] Auto-tagged questions in markdown`);
            }
          } catch (tagErr) {
            console.warn(`[papers-import] Auto-tagging failed:`, (tagErr as Error).message);
          }
        } else {
          console.warn(`[papers-import] MinerU failed: ${mineruResult.error}, falling back to enhanced extraction`);
        }
      }

      // Fallback to enhanced PDF extraction if MinerU didn't work
      if (parserUsed === 'unknown') {
        const enhancedResult = await extractTextFromPDFEnhanced(filePath);
        hasMathContent = enhancedResult.hasMathContent;
        extractionFallback = enhancedResult.fallback;
        parserUsed = enhancedResult.fallback ? 'pdfjs' : 'mcq-extractor';
        if (enhancedResult.items && enhancedResult.items.length > 0) {
          rawContent = JSON.stringify({
            __type: 'mcq_extractor',
            items: enhancedResult.items,
            rawText: enhancedResult.rawText,
            hasMathContent: enhancedResult.hasMathContent,
            fallback: enhancedResult.fallback,
          });
        } else {
          rawContent = enhancedResult.rawText || '';
        }
      }

      // Extract page images for math/chart/diagram visual support
      // This renders each PDF page as PNG using PyMuPDF via the microservice
      try {
        const allPagesResult = await renderAllPages(filePath, 150);
        if (allPagesResult && allPagesResult.success && allPagesResult.pages.length > 0) {
          const paperDir = path.basename(filePath, ext);
          for (const page of allPagesResult.pages) {
            const savedPath = await savePageImage(
              page.image_base64,
              `${paperDir}_page_${page.page_num}`
            );
            if (savedPath) {
              pageImages.push(savedPath);
            }
          }
          console.log(`[papers-import] Rendered ${pageImages.length} page images for ${paperDir}`);
        }
      } catch (renderErr) {
        console.error('[papers-import] Page image extraction failed:', (renderErr as Error).message);
        // Non-fatal: text extraction still works, just no visual support
      }
    } else if (ext === '.docx' || ext === '.doc') {
      sourceFormat = 'word';

      // Convert Word → PDF first (MS Word COM) so MinerU's vision pipeline can
      // recognize formulas as LaTeX. MinerU cannot process .docx directly —
      // without LibreOffice it exports embedded WMF formula objects as images
      // instead of LaTeX. If conversion fails, fall back to direct MinerU
      // (works in LibreOffice-equipped environments) then mammoth extraction.
      let parseTarget = filePath;
      let tempPdf: string | null = null;
      try {
        tempPdf = await convertWordToPdf(filePath);
        parseTarget = tempPdf;
        console.log('[papers-import] Word→PDF conversion OK, parsing converted PDF with MinerU...');
      } catch (convErr) {
        console.warn(`[papers-import] Word→PDF conversion failed (${(convErr as Error).message}), trying direct MinerU...`);
      }

      try {
        // Try MinerU (on the converted PDF when available)
        const mineruAvailable = await checkMinerUAvailable();
        if (mineruAvailable) {
          console.log('[papers-import] Using MinerU for Word parsing...');
          const mineruResult = await parseWithMinerU(parseTarget);
          if (mineruResult.success && mineruResult.markdown) {
            parsedMarkdown = mineruResult.markdown;
            rawContent = mineruResult.markdown; // Store markdown as rawContent for splitting
            hasMathContent = (mineruResult.latexFormulas?.length || 0) > 0;
            extractionFallback = false;
            parserUsed = 'mineru';
            console.log(`[papers-import] MinerU success: ${mineruResult.markdown.length} chars, ${mineruResult.latexFormulas?.length || 0} LaTeX formulas, ${mineruResult.processingTime}s`);
            // Auto-tag questions in the markdown for later tag-based splitting
            try {
              const tagged = autoTagQuestions(mineruResult.markdown);
              if (tagged !== mineruResult.markdown) {
                editedMarkdown = tagged;
                console.log(`[papers-import] Auto-tagged questions in markdown`);
              }
            } catch (tagErr) {
              console.warn(`[papers-import] Auto-tagging failed:`, (tagErr as Error).message);
            }
          } else {
            console.warn(`[papers-import] MinerU failed: ${mineruResult.error}, falling back to enhanced extraction`);
          }
        }

        // Fallback to enhanced Word extraction (always on the original .docx)
        if (parserUsed === 'unknown') {
          const enhancedResult = await parseDocxEnhanced(filePath);
          hasMathContent = enhancedResult.hasMathContent;
          extractionFallback = enhancedResult.fallback;
          parserUsed = enhancedResult.fallback ? 'pdfjs' : 'mcq-extractor';
          if (enhancedResult.items && enhancedResult.items.length > 0) {
            rawContent = JSON.stringify({
              __type: 'mcq_extractor',
              items: enhancedResult.items,
              rawText: enhancedResult.rawText,
              hasMathContent: enhancedResult.hasMathContent,
              fallback: enhancedResult.fallback,
            });
          } else {
            rawContent = enhancedResult.rawText || '';
          }
        }
      } finally {
        // Clean up the temporary converted PDF
        if (tempPdf) {
          try { fs.unlinkSync(tempPdf); } catch { /* non-fatal */ }
        }
      }
    } else if (ext === '.txt') {
      // Parse text file with encoding detection
      const textResult = await parseText(filePath);
      rawContent = textResult;
      sourceFormat = 'txt';
    } else {
      // Perform OCR on image
      const ocrResult = await performOcr(filePath);
      if (ocrResult.success) {
        rawContent = ocrResult.text || '';
        imageUrl = `/uploads/papers/${path.basename(filePath)}`;
        sourceFormat = 'image';
      }
    }

    // Create paper record (auto-extract metadata from filename + parsed markdown)
    const autoMeta = autoExtractMetadata({
      filename: originalName,
      markdown: parsedMarkdown || rawContent,
      userProvided: {
        ...(title ? { title: title as string } : {}),
        ...(year ? { year: parseInt(year) } : {}),
        ...(region ? { region: region as string } : {}),
        ...(examType ? { examType: examType as string } : {}),
        ...(totalScore ? { totalScore: parseInt(totalScore) } : {}),
        ...(duration ? { duration: parseInt(duration) } : {}),
      },
    });

    const paper = await prisma.examPaper.create({
      data: {
        title: autoMeta.title || path.basename(originalName, ext),
        source: source || 'Unknown',
        year: autoMeta.year,
        region: autoMeta.region,
        examType: autoMeta.examType,
        rawContent,
        imageUrl,
        pdfUrl,
        sourceFormat,
        pageImages: pageImages.length > 0 ? JSON.stringify(pageImages) : null,
        parsedMarkdown,
        editedMarkdown,
        status: 'uploaded',
        totalScore: autoMeta.totalScore,
        duration: autoMeta.duration,
      },
    });

    // No auto-split after import — user must preview/edit/confirm via new workflow
    // See: PUT /api/papers/:id/markdown, POST /api/papers/:id/split-preview, POST /api/papers/:id/confirm-import

    res.status(201).json({
      success: true,
      paper,
      contentLength: rawContent.length,
      hasMathContent,
      extractionFallback,
      pageImagesCount: pageImages.length,
      parserUsed,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/papers/:id/markdown
 * Save user-edited Markdown (calibrated version)
 */
router.put('/:id/markdown', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    const { editedMarkdown } = req.body;
    if (typeof editedMarkdown !== 'string') {
      return res.status(400).json({ error: 'editedMarkdown is required' });
    }
    const paper = await prisma.examPaper.update({
      where: { id },
      data: { editedMarkdown, status: 'editing' },
    });
    res.json({ success: true, paper });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/:id/split-preview
 * Preview question splitting without creating DB records
 * Uses editedMarkdown if exists, otherwise falls back to parsedMarkdown
 */
router.post('/:id/split-preview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    const paper = await prisma.examPaper.findUnique({ where: { id } });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    const markdown = paper.editedMarkdown || paper.parsedMarkdown || paper.rawContent;
    if (!markdown || markdown.length < 10) {
      return res.status(400).json({ error: 'No markdown content to split' });
    }
    // Use tag-based splitting (falls back to regex if no tags)
    const result = splitQuestionsByTags(markdown);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    // Update status to split_preview
    await prisma.examPaper.update({ where: { id }, data: { status: 'split_preview' } });
    res.json({ success: true, questions: result.questions, source: paper.editedMarkdown ? 'edited' : 'parsed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/:id/confirm-import
 * Confirm import: split questions and create DB records.
 * Applies accepted AI cleaning proposals (EnrichmentProposal status=accepted) to
 * override content/options by questionNumber, then clears consumed proposals.
 */
router.post('/:id/confirm-import', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    const paper = await prisma.examPaper.findUnique({ where: { id } });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    const markdown = paper.editedMarkdown || paper.parsedMarkdown || paper.rawContent;
    if (!markdown || markdown.length < 10) {
      return res.status(400).json({ error: 'No markdown content to split' });
    }

    // Front-end calibrated questions (authoritative if provided): the user may have
    // edited content/options/answer/analysis in the split-preview calibration UI.
    const userEdited = Array.isArray(req.body?.questions) && req.body.questions.length > 0
      ? req.body.questions
      : undefined;

    // Build overrides from accepted AI cleaning proposals (content only; answer/analysis untouched)
    const accepted = await getAcceptedProposals(id);
    const overrides = new Map<number, { content: string }>();
    for (const p of accepted) {
      overrides.set(p.questionNumber, { content: p.cleanedText });
    }
    if (overrides.size > 0) {
      console.log(`[confirm-import] Applying ${overrides.size} accepted cleaning proposals for paper ${id}`);
    }

    // Use tag-based splitting and save (updates existing by sourceQuestionNumber match).
    // If user edited the split preview, their data wins over markdown re-split.
    const result = await splitQuestionsByTagsAndSave(id, markdown, overrides, userEdited);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Clean up consumed proposals so re-running import won't double-apply
    if (overrides.size > 0) {
      await clearProposals(id);
    }

    res.json({
      success: true,
      created: result.created,
      updated: result.updated,
      total: result.created + result.updated,
      appliedCleanings: overrides.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/:id/enrich
 * Run AI faithful-restoration cleaning on split questions (sync; may take minutes).
 * Results are stored as EnrichmentProposal (status=pending) and never auto-persist to Question.
 */
router.post('/:id/enrich', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    const summary = await enrichPaper(id);
    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/papers/:id/enrich/status
 * Get enrichment proposals + statistics for a paper
 */
router.get('/:id/enrich/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    const status = await getEnrichmentStatus(id);
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/papers/:id/enrich/proposals/:questionNumber
 * Accept or reject a single AI cleaning proposal (human review decision)
 */
router.patch('/:id/enrich/proposals/:questionNumber', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const questionNumber = parseInt(req.params.questionNumber as string);
    if (isNaN(id) || isNaN(questionNumber)) {
      return res.status(400).json({ error: 'Invalid paper ID or question number' });
    }
    const { status } = req.body;
    if (status !== 'accepted' && status !== 'rejected') {
      return res.status(400).json({ error: 'status must be "accepted" or "rejected"' });
    }
    await setProposalStatus(id, questionNumber, status);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/import-multiple
 * Import multiple files at once. Each file is processed sequentially via MinerU.
 * Returns an array of import results (success/failure per file).
 * Does NOT auto-redirect to editor — user stays on import page.
 */
const multiUpload = upload.array('files', 50);

router.post('/import-multiple', requireAuth, (req: Request, res: Response) => {
  multiUpload(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { title, source, year, region, examType, totalScore, duration } = req.body;
    const results: any[] = [];

    for (const file of files) {
      try {
        const filePath = file.path;
        const ext = path.extname(filePath).toLowerCase();
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

        let rawContent = '';
        let pdfUrl = '';
        let sourceFormat = '';
        let hasMathContent = false;
        let extractionFallback = false;
        let parsedMarkdown: string | null = null;
        let editedMarkdown: string | null = null;
        let parserUsed = 'unknown';

        if (ext === '.pdf') {
          pdfUrl = `/uploads/papers/${path.basename(filePath)}`;
          sourceFormat = 'pdf';
          const mineruAvailable = await checkMinerUAvailable();
          if (mineruAvailable) {
            console.log(`[import-multiple] MinerU: ${originalName}`);
            const mineruResult = await parseWithMinerU(filePath);
            if (mineruResult.success && mineruResult.markdown) {
              parsedMarkdown = mineruResult.markdown;
              rawContent = mineruResult.markdown;
              hasMathContent = (mineruResult.latexFormulas?.length || 0) > 0;
              parserUsed = 'mineru';
              try {
                editedMarkdown = autoTagQuestions(mineruResult.markdown);
              } catch { /* non-fatal */ }
            }
          }
          if (parserUsed === 'unknown') {
            const enhancedResult = await extractTextFromPDFEnhanced(filePath);
            hasMathContent = enhancedResult.hasMathContent;
            extractionFallback = enhancedResult.fallback;
            parserUsed = enhancedResult.fallback ? 'pdfjs' : 'mcq-extractor';
            rawContent = enhancedResult.rawText || JSON.stringify(enhancedResult.items || {});
          }
        } else if (ext === '.docx' || ext === '.doc') {
          sourceFormat = 'word';

          // Convert Word → PDF first (MS Word COM) so MinerU recognizes
          // formulas as LaTeX instead of exporting them as WMF images.
          let parseTarget = filePath;
          let tempPdf: string | null = null;
          try {
            tempPdf = await convertWordToPdf(filePath);
            parseTarget = tempPdf;
            console.log(`[import-multiple] Word→PDF conversion OK: ${originalName}`);
          } catch (convErr) {
            console.warn(`[import-multiple] Word→PDF conversion failed (${(convErr as Error).message}): ${originalName}`);
          }

          try {
            const mineruAvailable = await checkMinerUAvailable();
            if (mineruAvailable) {
              const mineruResult = await parseWithMinerU(parseTarget);
              if (mineruResult.success && mineruResult.markdown) {
                parsedMarkdown = mineruResult.markdown;
                rawContent = mineruResult.markdown;
                hasMathContent = (mineruResult.latexFormulas?.length || 0) > 0;
                parserUsed = 'mineru';
                try {
                  editedMarkdown = autoTagQuestions(mineruResult.markdown);
                } catch { /* non-fatal */ }
              }
            }
            if (parserUsed === 'unknown') {
              const enhancedResult = await parseDocxEnhanced(filePath);
              rawContent = enhancedResult.rawText || '';
              parserUsed = 'word';
            }
          } finally {
            // Clean up the temporary converted PDF
            if (tempPdf) {
              try { fs.unlinkSync(tempPdf); } catch { /* non-fatal */ }
            }
          }
        } else if (ext === '.txt') {
          const { parseText } = require('../services/text-service');
          rawContent = await parseText(filePath);
          sourceFormat = 'txt';
          parserUsed = 'text';
        } else {
          results.push({ fileName: originalName, success: false, error: 'Unsupported format' });
          continue;
        }

        // Auto-extract metadata per file (filename + this file's parsed markdown)
        const autoMeta = autoExtractMetadata({
          filename: originalName,
          markdown: parsedMarkdown || rawContent,
          userProvided: {
            ...(title ? { title: title as string } : {}),
            ...(year ? { year: parseInt(year) } : {}),
            ...(region ? { region: region as string } : {}),
            ...(examType ? { examType: examType as string } : {}),
            ...(totalScore ? { totalScore: parseInt(totalScore) } : {}),
            ...(duration ? { duration: parseInt(duration) } : {}),
          },
        });

        const paper = await prisma.examPaper.create({
          data: {
            title: autoMeta.title || path.basename(originalName, ext),
            source: source || 'Unknown',
            year: autoMeta.year,
            region: autoMeta.region,
            examType: autoMeta.examType,
            rawContent,
            pdfUrl,
            sourceFormat,
            parsedMarkdown,
            editedMarkdown,
            status: 'uploaded',
            totalScore: autoMeta.totalScore,
            duration: autoMeta.duration,
          },
        });

        results.push({
          fileName: originalName,
          success: true,
          paperId: paper.id,
          title: paper.title,
          parserUsed,
          contentLength: rawContent.length,
          hasMathContent,
        });
      } catch (fileErr: any) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        results.push({ fileName: originalName, success: false, error: fileErr.message });
      }
    }

    res.status(201).json({ success: true, results });
  });
});

/**
 * GET /api/papers/:id/download-source
 * Download the original source file (PDF/DOCX) for a paper
 */
router.get('/:id/download-source', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    const paper = await prisma.examPaper.findUnique({ where: { id } });
    if (!paper || !paper.pdfUrl) {
      return res.status(404).json({ error: 'Source file not found' });
    }
    const filePath = path.join(process.cwd(), paper.pdfUrl.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Source file not found on disk' });
    }
    res.download(filePath, paper.title + path.extname(filePath));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/papers/:id/download-file
 * Download the original whole-paper file (for students to print).
 * Student access requires the paper to be published as an Exam assigned to them.
 */
router.get('/:id/download-file', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    const paper = await prisma.examPaper.findUnique({ where: { id } });
    if (!paper || !paper.pdfUrl) {
      return res.status(404).json({ error: '试卷文件不存在' });
    }
    // Students can only download whole_paper files that are published and assigned to them
    if (req.user?.role !== 'admin') {
      if (paper.purpose !== 'whole_paper') {
        return res.status(403).json({ error: '仅整卷可下载' });
      }
      const assignedExam = await prisma.exam.findFirst({
        where: {
          status: 'published',
          paperId: id, // strictly link this paper to the exam
          OR: [
            { assignments: { some: { studentId: req.user!.id } } },
            { assignments: { some: { class: { students: { some: { id: req.user!.id } } } } } },
          ],
        },
        include: { assignments: true },
      });
      // Verify this exam is linked to this paper via paperId FK
      if (!assignedExam) {
        return res.status(403).json({ error: '未分配此试卷' });
      }
    }
    const filePath = path.join(process.cwd(), paper.pdfUrl.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '试卷文件不存在' });
    }
    res.download(filePath, paper.title + path.extname(filePath));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/:id/split
 * Split questions from an exam paper (legacy endpoint, kept for backward compatibility)
 */
router.post('/:id/split', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }

    const result = await splitQuestionsFromPaper(id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      questionsCreated: result.questions.length,
      questions: result.questions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/papers
 * List all exam papers
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, source, year, purpose } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (source) {
      where.source = source as string;
    }
    if (year) {
      where.year = parseInt(year as string);
    }
    if (purpose) {
      where.purpose = purpose as string;
    }

    const papers = await prisma.examPaper.findMany({
      where,
      include: {
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(papers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/papers/:id
 * Get exam paper details
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }

    const paper = await prisma.examPaper.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { questionNumber: 'asc' },
        },
      },
    });

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Parse pageImages from JSON string to array
    const paperWithParsedImages = {
      ...paper,
      pageImages: paper.pageImages ? JSON.parse(paper.pageImages) : [],
    };

    res.json(paperWithParsedImages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/papers/:id/page-images
 * Get page images for a paper (rendered PDF pages as PNG)
 */
router.get('/:id/page-images', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }

    const paper = await prisma.examPaper.findUnique({
      where: { id },
      select: { id: true, title: true, pageImages: true, pdfUrl: true },
    });

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const pageImages = paper.pageImages ? JSON.parse(paper.pageImages) : [];

    res.json({
      success: true,
      paperId: paper.id,
      title: paper.title,
      pageImages,
      count: pageImages.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/papers/:id/questions
 * Get questions from a paper
 */
router.get('/:id/questions', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }

    const questions = await prisma.question.findMany({
      where: { paperId: id },
      orderBy: { questionNumber: 'asc' },
    });

    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/papers/:id
 * Update exam paper metadata
 */
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }

    const { title, source, year, region, examType, totalScore, duration, status } = req.body;

    const paper = await prisma.examPaper.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(source && { source }),
        ...(year && { year: parseInt(year) }),
        ...(region && { region }),
        ...(examType && { examType }),
        ...(totalScore && { totalScore: parseInt(totalScore) }),
        ...(duration && { duration: parseInt(duration) }),
        ...(status && { status }),
      },
    });

    res.json(paper);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/papers/:id
 * Delete an exam paper and its questions
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }

    // Check if paper exists
    const paper = await prisma.examPaper.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Delete associated files
    if (paper.imageUrl) {
      const imagePath = path.join(__dirname, '../../uploads/papers', path.basename(paper.imageUrl));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    if (paper.pdfUrl) {
      const pdfPath = path.join(__dirname, '../../uploads/papers', path.basename(paper.pdfUrl));
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    }

    // Delete paper (questions will cascade delete)
    await prisma.examPaper.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Paper deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/questions
 * List all questions with filters
 */
router.get('/questions/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { questionType, difficulty, paperId, aiAnalyzed, keyword, minScore, maxScore, page, limit } = req.query;

    const where: any = {};
    if (questionType) {
      where.questionType = questionType;
    }
    if (difficulty) {
      where.difficulty = difficulty;
    }
    if (paperId) {
      where.paperId = parseInt(paperId as string);
    }
    if (aiAnalyzed !== undefined) {
      where.aiAnalyzed = aiAnalyzed === 'true';
    }
    if (keyword) {
      // Search in content field
      where.content = {
        contains: keyword as string,
      };
    }
    if (minScore || maxScore) {
      where.score = {};
      if (minScore) {
        where.score.gte = parseFloat(minScore as string);
      }
      if (maxScore) {
        where.score.lte = parseFloat(maxScore as string);
      }
    }

    // Pagination
    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 50;
    const skip = (pageNum - 1) * limitNum;

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          paper: {
            select: {
              id: true,
              title: true,
              source: true,
              year: true,
            },
          },
        },
        orderBy: [
          { paperId: 'asc' },
          { questionNumber: 'asc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.question.count({ where }),
    ]);

    res.json({
      data: questions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/questions/:id
 * Get question details
 */
router.get('/questions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        paper: true,
      },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/questions/:id
 * Update question details
 */
router.put('/questions/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const { content, questionType, score, difficulty, analysis, answer, options, imageUrl } = req.body;

    const question = await prisma.question.update({
      where: { id },
      data: {
        ...(content && { content }),
        ...(questionType && { questionType }),
        ...(score !== undefined && { score }),
        ...(difficulty && { difficulty }),
        ...(analysis && { analysis }),
        ...(answer && { answer }),
        ...(options && { options }),
        ...(imageUrl && { imageUrl }),
      },
    });

    res.json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/questions/batch/update
 * Batch update questions
 */
router.post('/questions/batch/update', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids, updates } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates must be an object' });
    }
    
    const { difficulty, aiAnalyzed } = updates;
    const data: any = {};
    if (difficulty) data.difficulty = difficulty;
    if (aiAnalyzed !== undefined) data.aiAnalyzed = aiAnalyzed;
    
    const result = await prisma.question.updateMany({
      where: {
        id: { in: ids.map((id: number) => id) },
      },
      data,
    });
    
    res.json({
      success: true,
      updated: result.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/questions/:id
 * Delete a single question (Admin only). Blocked if referenced by in-progress exams.
 * Relies on Prisma onDelete: Cascade for related records cleanup.
 */
router.delete('/questions/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }

    // Block if referenced by in-progress exams
    const check = await checkQuestionInUse(id);
    if (check.blocked) {
      return res.status(409).json({
        error: '题目被进行中的测验引用，无法删除',
        blocked: [{ questionId: id, examNames: check.examNames }],
      });
    }

    await prisma.question.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/questions/batch/delete
 * Batch delete questions (Admin only). Blocks if any question is referenced by in-progress exams.
 * Max 500 ids per call.
 */
router.post('/questions/batch/delete', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (ids.length > 500) {
      return res.status(400).json({ error: '单次批量删除上限 500 题，请分批删除' });
    }

    // Check all questions for in-progress exam references
    const checks = await Promise.all(ids.map((id: number) => checkQuestionInUse(id)));
    const blockedItems = checks
      .map((c, i) => (c.blocked ? { questionId: ids[i], examNames: c.examNames } : null))
      .filter(Boolean);

    if (blockedItems.length > 0) {
      return res.status(409).json({
        error: '部分题目被进行中的测验引用，无法删除',
        blocked: blockedItems,
      });
    }

    const result = await prisma.question.deleteMany({
      where: { id: { in: ids.map((id: number) => id) } },
    });

    res.json({
      success: true,
      deleted: result.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/questions/quality/report
 * Get data quality validation report for all questions
 */
router.get('/questions/quality/report', requireAuth, async (req: Request, res: Response) => {
  try {
    const report = await validateAllQuestions();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/questions/quality/stats
 * Get quality statistics
 */
router.get('/questions/quality/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await getQualityStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/papers/:id/quality
 * Get quality validation report for a specific paper
 */
router.get('/:id/quality', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid paper ID' });
    }
    
    const report = await validatePaperQuestions(id);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/export/pdf
 * Export questions as a PDF document (Task 7.5)
 */
router.post('/export/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const { questionIds, title } = req.body;
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'questionIds array is required' });
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      orderBy: { id: 'asc' },
    });

    const items: ExportQuestion[] = questions.map((q) => ({
      id: q.id,
      questionNumber: q.questionNumber,
      content: q.content,
      questionType: q.questionType,
      options: q.options,
      answer: q.answer,
      analysis: q.analysis,
      score: q.score,
    }));

    const filePath = await generateExamPDF({ title: title || '试题导出', questions: items });
    res.download(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/export/word
 * Export questions as a Word document (Task 7.5)
 */
router.post('/export/word', requireAuth, async (req: Request, res: Response) => {
  try {
    const { questionIds, title } = req.body;
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'questionIds array is required' });
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      orderBy: { id: 'asc' },
    });

    const items: ExportQuestion[] = questions.map((q) => ({
      id: q.id,
      questionNumber: q.questionNumber,
      content: q.content,
      questionType: q.questionType,
      options: q.options,
      answer: q.answer,
      analysis: q.analysis,
      score: q.score,
    }));

    const filePath = await generateExamWord({ title: title || '试题导出', questions: items });
    res.download(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/questions/:id/image
 * Upload / convert a question image (Task 6.9)
 */
router.post('/questions/:id/image', requireAdmin, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const question = await prisma.question.findUnique({ where: { id } });
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const qDir = ensureQuestionImagesDir();
    const format = (req.body.format || 'png') as 'png' | 'jpeg' | 'webp';
    const converted = await convertImage(req.file.path, format, path.join(qDir, `${id}-${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`));

    const imageUrl = `/uploads/question-images/${path.basename(converted.filePath)}`;
    const updated = await prisma.question.update({
      where: { id },
      data: { imageUrl },
    });

    res.json({ id: updated.id, imageUrl, width: converted.width, height: converted.height });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/questions/image/convert
 * Convert image format and resize (Task 6.9)
 */
router.post('/image/convert', requireAdmin, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const format = (req.body.format || 'png') as 'png' | 'jpeg' | 'webp';
    const maxWidth = parseInt(req.body.maxWidth || '0') || 0;
    const maxHeight = parseInt(req.body.maxHeight || '0') || 0;

    let filePath = req.file.path;
    const qDir = ensureQuestionImagesDir();
    const converted = await convertImage(filePath, format, path.join(qDir, `convert-${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`));

    let width = converted.width;
    let height = converted.height;
    if (maxWidth > 0 && maxHeight > 0) {
      const resized = await resizeImage(converted.filePath, maxWidth, maxHeight);
      width = resized.width;
      height = resized.height;
    }

    res.json({
      url: `/uploads/question-images/${path.basename(converted.filePath)}`,
      width,
      height,
      format,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;