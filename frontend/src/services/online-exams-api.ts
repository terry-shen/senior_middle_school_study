/**
 * Online Exams API Service
 */

const API_BASE = 'http://localhost:3000/api';

export interface OnlineExam {
  id: number;
  title: string;
  questionIds: number[];
  totalScore: number;
  duration: number; // in minutes
  startTime: Date | null;
  endTime: Date | null;
  status: 'draft' | 'published' | 'ongoing' | 'ended';
  createdAt: Date;
}

export interface ExamRecord {
  id: number;
  examId: number;
  studentId: number;
  startTime: Date;
  submitTime: Date | null;
  totalScore: number | null;
  status: 'in_progress' | 'submitted' | 'graded';
  timeSpent: number; // in seconds
}

export interface AnswerRecord {
  id: number;
  recordId: number;
  questionId: number;
  answer: string;
  imageUrl: string | null;
  timeSpent: number;
  score: number | null;
  feedback: string | null;
}

export interface ExamQuestion {
  id: number;
  content: string;
  questionType: 'choice' | 'fill' | 'essay';
  score: number;
  options?: string[];
}

// Admin APIs
export async function createExam(
  exam: {
    title: string;
    questionIds: number[];
    totalScore: number;
    duration: number;
  },
  token: string
): Promise<{ exam?: OnlineExam; error?: string }> {
  const response = await fetch(`${API_BASE}/online-exams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(exam),
  });
  return response.json();
}

export async function publishExam(
  examId: number,
  data: { classIds?: number[]; studentIds?: number[] },
  token: string
): Promise<{ exam?: OnlineExam; error?: string }> {
  const response = await fetch(`${API_BASE}/online-exams/${examId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getExams(token: string): Promise<OnlineExam[]> {
  const response = await fetch(`${API_BASE}/online-exams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getExamById(examId: number, token: string): Promise<OnlineExam | null> {
  const response = await fetch(`${API_BASE}/online-exams/${examId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getExamQuestions(examId: number, token: string): Promise<ExamQuestion[]> {
  const response = await fetch(`${API_BASE}/online-exams/${examId}/questions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

// Student APIs
export async function startExam(examId: number, token: string): Promise<{ record?: ExamRecord; error?: string }> {
  const response = await fetch(`${API_BASE}/online-exams/${examId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function saveAnswer(
  recordId: number,
  questionId: number,
  answer: string,
  token: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/online-exams/records/${recordId}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ questionId, answer }),
  });
  return response.json();
}

export async function uploadImageAnswer(
  recordId: number,
  questionId: number,
  imageFile: File,
  token: string
): Promise<{ success: boolean; imageUrl?: string }> {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('questionId', questionId.toString());

  const response = await fetch(`${API_BASE}/online-exams/records/${recordId}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return response.json();
}

export async function submitExam(recordId: number, token: string): Promise<{ success: boolean; record?: ExamRecord }> {
  const response = await fetch(`${API_BASE}/online-exams/records/${recordId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getExamRecord(examId: number, token: string): Promise<ExamRecord | null> {
  const response = await fetch(`${API_BASE}/online-exams/${examId}/record`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

// Answers for a record are included in the getExamRecord response (record.answers).
// Kept for reference/backward-compat but no longer used by the student flow.
export async function getAnswerRecords(examId: number, token: string): Promise<AnswerRecord[]> {
  const record = await getExamRecord(examId, token);
  return Array.isArray((record as any)?.answers) ? (record as any).answers : [];
}