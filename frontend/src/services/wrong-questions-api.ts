/**
 * Wrong Questions API Service
 * Handles wrong question book operations
 */

const API_BASE = 'http://localhost:3000/api';

export interface WrongQuestion {
  id: number;
  studentId: number;
  questionId: number;
  originalAnswer: string;
  correctAnswer: string;
  wrongCount: number;
  reviewStatus: 'not_reviewed' | 'reviewing' | 'mastered';
  lastWrongAt: string;
  lastReviewAt?: string;
  notes?: string;
  tags?: string;
  question?: {
    id: number;
    content: string;
    questionType: string;
    difficulty: string;
    score: number;
    options?: string;
    answer?: string;
  };
}

export interface WrongQuestionStats {
  total: number;
  notReviewed: number;
  reviewing: number;
  mastered: number;
  byDifficulty: { difficulty: string; count: number }[];
  byType: { type: string; count: number }[];
}

export interface PracticeRecord {
  id: number;
  wrongQuestionId: number;
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
  practiceAt: string;
}

export interface VariationQuestion {
  id: number;
  originalId: number;
  content: string;
  questionType: string;
  options?: string;
  answer: string;
  difficulty: string;
  generatedBy: 'ai' | 'manual';
}

/**
 * Get wrong questions with filters
 */
export async function getWrongQuestions(
  token: string,
  params?: {
    reviewStatus?: string;
    questionType?: string;
    difficulty?: string;
    knowledgePoint?: string;
  }
): Promise<WrongQuestion[]> {
  const query = new URLSearchParams();
  if (params?.reviewStatus) query.append('reviewStatus', params.reviewStatus);
  if (params?.questionType) query.append('questionType', params.questionType);
  if (params?.difficulty) query.append('difficulty', params.difficulty);
  if (params?.knowledgePoint) query.append('knowledgePoint', params.knowledgePoint);

  const response = await fetch(`${API_BASE}/wrong-questions?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Get wrong question statistics
 */
export async function getWrongQuestionStats(token: string): Promise<WrongQuestionStats> {
  const response = await fetch(`${API_BASE}/wrong-questions/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Get practice history
 */
export async function getPracticeHistory(token: string): Promise<PracticeRecord[]> {
  const response = await fetch(`${API_BASE}/wrong-questions/practice-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Record a practice attempt
 */
export async function recordPractice(
  token: string,
  wrongQuestionId: number,
  userAnswer: string
): Promise<{ success: boolean; isCorrect: boolean }> {
  const response = await fetch(`${API_BASE}/wrong-questions/practice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ wrongQuestionId, userAnswer }),
  });
  return response.json();
}

/**
 * Update review status
 */
export async function updateReviewStatus(
  token: string,
  id: number,
  reviewStatus: string,
  notes?: string
): Promise<WrongQuestion> {
  const response = await fetch(`${API_BASE}/wrong-questions/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reviewStatus, notes }),
  });
  return response.json();
}

/**
 * Get variation questions
 */
export async function getVariations(token: string, wrongQuestionId: number): Promise<VariationQuestion[]> {
  const response = await fetch(`${API_BASE}/wrong-questions/${wrongQuestionId}/variations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Generate variation question
 */
export async function generateVariation(token: string, wrongQuestionId: number): Promise<VariationQuestion> {
  const response = await fetch(`${API_BASE}/wrong-questions/${wrongQuestionId}/variations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}
