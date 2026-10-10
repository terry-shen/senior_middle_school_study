/**
 * Exam Session API — 统一考试 API 服务
 * mode: whole_paper(整卷) | online(在线逐题)
 * source: library(试卷库) | auto(自动组卷) | manual
 */

const API_BASE = 'http://localhost:3000/api';

export type ExamSessionMode = 'whole_paper' | 'online';
export type ExamSessionSource = 'library' | 'auto' | 'manual';
export type ExamSessionStatus = 'draft' | 'published' | 'ongoing' | 'graded';
export type SubmissionStatus = 'pending' | 'submitted' | 'graded';

export interface ExamSession {
  id: number;
  title: string;
  mode: ExamSessionMode;
  source: ExamSessionSource;
  content: string; // JSON: 在线=题ID数组, 整卷='[]'
  paperId?: number | null;
  paper?: { id: number; title: string; pdfUrl?: string | null; purpose?: string; subject?: string | null; school?: string | null } | null;
  totalScore: number;
  duration: number;
  startTime?: string | null;
  endTime?: string | null;
  status: ExamSessionStatus;
  creatorId: number;
  creator?: { id: number; name: string; studentId: string };
  createdAt: string;
  updatedAt: string;
}

export interface ExamSubmission {
  id: number;
  examSessionId: number;
  studentId: number;
  mode: ExamSessionMode;
  answers?: string | null; // JSON [{questionId, answer, timeSpent?, score?, feedback?, isCorrect?}]
  totalScore?: number | null;
  status: SubmissionStatus;
  submittedAt?: string | null;
  gradedAt?: string | null;
  gradedBy?: number | null;
  student?: { id: number; name: string; studentId: string };
}

export interface CreateExamSessionInput {
  title: string;
  mode: ExamSessionMode;
  source: ExamSessionSource;
  questionIds?: number[];
  paperId?: number;
  totalScore?: number;
  duration?: number;
  startTime?: string | null;
  endTime?: string | null;
  generationParams?: Record<string, unknown>;
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ===== 管理员 =====

export async function createExamSession(token: string, data: CreateExamSessionInput): Promise<{ success: boolean; examSession?: ExamSession; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function previewExamSession(token: string, params: Record<string, unknown>): Promise<{ questions: unknown[]; totalScore: number; questionCount: number }> {
  const res = await fetch(`${API_BASE}/exam-sessions/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function publishExamSession(token: string, id: number, data: { startTime?: string | null; endTime?: string | null } = {}): Promise<{ success: boolean; examSession?: ExamSession; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function unpublishExamSession(token: string, id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/unpublish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function listExamSessions(token: string, filters: { status?: string; mode?: string; page?: number; limit?: number } = {}): Promise<{ data: ExamSession[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  }
  const res = await fetch(`${API_BASE}/exam-sessions?${params.toString()}`, {
    headers: authHeaders(token),
  });
  return res.json();
}

export async function getExamSession(token: string, id: number): Promise<ExamSession> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}`, { headers: authHeaders(token) });
  return res.json();
}

export async function deleteExamSession(token: string, id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return res.json();
}

export async function listExamSubmissions(token: string, examSessionId: number): Promise<ExamSubmission[]> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examSessionId}/submissions`, {
    headers: authHeaders(token),
  });
  return res.json();
}

export async function batchGradeExamSession(token: string, examSessionId: number): Promise<{ success: boolean; graded: number; results?: unknown[] }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examSessionId}/batch-grade`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function adjustSubmissionGrade(token: string, examSessionId: number, studentId: number, newScore: number, feedback?: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examSessionId}/adjust-grade`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ studentId, newScore, feedback }),
  });
  return res.json();
}

export async function gradeAnswerManually(token: string, examSessionId: number, studentId: number, questionId: number, score: number, feedback?: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examSessionId}/grade-answer`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ studentId, questionId, score, feedback }),
  });
  return res.json();
}

export function getGradingStatsUrl() {
  return `${API_BASE}/exam-sessions/grading-stats`;
}

// ===== 学生 =====

export async function listExamSessionsForStudent(token: string): Promise<(ExamSession & { studentSubmission?: ExamSubmission | null; studentScore?: number | null; answered?: number })[]> {
  const res = await fetch(`${API_BASE}/exam-sessions/student/all`, { headers: authHeaders(token) });
  return res.json();
}

export async function startExamSession(token: string, id: number): Promise<{ session: ExamSession; submission?: ExamSubmission; record?: ExamSubmission; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/start`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function getExamSessionQuestions(token: string, id: number): Promise<{ data: unknown[] }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/questions`, { headers: authHeaders(token) });
  return res.json();
}

export async function saveExamSessionAnswer(token: string, id: number, questionId: number, answer: string | string[], timeSpent?: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/answer`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ questionId, answer, timeSpent }),
  });
  return res.json();
}

export async function submitExamSession(token: string, id: number): Promise<{ success: boolean; totalScore?: number; maxScore?: number; submission?: ExamSubmission; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/submit`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function getExamSessionRecord(token: string, id: number): Promise<ExamSubmission | { error: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/record`, { headers: authHeaders(token) });
  return res.json();
}

export async function getExamSessionResult(token: string, id: number): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/result`, { headers: authHeaders(token) });
  return res.json();
}

export async function getExamSessionBenchmark(token: string, id: number): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/benchmark`, { headers: authHeaders(token) });
  return res.json();
}

export async function toggleAnswerMark(token: string, id: number, questionId: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/mark/${questionId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}
