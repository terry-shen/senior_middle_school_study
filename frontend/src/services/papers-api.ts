/**
 * Papers API Service
 * Handles exam paper import and question management
 */

const API_BASE = 'http://localhost:3000/api';

export interface ExamPaper {
  id: number;
  title: string;
  source: string;
  year: string;
  region: string;
  examType: string;
  imageUrl?: string;
  pdfUrl?: string;
  rawContent?: string;
  status: 'pending' | 'splitting' | 'analyzing' | 'completed' | 'failed' | 'uploaded' | 'editing' | 'split_preview';
  totalScore: number;
  duration: number;
  sourceFormat?: string; // pdf | image | word | txt
  pageImages?: string[]; // rendered page image URLs (for math/chart visual support)
  parsedMarkdown?: string; // MinerU parsed Markdown with LaTeX formulas
  editedMarkdown?: string; // User-edited Markdown (calibrated version)
  createdAt: string;
  updatedAt: string;
  _count?: { questions: number };
}

export interface Question {
  id: number;
  paperId: number;
  questionNumber: string;
  content: string;
  questionType: 'choice' | 'fill' | 'essay' | 'unknown';
  score: number;
  difficulty?: string;
  analysis?: string;
  answer?: string;
  options?: string;
  imageUrl?: string;
  aiAnalyzed: boolean;
  createdAt: string;
  paper?: { id: number; title: string; source?: string; year?: number };
}

export interface ImportResult {
  success: boolean;
  paper?: ExamPaper;
  error?: string;
  contentLength?: number;
  hasMathContent?: boolean;
  extractionFallback?: boolean;
  pageImagesCount?: number;
  parserUsed?: string; // mineru | mcq-extractor | pdfjs
}

export interface SplitResult {
  success: boolean;
  questions?: Question[];
  error?: string;
}

/**
 * Import exam paper from image
 */
export async function importFromImage(token: string, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/papers/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`导入失败 (${response.status}): ${text.substring(0, 200)}`);
  }
  return response.json();
}

/**
 * Import exam paper from PDF
 */
export async function importFromPDF(token: string, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/papers/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`导入失败 (${response.status}): ${text.substring(0, 200)}`);
  }
  return response.json();
}

/**
 * Split questions from paper
 */
export async function splitQuestions(token: string, paperId: number): Promise<SplitResult> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/split`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Get all exam papers
 */
export async function getPapers(token: string): Promise<ExamPaper[]> {
  const response = await fetch(`${API_BASE}/papers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Get exam paper by ID
 */
export async function getPaper(token: string, id: number): Promise<ExamPaper> {
  const response = await fetch(`${API_BASE}/papers/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Update exam paper
 */
export async function updatePaper(token: string, id: number, data: Partial<ExamPaper>): Promise<ExamPaper> {
  const response = await fetch(`${API_BASE}/papers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  return response.json();
}

/**
 * Delete exam paper
 */
export async function deletePaper(token: string, id: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/papers/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Get questions from paper
 */
export async function getQuestions(token: string, paperId: number): Promise<Question[]> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/questions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Get all questions
 */
export async function getAllQuestions(token: string): Promise<Question[]> {
  const response = await fetch(`${API_BASE}/papers/questions/all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  // Backend returns { data: [...], pagination: {...} } after module 7.3
  if (result && result.data && Array.isArray(result.data)) {
    return result.data;
  }
  // Fallback: plain array
  return Array.isArray(result) ? result : [];
}

/**
 * Get question by ID
 */
export async function getQuestion(token: string, id: number): Promise<Question> {
  const response = await fetch(`${API_BASE}/papers/questions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Update question
 */
export async function updateQuestion(token: string, id: number, data: Partial<Question>): Promise<Question> {
  const response = await fetch(`${API_BASE}/papers/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  return response.json();
}

/**
 * Blocked item info returned when a question cannot be deleted
 * because it is referenced by an in-progress exam/mock exam.
 */
export interface BlockedItem {
  questionId: number;
  examNames: string[];
}

/**
 * Delete result - success shape or blocked shape
 */
export interface DeleteResult {
  success?: boolean;
  deleted?: number;
  error?: string;
  blocked?: BlockedItem[];
}

/**
 * Delete a single question by ID.
 * Returns {success: true} on success, or {error, blocked:[{questionId, examNames}]} (HTTP 409) if blocked.
 */
export async function deleteQuestion(token: string, id: number): Promise<DeleteResult> {
  const response = await fetch(`${API_BASE}/papers/questions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json().catch(() => ({ error: `删除失败 (${response.status})` }));
  if (!response.ok && response.status !== 409) {
    throw new Error(result.error || `删除失败 (${response.status})`);
  }
  return result as DeleteResult;
}

/**
 * Batch delete questions by IDs.
 * Body: { ids: number[] }
 * Returns {success: true, deleted: N} on success, or {error, blocked:[{questionId, examNames}]} (HTTP 409) if any blocked.
 * Throws on 400 (empty/>500) or other non-409 errors.
 */
export async function batchDeleteQuestions(token: string, ids: number[]): Promise<DeleteResult> {
  const response = await fetch(`${API_BASE}/papers/questions/batch/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  });
  const result = await response.json().catch(() => ({ error: `批量删除失败 (${response.status})` }));
  if (!response.ok && response.status !== 409) {
    throw new Error(result.error || `批量删除失败 (${response.status})`);
  }
  return result as DeleteResult;
}

/**
 * Get page images for a paper (rendered PDF pages as PNG)
 */
export async function getPageImages(token: string, paperId: number): Promise<string[]> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/page-images`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.pageImages || [];
}

/**
 * Reconstruct math content for a single question using LLM
 * Converts garbled/missing math formulas to proper LaTeX
 */
export async function reconstructMath(token: string, questionId: number): Promise<{ success: boolean; content?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/analysis/reconstruct/${questionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({ error: `重构失败 (${response.status})` }));
  if (!response.ok) {
    return { success: false, error: data.error || `重构失败 (${response.status})` };
  }
  return data;
}

/**
 * Batch reconstruct math content for all questions from a paper
 */
export async function batchReconstructMath(token: string, paperId: number): Promise<{ success: number; failed: number; total: number }> {
  const response = await fetch(`${API_BASE}/analysis/reconstruct/batch/${paperId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({ success: 0, failed: 0, total: 0 }));
  return data;
}

// ===== Paper Edit Workflow API =====

export interface SplitPreviewQuestion {
  questionNumber: number;
  content: string;
  questionType: string;
  options?: string[];
  correctAnswer?: string;
  analysis?: string;
}

/**
 * Save user-edited Markdown (calibrated version)
 */
export async function saveMarkdown(token: string, paperId: number, editedMarkdown: string): Promise<{ success: boolean; paper?: ExamPaper; error?: string }> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/markdown`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ editedMarkdown }),
  });
  const data = await response.json().catch(() => ({ success: false, error: `保存失败 (${response.status})` }));
  return data;
}

/**
 * Preview question splitting without creating DB records
 */
export async function splitPreview(token: string, paperId: number): Promise<{ success: boolean; questions?: SplitPreviewQuestion[]; source?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/split-preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({ success: false, error: `拆分预览失败 (${response.status})` }));
  return data;
}

/**
 * Confirm import: split questions and create DB records
 */
export async function confirmImport(token: string, paperId: number): Promise<{ success: boolean; questionsCreated?: number; error?: string }> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/confirm-import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({ success: false, error: `确认导入失败 (${response.status})` }));
  return data;
}

export interface MultiImportResult {
  success: boolean;
  fileName: string;
  paperId?: number;
  title?: string;
  parserUsed?: string;
  contentLength?: number;
  hasMathContent?: boolean;
  error?: string;
}

export async function importMultipleFiles(token: string, files: File[]): Promise<{ success: boolean; results: MultiImportResult[] }> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const response = await fetch(`${API_BASE}/papers/import-multiple`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({ success: false, results: [], error: `多文件导入失败 (${response.status})` }));
  return data;
}

export function getDownloadSourceUrl(paperId: number): string {
  return `${API_BASE}/papers/${paperId}/download-source`;
}
