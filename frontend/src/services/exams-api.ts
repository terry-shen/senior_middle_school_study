/**
 * Exam Generation API Service
 */

const API_BASE = 'http://localhost:3000/api';

export interface ExamGenerationParams {
  name?: string;
  /** 指定从某一导入试卷出卷；缺省/0 表示从全部题目中抽取自由组卷 */
  paperId?: number;
  typeDistribution: {
    single_choice?: number;
    multiple_choice?: number;
    fill: number;
    essay: number;
    [key: string]: number | undefined;
  };
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
    very_hard: number;
  };
  scoreDistribution?: {
    single_choice?: number;
    multiple_choice?: number;
    fill: number;
    essay: number;
    [key: string]: number | undefined;
  };
  totalScore: number;
  duration?: number;
}

export interface GeneratedQuestion {
  id: number;
  questionNumber: number;
  questionType: string;
  content: string;
  score: number;
  difficulty: string;
  options?: string;
  imageUrl?: string;
}

export interface GeneratedExam {
  id: number;
  title: string;
  name?: string;
  totalScore: number;
  duration: number;
  questions: GeneratedQuestion[];
  createdAt: string;
}

export interface ExamTemplate {
  id: number;
  name: string;
  description?: string;
  totalScore: number;
  duration?: number;
  questionCount?: number;
  typeDistribution: string;      // JSON string
  difficultyDistribution: string; // JSON string
  scoreDistribution: string;      // JSON string
  isDefault?: boolean;
  createdAt: string;
}

export interface ExamPreview {
  questions: GeneratedQuestion[];
  totalScore: number;
  duration: number;
}

/**
 * Generate exam with parameters
 */
export async function generateExam(token: string, params: ExamGenerationParams): Promise<GeneratedExam> {
  const response = await fetch(`${API_BASE}/exams/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to generate exam');
  }
  return response.json();
}

/**
 * Preview exam questions
 */
export async function previewExam(token: string, params: ExamGenerationParams): Promise<ExamPreview> {
  const response = await fetch(`${API_BASE}/exams/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to preview exam');
  }
  return response.json();
}

/**
 * Get all generated exams
 */
export async function getExams(token: string): Promise<GeneratedExam[]> {
  const response = await fetch(`${API_BASE}/exams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch exams');
  const data = await response.json();
  // Backend returns { data: [...], total: N } for paginated results
  return Array.isArray(data) ? data : (data.data || []);
}

/**
 * Get exam by ID
 */
export async function getExam(token: string, id: number): Promise<GeneratedExam> {
  const response = await fetch(`${API_BASE}/exams/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch exam');
  return response.json();
}

/**
 * Replace a question in exam
 */
export async function replaceQuestion(
  token: string,
  examId: number,
  questionId: number,
  reason?: string
): Promise<GeneratedQuestion> {
  const response = await fetch(`${API_BASE}/exams/${examId}/replace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ questionId, reason }),
  });
  if (!response.ok) throw new Error('Failed to replace question');
  return response.json();
}

/**
 * Get exam templates
 */
export async function getTemplates(token: string): Promise<ExamTemplate[]> {
  const response = await fetch(`${API_BASE}/exams/templates/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch templates');
  const data = await response.json();
  return Array.isArray(data) ? data : (data.data || []);
}

/**
 * Save exam as template
 */
export async function saveAsTemplate(
  token: string,
  name: string,
  description: string,
  config: ExamGenerationParams
): Promise<ExamTemplate> {
  const response = await fetch(`${API_BASE}/exams/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, description, config }),
  });
  if (!response.ok) throw new Error('Failed to save template');
  return response.json();
}
