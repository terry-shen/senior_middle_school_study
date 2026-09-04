/**
 * Data Quality Validation Service
 * Checks question data quality and returns validation results
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ValidationResult {
  questionId: number;
  issues: string[];
  score: number; // 0-100
}

export interface ValidationReport {
  totalQuestions: number;
  validQuestions: number;
  issuesFound: number;
  results: ValidationResult[];
}

/**
 * Validate a single question
 */
export function validateQuestion(question: any): ValidationResult {
  const issues: string[] = [];
  
  // Check required fields
  if (!question.content || question.content.trim() === '') {
    issues.push('题目内容为空');
  }
  
  if (!question.questionType) {
    issues.push('缺少题型');
  }
  
  if (!question.score || question.score <= 0) {
    issues.push('缺少分数或分数无效');
  }
  
  // Check question type specific requirements
  if (question.questionType === 'choice') {
    if (!question.options || question.options.trim() === '') {
      issues.push('选择题缺少选项');
    }
    if (!question.answer || question.answer.trim() === '') {
      issues.push('选择题缺少答案');
    }
  }
  
  if (question.questionType === 'fill' && (!question.answer || question.answer.trim() === '')) {
    issues.push('填空题缺少答案');
  }
  
  if (question.questionType === 'essay') {
    if (!question.answer || question.answer.trim() === '') {
      issues.push('解答题缺少参考答案');
    }
    if (!question.analysis || question.analysis.trim() === '') {
      issues.push('解答题缺少解析');
    }
  }
  
  // Check difficulty
  if (!question.difficulty) {
    issues.push('缺少难度标识');
  }
  
  // Calculate quality score
  const score = Math.max(0, 100 - issues.length * 15);
  
  return {
    questionId: question.id,
    issues,
    score
  };
}

/**
 * Validate all questions
 */
export async function validateAllQuestions(): Promise<ValidationReport> {
  const questions = await prisma.question.findMany({
    include: { paper: true }
  });
  
  const results = questions.map(validateQuestion);
  const validQuestions = results.filter(r => r.issues.length === 0).length;
  const issuesFound = results.reduce((sum, r) => sum + r.issues.length, 0);
  
  return {
    totalQuestions: questions.length,
    validQuestions,
    issuesFound,
    results
  };
}

/**
 * Validate questions for a specific paper
 */
export async function validatePaperQuestions(paperId: number): Promise<ValidationReport> {
  const questions = await prisma.question.findMany({
    where: { paperId },
    include: { paper: true }
  });
  
  const results = questions.map(validateQuestion);
  const validQuestions = results.filter(r => r.issues.length === 0).length;
  const issuesFound = results.reduce((sum, r) => sum + r.issues.length, 0);
  
  return {
    totalQuestions: questions.length,
    validQuestions,
    issuesFound,
    results
  };
}

/**
 * Get quality statistics
 */
export async function getQualityStats(): Promise<{
  total: number;
  byType: Record<string, { total: number; avgScore: number }>;
  byDifficulty: Record<string, { total: number; avgScore: number }>;
}> {
  const questions = await prisma.question.findMany();
  
  const results = questions.map(validateQuestion);
  
  const byType: Record<string, { total: number; scores: number[] }> = {};
  const byDifficulty: Record<string, { total: number; scores: number[] }> = {};
  
  questions.forEach((q, i) => {
    const type = q.questionType || 'unknown';
    const difficulty = q.difficulty || 'unknown';
    
    if (!byType[type]) byType[type] = { total: 0, scores: [] };
    byType[type].total++;
    byType[type].scores.push(results[i].score);
    
    if (!byDifficulty[difficulty]) byDifficulty[difficulty] = { total: 0, scores: [] };
    byDifficulty[difficulty].total++;
    byDifficulty[difficulty].scores.push(results[i].score);
  });
  
  return {
    total: questions.length,
    byType: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [
        k,
        { total: v.total, avgScore: v.scores.reduce((a, b) => a + b, 0) / v.scores.length }
      ])
    ),
    byDifficulty: Object.fromEntries(
      Object.entries(byDifficulty).map(([k, v]) => [
        k,
        { total: v.total, avgScore: v.scores.reduce((a, b) => a + b, 0) / v.scores.length }
      ])
    )
  };
}