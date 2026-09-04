/**
 * AI Grading Service
 * Handles automatic grading for choice, fill-in-the-blank, and essay questions
 */

import { PrismaClient } from '@prisma/client';
import { LLMService } from './llm-service';
import { PromptTemplateService } from './prompt-template-service';

const prisma = new PrismaClient();
const llmService = new LLMService(prisma);
const promptService = new PromptTemplateService();

interface ChoiceGradingResult {
  isCorrect: boolean;
  score: number;
  feedback: string;
}

interface FillGradingResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback: string;
  details: Array<{
    blank: number;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    isEquivalent: boolean;
    points: number;
  }>;
}

interface EssayGradingResult {
  score: number;
  maxScore: number;
  steps: Array<{
    step: string;
    maxPoints: number;
    earnedPoints: number;
    isCorrect: boolean;
    feedback: string;
  }>;
  overallFeedback: string;
  keyPoints: string[];
  mistakes: string[];
}

/**
 * Grade a choice question
 */
export async function gradeChoiceQuestion(
  questionId: number,
  studentAnswer: string
): Promise<ChoiceGradingResult> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  if (question.questionType !== 'choice') {
    throw new Error('Not a choice question');
  }

  // Parse options
  const options = (question.options as unknown as Record<string, string>) || {};
  const correctAnswer = question.answer as string;

  // Check if answer is correct
  const isCorrect = studentAnswer.toUpperCase() === correctAnswer.toUpperCase();
  const score = isCorrect ? (question.score || 0) : 0;

  return {
    isCorrect,
    score,
    feedback: isCorrect 
      ? '正确！' 
      : `错误。正确答案是 ${correctAnswer}。`,
  };
}

/**
 * Grade a fill-in-the-blank question using AI
 */
export async function gradeFillQuestion(
  questionId: number,
  studentAnswers: string[],
  imageUrl?: string
): Promise<FillGradingResult> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  if (question.questionType !== 'fill') {
    throw new Error('Not a fill-in-the-blank question');
  }

  // Get the grading prompt template
  const template = await promptService.getActiveTemplate('fill_grading');
  if (!template) {
    throw new Error('Fill grading template not found');
  }

  // Prepare prompt data
  const correctAnswers = ((question.answer as unknown) as string[] || []).map(a => a.toString());
  
  // Render template
  const prompt = await promptService.renderTemplate(template.template, {
    question: question.content,
    correct_answers: JSON.stringify(correctAnswers),
    student_answers: JSON.stringify(studentAnswers),
    max_score: question.score?.toString() || '0',
  });

  // Call LLM
  const response = await llmService.generate({
    prompt,
    maxTokens: 1000,
  });

  // Parse response
  let result: FillGradingResult;
  try {
    const parsed = JSON.parse(response.content || '{}');
    result = {
      isCorrect: parsed.isCorrect || false,
      score: parsed.score || 0,
      maxScore: question.score || 0,
      feedback: parsed.feedback || '',
      details: parsed.details || [],
    };
  } catch (e) {
    // Fallback to simple comparison
    let correctCount = 0;
    const details = studentAnswers.map((answer, i) => {
      const isCorrect = answer.trim() === correctAnswers[i]?.trim();
      if (isCorrect) correctCount++;
      return {
        blank: i + 1,
        studentAnswer: answer,
        correctAnswer: correctAnswers[i] || '',
        isCorrect,
        isEquivalent: false,
        points: isCorrect ? (question.score || 0) / correctAnswers.length : 0,
      };
    });

    result = {
      isCorrect: correctCount === correctAnswers.length,
      score: (correctCount / correctAnswers.length) * (question.score || 0),
      maxScore: question.score || 0,
      feedback: `答对 ${correctCount}/${correctAnswers.length} 个空`,
      details,
    };
  }

  return result;
}

/**
 * Grade an essay question using AI
 */
export async function gradeEssayQuestion(
  questionId: number,
  studentAnswer: string,
  imageUrl?: string
): Promise<EssayGradingResult> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  if (question.questionType !== 'essay') {
    throw new Error('Not an essay question');
  }

  // Get the grading prompt template
  const template = await promptService.getActiveTemplate('essay_grading');
  if (!template) {
    throw new Error('Essay grading template not found');
  }

  // Render template
  const prompt = await promptService.renderTemplate(template.template, {
    question: question.content,
    standard_answer: question.answer as string || '',
    analysis: question.analysis || '',
    student_answer: studentAnswer,
    max_score: question.score?.toString() || '0',
  });

  // Call LLM
  const response = await llmService.generate({
    prompt,
    maxTokens: 2000,
  });

  // Parse response
  let result: EssayGradingResult;
  try {
    const parsed = JSON.parse(response.content || '{}');
    result = {
      score: parsed.score || 0,
      maxScore: question.score || 0,
      steps: parsed.steps || [],
      overallFeedback: parsed.overallFeedback || '',
      keyPoints: parsed.keyPoints || [],
      mistakes: parsed.mistakes || [],
    };
  } catch (e) {
    // Fallback to basic grading
    result = {
      score: 0,
      maxScore: question.score || 0,
      steps: [],
      overallFeedback: '无法解析AI批改结果',
      keyPoints: [],
      mistakes: [],
    };
  }

  return result;
}

/**
 * Grade an answer record
 */
export async function gradeAnswerRecord(
  recordId: number,
  reviewedBy?: number
): Promise<{ success: boolean; score?: number; feedback?: string }> {
  const record = await prisma.answerRecord.findUnique({
    where: { id: recordId },
    include: { question: true },
  });

  if (!record) {
    throw new Error('Answer record not found');
  }

  let result: any;
  const question = record.question;

  switch (question.questionType) {
    case 'choice':
      result = await gradeChoiceQuestion(question.id, record.answer || '');
      break;
    case 'fill':
      // Parse fill answers (could be JSON array or comma-separated)
      let fillAnswers: string[];
      try {
        fillAnswers = JSON.parse(record.answer || '[]');
      } catch {
        fillAnswers = (record.answer || '').split(',').map(a => a.trim());
      }
      result = await gradeFillQuestion(question.id, fillAnswers, record.imageUrl || undefined);
      break;
    case 'essay':
      result = await gradeEssayQuestion(question.id, record.answer || '', record.imageUrl || undefined);
      break;
    default:
      throw new Error('Unknown question type');
  }

  // Update answer record
  await prisma.answerRecord.update({
    where: { id: recordId },
    data: {
      score: result.score,
      feedback: JSON.stringify(result),
    },
  });

  return {
    success: true,
    score: result.score,
    feedback: typeof result.feedback === 'string' 
      ? result.feedback 
      : JSON.stringify(result.feedback),
  };
}

/**
 * Batch grade all answers for an exam record
 */
export async function batchGradeExamRecord(
  examRecordId: number
): Promise<{ success: boolean; totalScore: number; graded: number }> {
  const records = await prisma.answerRecord.findMany({
    where: { recordId: examRecordId },
  });

  let totalScore = 0;
  let graded = 0;

  for (const record of records) {
    if (record.score === null) {
      try {
        const result = await gradeAnswerRecord(record.id);
        if (result.success && result.score !== undefined) {
          totalScore += result.score;
          graded++;
        }
      } catch (e) {
        console.error(`Failed to grade record ${record.id}:`, e);
      }
    } else {
      totalScore += record.score;
    }
  }

  // Update exam record
  await prisma.examRecord.update({
    where: { id: examRecordId },
    data: {
      totalScore,
      status: 'graded',
    },
  });

  return { success: true, totalScore, graded };
}

/**
 * Manually adjust a grade
 */
export async function adjustGrade(
  recordId: number,
  newScore: number,
  reason: string,
  adjustedBy: number
): Promise<{ success: boolean }> {
  const record = await prisma.answerRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw new Error('Answer record not found');
  }

  const oldScore = record.score || 0;

  // Update score
  await prisma.answerRecord.update({
    where: { id: recordId },
    data: {
      score: newScore,
      feedback: JSON.stringify({
        ...(typeof record.feedback === 'string' ? JSON.parse(record.feedback) : record.feedback),
        adjusted: true,
        oldScore,
        reason,
        adjustedBy,
        adjustedAt: new Date().toISOString(),
      }),
    },
  });

  // Update exam record total score
  if (record.recordId) {
    const examRecord = await prisma.examRecord.findUnique({
      where: { id: record.recordId },
      include: { answers: true },
    });

    if (examRecord) {
      const newTotal = examRecord.answers.reduce(
        (sum, a) => sum + (a.id === recordId ? newScore : a.score || 0),
        0
      );

      await prisma.examRecord.update({
        where: { id: record.recordId },
        data: { totalScore: newTotal },
      });
    }
  }

  return { success: true };
}

/**
 * Get grading statistics
 */
export async function getGradingStats(): Promise<{
  total: number;
  graded: number;
  pending: number;
  avgScore: number;
  byType: Record<string, { total: number; graded: number; avgScore: number }>;
}> {
  const allRecords = await prisma.answerRecord.findMany({
    include: { question: true },
  });

  const total = allRecords.length;
  const graded = allRecords.filter(r => r.score !== null).length;
  const pending = total - graded;
  const avgScore = graded > 0
    ? allRecords.reduce((sum, r) => sum + (r.score || 0), 0) / graded
    : 0;

  const byType: Record<string, { total: number; graded: number; avgScore: number }> = {};
  
  for (const record of allRecords) {
    const type = record.question.questionType;
    if (!byType[type]) {
      byType[type] = { total: 0, graded: 0, avgScore: 0 };
    }
    byType[type].total++;
    if (record.score !== null) {
      byType[type].graded++;
      byType[type].avgScore += record.score;
    }
  }

  for (const type of Object.keys(byType)) {
    if (byType[type].graded > 0) {
      byType[type].avgScore /= byType[type].graded;
    }
  }

  return { total, graded, pending, avgScore, byType };
}