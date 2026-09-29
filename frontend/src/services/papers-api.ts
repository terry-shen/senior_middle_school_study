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
  purpose?: 'whole_paper' | 'question_source'; // whole_paper=整卷考试；question_source=拆分来源（默认）
  subject?: string | null; // 学科（试卷库分类）：语文/数学/英语/物理/化学/生物/政治/历史/地理/理综/文综
  school?: string | null; // 学校（自由文本，试卷库分类）
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
  questionType: 'single_choice' | 'multiple_choice' | 'fill' | 'essay' | 'unknown' | 'choice';
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
 * Confirm import: split questions and create DB records.
 * If questions[] is provided (from split-preview calibration), those edited
 * questions are saved authoritatively instead of re-splitting from markdown.
 */
export async function confirmImport(
  token: string,
  paperId: number,
  questions?: SplitPreviewQuestion[]
): Promise<{ success: boolean; questionsCreated?: number; appliedCleanings?: number; error?: string }> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/confirm-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: questions && questions.length > 0 ? JSON.stringify({ questions }) : undefined,
  });
  const data = await response.json().catch(() => ({ success: false, error: `确认导入失败 (${response.status})` }));
  return data;
}

// ============ AI 忠实还原清洗 (paper-enrichment) ============

export interface EnrichmentSummary {
  total: number;
  changed: number;
  failed: number;
  unchanged: number;
}

export interface EnrichmentProposal {
  questionNumber: number;
  originalText: string;
  cleanedText: string;
  changes: string[];
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface EnrichmentStatus {
  total: number;
  changed: number;
  accepted: number;
  rejected: number;
  pending: number;
  needsReview: number;
  proposals: EnrichmentProposal[];
}

/**
 * Run AI faithful-restoration cleaning on split questions.
 * NOTE: synchronous long-running call (~10-60 min for large papers) — do not set a client timeout.
 */
export async function enrichPaper(token: string, paperId: number): Promise<{ success: boolean; summary?: EnrichmentSummary; error?: string }> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/enrich`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({ success: false, error: `AI 清洗失败 (${response.status})` }));
  return data;
}

/**
 * Get enrichment proposals + statistics for a paper
 */
export async function getEnrichmentStatus(token: string, paperId: number): Promise<EnrichmentStatus> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/enrich/status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`获取清洗状态失败 (${response.status})`);
  }
  const data = await response.json();
  return {
    total: data.total || 0,
    changed: data.changed || 0,
    accepted: data.accepted || 0,
    rejected: data.rejected || 0,
    pending: data.pending || 0,
    needsReview: data.needsReview || 0,
    proposals: Array.isArray(data.proposals) ? data.proposals : [],
  };
}

/**
 * Accept or reject a single AI cleaning proposal
 */
export async function setEnrichmentProposalStatus(
  token: string,
  paperId: number,
  questionNumber: number,
  status: 'accepted' | 'rejected'
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/enrich/proposals/${questionNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`更新清洗提议失败 (${response.status}): ${text.substring(0, 200)}`);
  }
  return response.json();
}

export interface MultiImportResult {
  success: boolean;
  fileName: string;
  paperId?: number;
  title?: string;
  purpose?: string;
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

/**
 * 多文件整卷导入（文件夹导入）：目录下每个文件直接保存为整卷（不解析/不拆分）
 * POST /api/papers/import-whole-multiple (multipart/form-data)
 */
export async function importWholePapers(token: string, files: File[]): Promise<{ success: boolean; results: MultiImportResult[] }> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const response = await fetch(`${API_BASE}/papers/import-whole-multiple`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({ success: false, results: [], error: `文件夹整卷导入失败 (${response.status})` }));
  return data;
}

export function getDownloadSourceUrl(paperId: number): string {
  return `${API_BASE}/papers/${paperId}/download-source`;
}

/**
 * 整卷文件下载（学生下载已发布整卷试卷）。
 * 通过 Authorization header 携带 token（后端 requireAuth 只认 header，不认 query token）。
 * 返回 Blob + 从 Content-Disposition 提取的下载文件名。
 */
export async function downloadWholePaperFile(
  token: string,
  paperId: number,
  fallbackFilename?: string
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE}/papers/${paperId}/download-file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    let message = `下载失败 (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  // 解析 Content-Disposition 中的文件名（cd 头跨域默认不可见，后端已 Access-Control-Expose-Headers 暴露）
  let filename = fallbackFilename || `paper-${paperId}`;
  const cd = response.headers.get('Content-Disposition') || '';
  const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    filename = decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ''));
  } else {
    const plainMatch = cd.match(/filename="?([^";]+)"?/i);
    if (plainMatch && plainMatch[1] && !/^.*\uFFFD+.*$/.test(plainMatch[1])) filename = plainMatch[1];
  }
  const blob = await response.blob();
  return { blob, filename };
}

/**
 * 触发浏览器下载（object URL 方式，兼容中文文件名）
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 整卷导入：直接保存原始文件 + 元数据，不进行 MinerU 解析/拆分
 * POST /api/papers/import-whole (multipart/form-data)
 */
export async function importWholePaper(
  token: string,
  file: File,
  metadata: { title: string; year?: number; region?: string; examType?: string; totalScore?: number; duration?: number }
): Promise<{ success: boolean; paper?: ExamPaper; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', metadata.title);
  if (metadata.year !== undefined) formData.append('year', String(metadata.year));
  if (metadata.region) formData.append('region', metadata.region);
  if (metadata.examType) formData.append('examType', metadata.examType);
  if (metadata.totalScore !== undefined) formData.append('totalScore', String(metadata.totalScore));
  if (metadata.duration !== undefined) formData.append('duration', String(metadata.duration));

  const response = await fetch(`${API_BASE}/papers/import-whole`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data?.error || '导入失败' };
  }
  return data;
}

/** 题型中文标签 */
export function getQuestionTypeLabel(type?: string | null): string {
  switch (type) {
    case 'single_choice': return '单选题';
    case 'multiple_choice': return '多选题';
    case 'choice': return '选择题';
    case 'fill': return '填空题';
    case 'essay': return '解答题';
    case 'unknown': return '未分类';
    default: return '未分类';
  }
}

// ============================================================
// 试卷库（Paper Library）—— 整卷生命周期：分类筛选 / 发布考试 / 回收批改
// ============================================================

export interface PaperLibraryFilters {
  subject?: string;
  year?: string;
  region?: string;
  examType?: string;
  school?: string;
  keyword?: string;
  purpose?: string;
  page?: number;
  limit?: number;
}

export interface PaperLibraryFilterOptions {
  subjects: string[];
  years: string[];
  regions: string[];
  examTypes: string[];
  schools: string[];
}

export interface RecoveryGroup {
  mockExamId: number;
  paper: { id: number; title: string; subject: string | null; year: number | null; region: string | null } | null;
  createdAt: string;
  status: string;
  totalStudents: number;
  uploaded: number;
  graded: number;
  pending: number;
  sheetsByStudent: {
    id: number;
    studentId: number;
    status: string;
    totalScore: number | null;
    fileUrl: string;
    createdAt: string;
  }[];
}

/** GET /api/paper-library — 多维筛选查询（整卷） */
export async function getPaperLibrary(
  token: string,
  filters: PaperLibraryFilters = {}
): Promise<{ data: ExamPaper[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const params = new URLSearchParams();
  if (filters.purpose) params.set('purpose', filters.purpose);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.year) params.set('year', filters.year);
  if (filters.region) params.set('region', filters.region);
  if (filters.examType) params.set('examType', filters.examType);
  if (filters.school) params.set('school', filters.school);
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const response = await fetch(`${API_BASE}/paper-library?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || '试卷库查询失败');
  }
  return response.json();
}

/** GET /api/paper-library/filters — 筛选下拉的可选值 */
export async function getPaperLibraryFilters(token: string): Promise<PaperLibraryFilterOptions> {
  const response = await fetch(`${API_BASE}/paper-library/filters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || '筛选项获取失败');
  }
  return response.json();
}

/** PUT /api/paper-library/:id — 更新整卷元数据（含 subject/school） */
export async function updatePaperLibraryPaper(
  token: string,
  paperId: number,
  data: Partial<ExamPaper>
): Promise<ExamPaper> {
  const response = await fetch(`${API_BASE}/paper-library/${paperId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || '元数据更新失败');
  }
  return response.json();
}

/** POST /api/paper-library/:id/publish — 发布为整卷模拟考试 */
export async function publishPaperAsMockExam(
  token: string,
  paperId: number,
  payload: { startTime?: string; endTime?: string } = {}
): Promise<{ success: boolean; mockExamId: number; error?: string }> {
  const response = await fetch(`${API_BASE}/paper-library/${paperId}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || '发布失败');
  }
  return data;
}

/** DELETE /api/paper-library/:id/unpublish — 取消发布 */
export async function unpublishMockExam(
  token: string,
  paperId: number
): Promise<{ success: boolean; removedMockExamId: number; error?: string }> {
  const response = await fetch(`${API_BASE}/paper-library/${paperId}/unpublish`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || '取消发布失败');
  }
  return data;
}

/** GET /api/paper-library/recovery/all — 回收批改进度（按已发布整卷考试分组） */
export async function getRecoveryList(token: string): Promise<{ groups: RecoveryGroup[] }> {
  const response = await fetch(`${API_BASE}/paper-library/recovery/all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || '回收批改列表获取失败');
  }
  return response.json();
}
