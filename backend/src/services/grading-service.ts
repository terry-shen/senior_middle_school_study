/**
 * Grading Service
 *
 * 基于 ExamSubmission.answers JSON 的判分服务：
 * - 选择题（single_choice/multiple_choice/choice）：自动判分
 * - 填空题（fill）：等价识别（归一化比较）
 * - 解答题（essay）：等待人工批改
 * - 整卷模式（whole_paper）：不产生 ExamSubmission，走 AnswerSheet 人工批改
 */

import { PrismaClient } from '@prisma/client';
import * as ExamSessionService from './exam-session-service';

const prisma = new PrismaClient();

const CHOICE_TYPES = new Set(['single_choice', 'multiple_choice', 'choice']);

function normalizeText(s: string): string {
  return (s || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[，,、]/g, ',')
    .replace(/[。.．]$/, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .toLowerCase();
}

function parseAnswerArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const t = raw.trim();
  // JSON 数组
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* fallthrough */ }
  }
  // 逗号分隔
  return t.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
}

function gradeChoice(question: any, userAnswer: string): { isCorrect: boolean; score: number } {
  const correct = parseAnswerArray(question.answer);
  const given = parseAnswerArray(userAnswer);
  if (correct.length === 0 || given.length === 0) {
    return { isCorrect: false, score: 0 };
  }
  const a = [...correct].sort().join(',');
  const b = [...given].sort().join(',');
  const isCorrect = a === b;
  return { isCorrect, score: isCorrect ? (question.score || 5) : 0 };
}

function gradeFill(question: any, userAnswer: string): { isCorrect: boolean; score: number } {
  const correct = normalizeText(question.answer);
  const given = normalizeText(userAnswer);
  if (!correct || !given) return { isCorrect: false, score: 0 };
  // 支持多个可接受答案（正确答案用 | 分隔）
  const acceptable = correct.split('|').map((x) => normalizeText(x));
  const isCorrect = acceptable.includes(given);
  return { isCorrect, score: isCorrect ? (question.score || 5) : 0 };
}

/**
 * 判分单个提交（选择题/填空题自动，解答题等待人工）
 */
export async function gradeSubmission(submissionId: number) {
  const submission = await prisma.examSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) throw new Error('未找到答题记录');

  const answers: any[] = submission.answers ? JSON.parse(submission.answers) : [];
  if (answers.length === 0) {
    return prisma.examSubmission.update({
      where: { id: submissionId },
      data: { status: 'submitted', submittedAt: submission.submittedAt || new Date() },
    });
  }

  const questionIds = answers.map((a) => a.questionId);
  const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
  const qMap = new Map(questions.map((q) => [q.id, q]));

  let totalScore = 0;
  let allAutoGradable = true;
  const gradedAnswers = answers.map((a) => {
    const q = qMap.get(a.questionId);
    if (!q) return { ...a, isCorrect: false, score: 0, feedback: '题目不存在' };

    if (CHOICE_TYPES.has(q.questionType)) {
      const { isCorrect, score } = gradeChoice(q, a.answer || '');
      totalScore += score;
      return { ...a, isCorrect, score, feedback: isCorrect ? '正确' : '错误' };
    }
    if (q.questionType === 'fill') {
      const { isCorrect, score } = gradeFill(q, a.answer || '');
      totalScore += score;
      return { ...a, isCorrect, score, feedback: isCorrect ? '正确' : '错误' };
    }
    // 解答题：等待人工
    allAutoGradable = false;
    return {
      ...a,
      isCorrect: undefined,
      score: a.score ?? null,
      feedback: a.feedback ?? '等待人工批改',
    };
  });

  return prisma.examSubmission.update({
    where: { id: submissionId },
    data: {
      answers: JSON.stringify(gradedAnswers),
      totalScore,
      status: allAutoGradable ? 'graded' : 'submitted',
      submittedAt: submission.submittedAt || new Date(),
      gradedAt: allAutoGradable ? new Date() : null,
    },
  });
}

/**
 * 批量判分某考试会话的所有提交
 */
export async function batchGradeExamSession(examSessionId: number) {
  const submissions = await prisma.examSubmission.findMany({
    where: { examSessionId, status: { in: ['pending', 'submitted'] } },
  });
  const results = [];
  for (const s of submissions) {
    results.push(await gradeSubmission(s.id));
  }
  return { results, count: results.length };
}

/**
 * 兼容旧接口：按提交 ID 批改
 */
export async function batchGradeBySubmissionId(submissionId: number) {
  const result = await gradeSubmission(submissionId);
  return { results: [result], count: 1 };
}

/**
 * 手动调整分数
 */
export async function adjustGrade(
  examSessionId: number,
  studentId: number,
  newScore: number,
  feedback?: string
) {
  return ExamSessionService.adjustGrade(examSessionId, studentId, newScore, feedback);
}

/**
 * 批改统计
 */
export async function getGradingStats(filters: { examSessionId?: number } = {}) {
  return ExamSessionService.getGradingStats(filters);
}

/**
 * 老师人工批改解答题（更新单个答案的分数/反馈）
 */
export async function gradeAnswerManually(
  examSessionId: number,
  studentId: number,
  questionId: number,
  score: number,
  feedback?: string
) {
  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });
  if (!submission) throw new Error('未找到答题记录');

  const answers: any[] = submission.answers ? JSON.parse(submission.answers) : [];
  const idx = answers.findIndex((a) => a.questionId === questionId);
  if (idx < 0) throw new Error('未找到该题的作答');

  // 重算总分：保留其他题分数，替换本题分数
  let otherTotal = 0;
  for (const a of answers) {
    if (a.questionId !== questionId && typeof a.score === 'number') otherTotal += a.score;
  }
  answers[idx] = { ...answers[idx], score, feedback: feedback || '人工批改' };

  const totalScore = otherTotal + score;
  const allGraded = answers.every((a) => typeof a.score === 'number');

  return prisma.examSubmission.update({
    where: { id: submission.id },
    data: {
      answers: JSON.stringify(answers),
      totalScore,
      status: allGraded ? 'graded' : 'submitted',
      gradedAt: allGraded ? new Date() : null,
    },
  });
}
