/**
 * Online Exam API — 兼容代理层
 * 内部全部转发到 /api/exam-sessions（统一考试），保留旧函数签名以减少页面改动。
 */

const API_BASE = 'http://localhost:3000/api';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface OnlineExam {
  id: number;
  title: string;
  mode?: string;
  source?: string;
  questionIds: string; // JSON 数组字符串
  paperId?: number | null;
  paper?: { id: number; title: string; pdfUrl?: string | null; purpose?: string; subject?: string | null; school?: string | null } | null;
  totalScore: number;
  duration: number;
  status: string;
  createdAt: string;
  studentScore?: number | null;
  answered?: number;
  studentSubmission?: { id: number; status: string } | null;
}

export interface ExamQuestion {
  id: number;
  questionNumber?: number;
  content: string;
  questionType: 'single_choice' | 'multiple_choice' | 'choice' | 'fill' | 'essay';
  options?: string | null;
  score?: number | null;
}

export interface ExamRecord {
  id: number;
  examSessionId?: number;
  examId?: number;
  studentId: number;
  status: string; // pending | submitted | graded
  answers?: string | null; // JSON
  totalScore?: number | null;
  submittedAt?: string | null;
  createdAt?: string;
}

// 管理员：创建在线测验（mode=online, source=manual）
export async function createExam(token: string, data: { title: string; questionIds: number[]; totalScore: number; duration: number; paperId?: number }): Promise<{ success: boolean; exam?: OnlineExam; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      title: data.title,
      mode: 'online',
      source: 'manual',
      questionIds: data.questionIds,
      totalScore: data.totalScore,
      duration: data.duration,
      paperId: data.paperId,
    }),
  });
  const d = await res.json();
  if (d.examSession) d.exam = d.examSession;
  return d;
}

// 发布
export async function publishExam(token: string, examId: number, data: { startTime?: string | null; endTime?: string | null } = {}): Promise<{ success: boolean; exam?: OnlineExam; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examId}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const d = await res.json();
  if (d.examSession) d.exam = d.examSession;
  return d;
}

// 管理员：列表
export async function getExams(token: string): Promise<OnlineExam[]> {
  const res = await fetch(`${API_BASE}/exam-sessions?limit=100&mode=online`, { headers: authHeaders(token) });
  const d = await res.json();
  return d.data || [];
}

// 详情
export async function getExamById(token: string, examId: number): Promise<OnlineExam> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examId}`, { headers: authHeaders(token) });
  return res.json();
}

// 题目列表
export async function getExamQuestions(token: string, examId: number): Promise<{ data: ExamQuestion[] }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examId}/questions`, { headers: authHeaders(token) });
  return res.json();
}

// 学生：开始
export async function startExam(token: string, examId: number): Promise<{ success?: boolean; session?: OnlineExam; submission?: ExamRecord; record?: ExamRecord; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examId}/start`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

// 学生：保存答案
export async function saveAnswer(token: string, recordId: number, questionId: number, answer: string | string[], timeSpent?: number): Promise<{ success: boolean }> {
  // recordId 在统一模型下即 examSessionId（学生答题通过 /:id/answer）
  const res = await fetch(`${API_BASE}/exam-sessions/${recordId}/answer`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ questionId, answer, timeSpent }),
  });
  return res.json();
}

// 学生：提交
export async function submitExam(token: string, recordId: number): Promise<{ success: boolean; totalScore?: number; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${recordId}/submit`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

// 学生：获取答题记录
export async function getExamRecord(token: string, examId: number): Promise<ExamRecord | { error: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${examId}/record`, { headers: authHeaders(token) });
  return res.json();
}
