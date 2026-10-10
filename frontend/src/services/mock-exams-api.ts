/**
 * Mock Exam API — 兼容代理层
 * 内部全部转发到 /api/exam-sessions（统一考试），保留旧函数签名以减少页面改动。
 */

const API_BASE = 'http://localhost:3000/api';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface MockExam {
  id: number;
  title: string;
  standard?: string;
  mode?: string; // whole_paper | online
  source?: string;
  questionIds: string; // JSON 数组字符串
  paperId?: number | null;
  paper?: { id: number; title: string; pdfUrl?: string | null; purpose?: string; subject?: string | null; school?: string | null } | null;
  totalScore: number;
  duration: number;
  startTime?: string | null;
  endTime?: string | null;
  status: string; // draft | published | ongoing | graded
  creatorId?: number;
  creator?: { id: number; name: string; studentId: string };
  createdAt: string;
  // 学生视角扩展字段
  studentScore?: number | null;
  answered?: number;
  studentSubmission?: { id: number; status: string } | null;
}

export interface MockExamAnswer {
  id: number;
  questionId: number;
  answer?: string | null;
  isCorrect?: boolean | null;
  score?: number | null;
  feedback?: string | null;
  question?: { id: number; content: string; questionType: string; answer?: string | null; options?: string | null };
}

// 管理员：列表
export async function getMockExams(token: string, status?: string): Promise<MockExam[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('limit', '100');
  const res = await fetch(`${API_BASE}/exam-sessions?${params.toString()}`, { headers: authHeaders(token) });
  const d = await res.json();
  return d.data || [];
}

// 学生：历史（全部可见考试 + 作答状态）
export async function getMockExamHistory(token: string): Promise<MockExam[]> {
  const res = await fetch(`${API_BASE}/exam-sessions/student/all`, { headers: authHeaders(token) });
  return res.json();
}

// 管理员：创建（在线模式，从题库选题）
export async function createMockExam(
  token: string,
  data: { title: string; standard?: string; questionIds?: number[]; totalScore: number; duration: number }
): Promise<{ success: boolean; mockExam?: MockExam; examSession?: MockExam; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      title: data.title,
      mode: 'online',
      source: 'manual',
      questionIds: data.questionIds || [],
      totalScore: data.totalScore,
      duration: data.duration,
    }),
  });
  const d = await res.json();
  if (d.examSession) d.mockExam = d.examSession;
  return d;
}

export interface MockExamResult {
  session?: MockExam;
  mode?: 'whole_paper' | 'online';
  score?: number | null;
  exam: { title?: string } & Partial<MockExam>;
  totalScore: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  totalTimeSpent: number;
  markedCount: number;
  answers?: Record<string, unknown>[];
  answerSheets?: Record<string, unknown>[];
  questions?: Record<string, unknown>[];
}

export interface BenchmarkAnalysis {
  studentScore?: number;
  maxScore?: number;
  rank?: number;
  totalStudents?: number;
  percentile?: number;
  classAverage?: number;
  classMax?: number;
  classMin?: number;
}

// 发布
export async function publishMockExam(token: string, id: number, data: { startTime?: string | null; endTime?: string | null } = {}): Promise<{ success: boolean; mockExam?: MockExam; examSession?: MockExam; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const d = await res.json();
  if (d.examSession) d.mockExam = d.examSession;
  return d;
}

// 删除
export async function deleteMockExam(token: string, id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return res.json();
}

// 学生：开始考试
export async function startMockExam(token: string, id: number): Promise<{ success?: boolean; mockExam?: MockExam; exam?: MockExam; session?: MockExam; submission?: { id: number; status: string }; record?: { id: number; status: string }; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/start`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

// 学生：保存答案
export async function saveMockAnswer(token: string, id: number, questionId: number, answer: string | string[]): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/answer`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ questionId, answer }),
  });
  return res.json();
}

// 学生：标记
export async function toggleMark(token: string, id: number, questionId: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/mark/${questionId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

// 学生：提交
export async function submitMockExam(token: string, id: number): Promise<{ success: boolean; totalScore?: number; maxScore?: number; error?: string }> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/submit`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

// 结果（映射为页面 ResultView 需要的形状）
export async function getMockExamResult(token: string, id: number): Promise<MockExamResult> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/result`, { headers: authHeaders(token) });
  const d = await res.json();
  const answers: Record<string, unknown>[] = Array.isArray(d.answers) ? d.answers : [];
  const correctCount = answers.filter((a: any) => a?.isCorrect === true).length;
  return {
    ...d,
    exam: d.exam || d.session,
    totalScore: d.totalScore ?? d.score ?? 0,
    maxScore: d.maxScore ?? d.session?.totalScore ?? 0,
    correctCount,
    totalQuestions: d.totalQuestions ?? answers.length,
    totalTimeSpent: d.totalTimeSpent ?? 0,
    markedCount: d.markedCount ?? answers.filter((a: any) => a?.marked === true).length,
  };
}

// 对标分析（映射 BenchmarkView 字段）
export async function getBenchmarkAnalysis(token: string, id: number): Promise<BenchmarkAnalysis> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}/benchmark`, { headers: authHeaders(token) });
  const d = await res.json();
  return {
    ...d,
    studentScore: d.studentScore ?? d.score ?? 0,
    maxScore: d.maxScore ?? 0,
    rank: d.rank ?? 0,
    totalStudents: d.totalStudents ?? 0,
    percentile: d.percentile ?? 0,
    classAverage: d.classAverage ?? d.avgScore ?? 0,
    classMax: d.classMax ?? d.maxScore ?? 0,
    classMin: d.classMin ?? d.minScore ?? 0,
  };
}

// 详情
export async function getMockExam(token: string, id: number): Promise<MockExam> {
  const res = await fetch(`${API_BASE}/exam-sessions/${id}`, { headers: authHeaders(token) });
  return res.json();
}
