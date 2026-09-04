/**
 * Grading API Service
 * Handles AI grading API calls
 */

const API_BASE = 'http://localhost:3000/api';

export interface GradingResult {
  recordId: number;
  questionId: number;
  score: number;
  maxScore: number;
  feedback?: string;
  isCorrect?: boolean;
  steps?: Array<{
    description: string;
    score: number;
    isCorrect: boolean;
  }>;
}

export interface GradingStats {
  totalRecords: number;
  gradedRecords: number;
  pendingRecords: number;
  averageScore: number;
  byQuestionType: {
    type: string;
    total: number;
    correct: number;
    averageScore: number;
  }[];
}

/**
 * Grade a single answer record
 */
export async function gradeAnswerRecord(
  recordId: number,
  token: string
): Promise<GradingResult> {
  const response = await fetch(`${API_BASE}/grading/grade/${recordId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

/**
 * Batch grade all answers in an exam record
 */
export async function batchGradeExamRecord(
  examRecordId: number,
  token: string
): Promise<{ success: boolean; results: GradingResult[] }> {
  const response = await fetch(
    `${API_BASE}/grading/batch/${examRecordId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
}

/**
 * Adjust a grade manually
 */
export async function adjustGrade(
  recordId: number,
  score: number,
  feedback: string,
  token: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/grading/adjust/${recordId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ score, feedback }),
  });
  return response.json();
}

/**
 * Get grading statistics
 */
export async function getGradingStats(token: string): Promise<GradingStats> {
  const response = await fetch(`${API_BASE}/grading/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}