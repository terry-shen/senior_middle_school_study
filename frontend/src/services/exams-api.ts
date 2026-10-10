/**
 * Exam Generation API Service
 * (Compat layer: POST /api/exams/* proxies to ExamSession backend)
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
  difficultyDistribution?: {
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

export interface ExamPreview {
  questions: GeneratedQuestion[];
  totalScore: number;
  duration: number;
}

/**
 * Generate exam from question bank (creates ExamSession source=auto, response includes mockExamId)
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
 * Preview exam questions without persisting
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
