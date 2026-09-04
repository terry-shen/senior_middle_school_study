/**
 * Export Service
 * Unified PDF and Word export for questions, exams, and wrong questions
 * (Tasks 7.5, 10.5, 10.6, 16.8)
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const EXPORT_DIR = path.join(__dirname, '../../exports');

// Ensure export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

export interface ExportQuestion {
  id?: number;
  questionNumber?: number;
  content: string;
  questionType?: string;
  options?: string | Record<string, string> | null;
  answer?: string | null;
  analysis?: string | null;
  score?: number | null;
}

export interface ExportPaper {
  title: string;
  questions: ExportQuestion[];
  totalScore?: number;
}

const TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  essay: '解答题',
  unknown: '题目',
};

function parseOptions(options: string | Record<string, string> | null | undefined): Record<string, string> {
  if (!options) return {};
  if (typeof options === 'object') return options;
  try {
    const parsed = JSON.parse(options);
    return typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Generate a PDF document from exam paper data
 */
export async function generateExamPDF(paper: ExportPaper, outputPath?: string): Promise<string> {
  const filePath = outputPath || path.join(EXPORT_DIR, `${sanitize(paper.title)}-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Title
  doc.fontSize(20).font('Helvetica-Bold').text(paper.title || '数学试卷', { align: 'center' });
  if (paper.totalScore != null) {
    doc.fontSize(11).font('Helvetica').text(`满分：${paper.totalScore}分`, { align: 'center' });
  }
  doc.moveDown(1);

  let questionCounter = 0;
  for (const q of paper.questions) {
    questionCounter++;
    const type = TYPE_LABELS[q.questionType || 'unknown'] || '题目';
    const num = q.questionNumber || questionCounter;

    doc.fontSize(12).font('Helvetica-Bold').text(`${num}. ${type}${q.score != null ? `（${q.score}分）` : ''}`);
    doc.moveDown(0.2);

    doc.fontSize(11).font('Helvetica').text(q.content || '', { width: doc.page.width - 100 });

    const options = parseOptions(q.options);
    const optionKeys = Object.keys(options);
    if (optionKeys.length > 0) {
      doc.moveDown(0.2);
      for (const key of optionKeys) {
        doc.fontSize(11).text(`${key}. ${options[key]}`, { indent: 20 });
      }
    }

    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#555555').text(`答案：${q.answer || '—'}`);
    if (q.analysis) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#555555').text(`解析：${q.analysis}`);
    }
    doc.fillColor('#000000').font('Helvetica');
    doc.moveDown(1);
  }

  doc.end();
  await new Promise<void>((resolve) => stream.on('close', resolve));
  return filePath;
}

/**
 * Generate a Word (.docx) document using the docx library
 */
export async function generateExamWord(paper: ExportPaper, outputPath?: string): Promise<string> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
  const filePath = outputPath || path.join(EXPORT_DIR, `${sanitize(paper.title)}-${Date.now()}.docx`);

  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: paper.title || '数学试卷', bold: true, size: 40 })],
    })
  );
  if (paper.totalScore != null) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `满分：${paper.totalScore}分`, size: 22 })],
      })
    );
  }
  children.push(new Paragraph({ children: [] }));

  let questionCounter = 0;
  for (const q of paper.questions) {
    questionCounter++;
    const type = TYPE_LABELS[q.questionType || 'unknown'] || '题目';
    const num = q.questionNumber || questionCounter;
    const header = `${num}. ${type}${q.score != null ? `（${q.score}分）` : ''}`;

    children.push(
      new Paragraph({
        children: [new TextRun({ text: header, bold: true, size: 24 })],
        spacing: { before: 200 },
      })
    );
    children.push(new Paragraph({ children: [new TextRun({ text: q.content || '', size: 22 })] }));

    const options = parseOptions(q.options);
    const optionKeys = Object.keys(options);
    for (const key of optionKeys) {
      children.push(
        new Paragraph({
          indent: { left: 400 },
          children: [new TextRun({ text: `${key}. ${options[key]}`, size: 22 })],
        })
      );
    }
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `答案：${q.answer || '—'}`, italics: true, size: 20, color: '555555' })],
      })
    );
    if (q.analysis) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `解析：${q.analysis}`, italics: true, size: 20, color: '555555' })],
        })
      );
    }
    children.push(new Paragraph({ children: [] }));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

export { EXPORT_DIR };
