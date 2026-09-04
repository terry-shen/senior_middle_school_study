/**
 * Difficulty API Service
 * Handles difficulty assessment and adjustment API calls
 */

const API_BASE = 'http://localhost:3000/api';

export interface DifficultyStats {
  easy: number;
  medium: number;
  hard: number;
  very_hard: number;
  total: number;
}

export interface DifficultyAdjustment {
  id: number;
  questionId: number;
  oldDifficulty: string | null;
  newDifficulty: string;
  reason: string | null;
  adjustedBy: number | null;
  createdAt: string;
}

export interface DifficultyResult {
  id: number;
  difficulty: string;
  reasoning?: string;
  error?: string;
}

export interface BatchAssessResult {
  success: number;
  failed: number;
  results: DifficultyResult[];
}

/**
 * Assess difficulty for a single question
 */
export async function assessDifficulty(
  questionId: number,
  token: string
): Promise<{ difficulty: string; reasoning: string }> {
  const response = await fetch(`${API_BASE}/difficulty/assess/${questionId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

/**
 * Batch assess difficulty for multiple questions
 */
export async function batchAssessDifficulty(
  questionIds: number[],
  token: string
): Promise<BatchAssessResult> {
  const response = await fetch(`${API_BASE}/difficulty/batch-assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ questionIds }),
  });
  return response.json();
}

/**
 * Manually adjust question difficulty
 */
export async function adjustDifficulty(
  questionId: number,
  newDifficulty: string,
  reason: string,
  token: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/difficulty/adjust/${questionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newDifficulty, reason }),
  });
  return response.json();
}

/**
 * Get difficulty adjustment history for a question
 */
export async function getAdjustmentHistory(
  questionId: number,
  token: string
): Promise<DifficultyAdjustment[]> {
  const response = await fetch(`${API_BASE}/difficulty/adjustments/${questionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

/**
 * Get difficulty statistics
 */
export async function getDifficultyStats(token: string): Promise<DifficultyStats> {
  const response = await fetch(`${API_BASE}/difficulty/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

/**
 * Get difficulty distribution by knowledge point
 */
export async function getDifficultyByKnowledgePoint(
  token: string
): Promise<Record<string, DifficultyStats>> {
  const response = await fetch(`${API_BASE}/difficulty/by-knowledge-point`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}