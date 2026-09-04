/**
 * Wrong Questions Service
 * Handles wrong question collection, classification, and practice
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Auto-collect wrong question when graded
 */
export async function collectWrongQuestion(
  studentId: number,
  questionId: number,
  originalAnswer: string,
  correctAnswer: string
) {
  // Check if already exists
  const existing = await prisma.wrongQuestion.findUnique({
    where: {
      studentId_questionId: {
        studentId,
        questionId,
      },
    },
  });

  if (existing) {
    // Update wrong count and last wrong time
    return prisma.wrongQuestion.update({
      where: { id: existing.id },
      data: {
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: new Date(),
        originalAnswer,
        reviewStatus: existing.reviewStatus === 'mastered' ? 'reviewing' : existing.reviewStatus,
      },
    });
  }

  // Create new wrong question record
  return prisma.wrongQuestion.create({
    data: {
      studentId,
      questionId,
      originalAnswer,
      correctAnswer,
      wrongCount: 1,
      reviewStatus: 'not_reviewed',
    },
  });
}

/**
 * Get wrong questions with filters
 */
export async function getWrongQuestions(
  studentId: number,
  filters?: {
    reviewStatus?: string;
    knowledgePoint?: string;
    questionType?: string;
    difficulty?: string;
  }
) {
  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: {
      studentId,
      ...(filters?.reviewStatus && { reviewStatus: filters.reviewStatus }),
    },
    include: {
      question: true,
    },
    orderBy: {
      lastWrongAt: 'desc',
    },
  });

  // Apply additional filters in memory
  let result = wrongQuestions;

  if (filters?.questionType) {
    result = result.filter(wq => wq.question.questionType === filters.questionType);
  }

  if (filters?.difficulty) {
    result = result.filter(wq => wq.question.difficulty === filters.difficulty);
  }

  return result;
}

/**
 * Record a re-practice
 */
export async function recordPractice(
  wrongQuestionId: number,
  studentId: number,
  questionId: number,
  userAnswer: string,
  isCorrect: boolean
) {
  // Create practice record
  const practice = await prisma.wrongQuestionPractice.create({
    data: {
      wrongQuestionId,
      studentId,
      questionId,
      userAnswer,
      isCorrect,
    },
  });

  // Update wrong question if correct
  if (isCorrect) {
    await prisma.wrongQuestion.update({
      where: { id: wrongQuestionId },
      data: {
        reviewStatus: 'mastered',
        lastReviewAt: new Date(),
      },
    });
  }

  return practice;
}

/**
 * Generate variation question using LLM
 */
export async function generateVariationQuestion(originalId: number) {
  // This would call LLM service to generate a similar question
  // For now, return a placeholder
  const variation = await prisma.variationQuestion.create({
    data: {
      originalId,
      content: 'Generated variation question content',
      questionType: 'fill',
      answer: 'Generated answer',
      difficulty: 'medium',
      generatedBy: 'ai',
    },
  });

  return variation;
}

/**
 * Get variation questions for a question
 */
export async function getVariationQuestions(questionId: number) {
  return prisma.variationQuestion.findMany({
    where: { originalId: questionId },
  });
}

/**
 * Update review status
 */
export async function updateReviewStatus(
  wrongQuestionId: number,
  status: string,
  notes?: string
) {
  return prisma.wrongQuestion.update({
    where: { id: wrongQuestionId },
    data: {
      reviewStatus: status,
      lastReviewAt: new Date(),
      ...(notes && { notes }),
    },
  });
}

/**
 * Get wrong question statistics
 */
export async function getWrongQuestionStats(studentId: number) {
  const total = await prisma.wrongQuestion.count({
    where: { studentId },
  });

  const byStatus = await prisma.wrongQuestion.groupBy({
    by: ['reviewStatus'],
    where: { studentId },
    _count: true,
  });

  const byDifficulty = await prisma.wrongQuestion.findMany({
    where: { studentId },
    include: {
      question: {
        select: {
          difficulty: true,
        },
      },
    },
  });

  const difficultyStats = byDifficulty.reduce((acc, wq) => {
    const diff = wq.question.difficulty || 'unknown';
    acc[diff] = (acc[diff] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total,
    byStatus: byStatus.reduce((acc, s) => {
      acc[s.reviewStatus] = s._count;
      return acc;
    }, {} as Record<string, number>),
    byDifficulty: difficultyStats,
  };
}

/**
 * Get practice history
 */
export async function getPracticeHistory(
  studentId: number,
  limit: number = 50
) {
  return prisma.wrongQuestionPractice.findMany({
    where: { studentId },
    include: {
      wrongQuestion: {
        include: {
          question: true,
        },
      },
    },
    orderBy: {
      practiceAt: 'desc',
    },
    take: limit,
  });
}