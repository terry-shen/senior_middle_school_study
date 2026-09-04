const API_BASE = 'http://localhost:3000/api';

export interface MockExam {
  id: number;
  title: string;
  standard: string;
  questionIds: string;
  totalScore: number;
  duration: number;
  difficultyRatio: string;
  knowledgePointWeights: string;
  status: string;
  creatorId: number;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: { id: number; name: string; studentId: string };
  studentScore?: number;
  answered?: number;
}

export interface MockExamAnswer {
  id: number;
  mockExamId: number;
  studentId: number;
  questionId: number;
  answer: string | null;
  imageUrl: string | null;
  isMarked: boolean;
  timeSpent: number | null;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  isCorrect: boolean | null;
  gradedAt: string | null;
  gradedBy: string | null;
  question?: {
    id: number;
    content: string;
    questionType: string;
    score: number | null;
    difficulty: string | null;
    options: string | null;
    answer: string | null;
    analysis: string | null;
  };
}

export interface MockExamResult {
  exam: MockExam;
  totalScore: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  markedCount: number;
  totalTimeSpent: number;
  answers: MockExamAnswer[];
  byQuestionType: Record<string, { total: number; correct: number; score: number; maxScore: number }>;
}

export interface BenchmarkAnalysis {
  studentScore: number;
  maxScore: number;
  fullMarks: number;
  classAverage: number;
  classMax: number;
  classMin: number;
  rank: number;
  totalStudents: number;
  percentile: number;
}

export interface WrongQuestionAnalysis {
  totalWrong: number;
  byQuestionType: { questionType: string; wrongCount: number; questions: number[] }[];
  wrongAnswers: MockExamAnswer[];
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// Admin: Create mock exam
export async function createMockExam(token: string, data: {
  title: string;
  standard?: string;
  totalScore?: number;
  duration?: number;
  difficultyRatio?: Record<string, number>;
  knowledgePointWeights?: Record<string, number>;
}) {
  const res = await fetch(`${API_BASE}/mock-exams`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

// List all mock exams
export async function getMockExams(token: string, status?: string) {
  const url = status ? `${API_BASE}/mock-exams?status=${status}` : `${API_BASE}/mock-exams`;
  const res = await fetch(url, { headers: authHeaders(token) });
  return res.json();
}

// Get mock exam by ID
export async function getMockExam(token: string, id: number) {
  const res = await fetch(`${API_BASE}/mock-exams/${id}`, { headers: authHeaders(token) });
  return res.json();
}

// Admin: Publish mock exam
export async function publishMockExam(token: string, id: number) {
  const res = await fetch(`${API_BASE}/mock-exams/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.json();
}

// Admin: Delete mock exam
export async function deleteMockExam(token: string, id: number) {
  const res = await fetch(`${API_BASE}/mock-exams/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return res.json();
}

// Student: Start mock exam
export async function startMockExam(token: string, id: number) {
  const res = await fetch(`${API_BASE}/mock-exams/${id}/start`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return res.json();
}

// Student: Save answer
export async function saveMockAnswer(token: string, examId: number, data: {
  questionId: number;
  answer?: string;
  imageUrl?: string;
  timeSpent?: number;
}) {
  const res = await fetch(`${API_BASE}/mock-exams/${examId}/answer`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

// Student: Toggle mark for review
export async function toggleMark(token: string, examId: number, questionId: number) {
  const res = await fetch(`${API_BASE}/mock-exams/${examId}/mark/${questionId}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return res.json();
}

// Student: Submit mock exam
export async function submitMockExam(token: string, id: number) {
  const res = await fetch(`${API_BASE}/mock-exams/${id}/submit`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return res.json();
}

// Student: Get exam result
export async function getMockExamResult(token: string, id: number): Promise<MockExamResult> {
  const res = await fetch(`${API_BASE}/mock-exams/${id}/result`, { headers: authHeaders(token) });
  return res.json();
}

// Student: Get benchmark analysis
export async function getBenchmarkAnalysis(token: string, id: number): Promise<BenchmarkAnalysis> {
  const res = await fetch(`${API_BASE}/mock-exams/${id}/benchmark`, { headers: authHeaders(token) });
  return res.json();
}

// Student: Get wrong question analysis
export async function getWrongQuestionAnalysis(token: string, id: number): Promise<WrongQuestionAnalysis> {
  const res = await fetch(`${API_BASE}/mock-exams/${id}/wrong-analysis`, { headers: authHeaders(token) });
  return res.json();
}

// Student: Get mock exam history
export async function getMockExamHistory(token: string): Promise<MockExam[]> {
  const res = await fetch(`${API_BASE}/mock-exams/history/all`, { headers: authHeaders(token) });
  return res.json();
}
