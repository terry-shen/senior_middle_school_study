import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Difficulty weight mapping (matches mastery-service)
const DIFFICULTY_WEIGHTS: Record<string, number> = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.2,
  very_hard: 1.5,
};

// Standard presets: gaokao, midterm, final, custom
const STANDARD_PRESETS: Record<string, { totalScore: number; duration: number; difficulty: Record<string, number> }> = {
  gaokao: { totalScore: 150, duration: 120, difficulty: { easy: 30, medium: 50, hard: 20 } },
  midterm: { totalScore: 100, duration: 90, difficulty: { easy: 40, medium: 50, hard: 10 } },
  final: { totalScore: 100, duration: 90, difficulty: { easy: 30, medium: 50, hard: 20 } },
  custom: { totalScore: 100, duration: 60, difficulty: { easy: 30, medium: 50, hard: 20 } },
};

/**
 * Generate questions for a mock exam using difficulty distribution and knowledge point weights.
 * Reuses Question bank (no AI generation - pulls from existing bank).
 */
async function selectQuestionsForMockExam(params: {
  standard: string;
  totalScore?: number;
  duration?: number;
  difficultyRatio?: Record<string, number>;
  knowledgePointWeights?: Record<string, number>;
  questionTypeRatio?: { choice?: number; fill?: number; essay?: number };
}): Promise<{ questionIds: number[]; totalScore: number }> {
  const preset = STANDARD_PRESETS[params.standard] || STANDARD_PRESETS.custom;
  const totalScore = params.totalScore || preset.totalScore;
  const difficulty = params.difficultyRatio || preset.difficulty;

  // Get all questions with their metadata
  // Note: aiAnalyzed filter removed - after decouple-knowledge-from-questions,
  // no question is ever marked aiAnalyzed=true, so filtering on it yields zero.
  const allQuestions = await prisma.question.findMany({
    where: {
      OR: [{ analysis: { not: '' } }, { answer: { not: '' } }],
      questionType: { not: 'unknown' },
    },
    select: { id: true, score: true, difficulty: true, questionType: true },
  });

  // Group questions by difficulty
  const byDifficulty: Record<string, typeof allQuestions> = {
    easy: allQuestions.filter(q => q.difficulty === 'easy'),
    medium: allQuestions.filter(q => q.difficulty === 'medium'),
    hard: allQuestions.filter(q => q.difficulty === 'hard' || q.difficulty === 'very_hard'),
  };

  const selectedIds: number[] = [];
  let accumulatedScore = 0;
  const usedIds = new Set<number>();

  // Select questions by difficulty ratio
  for (const [diff, ratio] of Object.entries(difficulty)) {
    const pool = byDifficulty[diff] || [];
    const targetScore = (totalScore * ratio) / 100;
    // Shuffle pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    for (const q of shuffled) {
      if (usedIds.has(q.id)) continue;
      const qScore = q.score || 5;
      if (accumulatedScore + qScore > targetScore + totalScore * 0.1) continue;
      selectedIds.push(q.id);
      usedIds.add(q.id);
      accumulatedScore += qScore;
      if (accumulatedScore >= targetScore) break;
    }
  }

  // If we haven't reached totalScore, fill with any questions
  if (accumulatedScore < totalScore) {
    const remaining = allQuestions.filter(q => !usedIds.has(q.id));
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    for (const q of shuffled) {
      const qScore = q.score || 5;
      selectedIds.push(q.id);
      usedIds.add(q.id);
      accumulatedScore += qScore;
      if (accumulatedScore >= totalScore) break;
    }
  }

  return { questionIds: selectedIds, totalScore: Math.round(accumulatedScore) };
}

/**
 * Create a mock exam (admin only)
 */
export async function createMockExam(data: {
  title: string;
  standard?: string;
  totalScore?: number;
  duration?: number;
  difficultyRatio?: Record<string, number>;
  knowledgePointWeights?: Record<string, number>;
  creatorId: number;
  paperId?: number; // 整卷模式：关联 ExamPaper(purpose=whole_paper)，跳过题目选择
}) {
  const standard = data.standard || 'custom';
  let questionIds: number[] = [];
  let totalScore = data.totalScore || STANDARD_PRESETS[standard]?.totalScore || 100;

  if (data.paperId) {
    // 整卷模式：无在线题目，学生下载原始试卷线下作答
    questionIds = [];
  } else {
    const selected = await selectQuestionsForMockExam({
      standard,
      totalScore: data.totalScore,
      duration: data.duration,
      difficultyRatio: data.difficultyRatio,
      knowledgePointWeights: data.knowledgePointWeights,
    });
    questionIds = selected.questionIds;
    totalScore = selected.totalScore;
  }

  return prisma.mockExam.create({
    data: {
      title: data.title,
      standard,
      questionIds: JSON.stringify(questionIds),
      totalScore,
      duration: data.duration || STANDARD_PRESETS[standard].duration,
      difficultyRatio: JSON.stringify(data.difficultyRatio || STANDARD_PRESETS[standard].difficulty),
      knowledgePointWeights: JSON.stringify(data.knowledgePointWeights || {}),
      status: 'draft',
      creatorId: data.creatorId,
      paperId: data.paperId || null,
    },
  });
}

/**
 * Create a mock exam from a generated exam (自动出卷 → 模拟考试打通)
 * Used by POST /api/exams/generate so the admin's generated paper is
 * immediately available as a draft mock exam that students can take after publish.
 */
export async function createMockExamFromGeneratedExam(data: {
  title: string;
  questionIds: number[];
  totalScore: number;
  duration?: number;
  creatorId: number;
}) {
  return prisma.mockExam.create({
    data: {
      title: data.title,
      standard: 'custom',
      questionIds: JSON.stringify(data.questionIds),
      totalScore: data.totalScore || 100,
      duration: data.duration || 120,
      difficultyRatio: JSON.stringify({ easy: 30, medium: 50, hard: 20 }),
      knowledgePointWeights: JSON.stringify({}),
      status: 'draft',
      creatorId: data.creatorId,
    },
  });
}

/**
 * Raised when caller-supplied input is invalid (bad datetime, endTime <= startTime).
 * Routes map this to HTTP 400 rather than 500.
 */
export class MockExamInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MockExamInputError';
  }
}

/**
 * Normalize a client-supplied datetime into a valid Date.
 * Accepts Date, ISO-8601 strings, and browser `datetime-local` values
 * (e.g. "2026-09-29T12:27" - no seconds, no timezone), which Prisma rejects
 * on DateTime fields with "premature end of input".
 * Returns undefined when the value is absent/blank; throws MockExamInputError
 * when a value was supplied but cannot be parsed.
 */
function toDateTime(value: Date | string | null | undefined, field: string): Date | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new MockExamInputError(`Invalid ${field}: not a valid date`);
    return value;
  }
  const raw = String(value).trim();
  if (raw === '') return undefined;
  // `datetime-local` has no timezone; Safari omits the seconds field.
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new MockExamInputError(`Invalid ${field}: "${raw}" is not a valid date-time`);
  }
  return parsed;
}

/**
 * Publish a mock exam
 */
export async function publishMockExam(
  examId: number,
  startTime?: Date | string | null,
  endTime?: Date | string | null
) {
  const start = toDateTime(startTime, 'startTime');
  const end = toDateTime(endTime, 'endTime');
  if (start && end && end.getTime() <= start.getTime()) {
    throw new MockExamInputError('endTime must be later than startTime');
  }
  return prisma.mockExam.update({
    where: { id: examId },
    data: {
      status: 'published',
      startTime: start || new Date(),
      endTime: end || new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Start a mock exam (student)
 * Creates MockExamAnswer records for all questions
 */
export async function startMockExam(mockExamId: number, studentId: number) {
  const exam = await prisma.mockExam.findUnique({ where: { id: mockExamId } });
  if (!exam) throw new Error('Mock exam not found');
  if (exam.status !== 'published') throw new Error('Mock exam is not published');

  const questionIds: number[] = JSON.parse(exam.questionIds);

  // Create answer records for all questions
  const answers = await Promise.all(
    questionIds.map(qId =>
      prisma.mockExamAnswer.upsert({
        where: {
          mockExamId_studentId_questionId: { mockExamId, studentId, questionId: qId },
        },
        update: {},
        create: { mockExamId, studentId, questionId: qId, maxScore: 5 },
      })
    )
  );

  // Update exam status
  await prisma.mockExam.update({
    where: { id: mockExamId },
    data: { status: 'in_progress' },
  });

  return { exam, answers };
}

/**
 * Save a student's answer for a question in mock exam
 */
export async function saveAnswer(data: {
  mockExamId: number;
  studentId: number;
  questionId: number;
  answer?: string;
  imageUrl?: string;
  timeSpent?: number;
}) {
  return prisma.mockExamAnswer.upsert({
    where: {
      mockExamId_studentId_questionId: {
        mockExamId: data.mockExamId,
        studentId: data.studentId,
        questionId: data.questionId,
      },
    },
    update: {
      answer: data.answer,
      imageUrl: data.imageUrl,
      timeSpent: data.timeSpent,
    },
    create: {
      mockExamId: data.mockExamId,
      studentId: data.studentId,
      questionId: data.questionId,
      answer: data.answer,
      imageUrl: data.imageUrl,
      timeSpent: data.timeSpent,
      maxScore: 5,
    },
  });
}

/**
 * Toggle mark for review
 */
export async function toggleMark(mockExamId: number, studentId: number, questionId: number) {
  const existing = await prisma.mockExamAnswer.findUnique({
    where: {
      mockExamId_studentId_questionId: { mockExamId, studentId, questionId },
    },
  });
  if (!existing) throw new Error('Answer record not found');

  return prisma.mockExamAnswer.update({
    where: { id: existing.id },
    data: { isMarked: !existing.isMarked },
  });
}

/**
 * Submit mock exam and auto-grade choice/fill questions
 */
export async function submitMockExam(mockExamId: number, studentId: number) {
  const exam = await prisma.mockExam.findUnique({ where: { id: mockExamId } });
  if (!exam) throw new Error('Mock exam not found');

  const questionIds: number[] = JSON.parse(exam.questionIds);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
  });

  const answers = await prisma.mockExamAnswer.findMany({
    where: { mockExamId, studentId },
  });

  let totalScore = 0;

  for (const answer of answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) continue;

    let score = 0;
    let isCorrect = false;
    let feedback = '';

    if (question.questionType === 'choice' || question.questionType === 'single_choice' || question.questionType === 'multiple_choice') {
      const correctAnswer = question.answer || '';
      // Multi-choice: answer may be a JSON array like ["A","C"] or comma-separated "A,C"
      let isCorrect = false;
      if (question.questionType === 'multiple_choice' && correctAnswer.startsWith('[')) {
        try {
          const correctSet = JSON.parse(correctAnswer).map((x: string) => x.trim()).sort().join(',');
          const givenSet = (answer.answer || '').split(/[,，;；]/).map((x: string) => x.trim()).sort().join(',');
          isCorrect = givenSet.toLowerCase() === correctSet.toLowerCase();
        } catch { isCorrect = false; }
      } else {
        isCorrect = (answer.answer || '').trim().toLowerCase() === correctAnswer.trim().toLowerCase();
      }
      score = isCorrect ? Math.round(question.score || 5) : 0;
      feedback = isCorrect ? '回答正确' : `正确答案: ${correctAnswer}`;
    } else if (question.questionType === 'fill') {
      // Simple exact match for fill (AI grading would be better)
      const correctAnswer = question.answer || '';
      const answers = correctAnswer.split(/[，,;；|]/).map(a => a.trim().toLowerCase());
      isCorrect = answers.includes((answer.answer || '').trim().toLowerCase());
      score = isCorrect ? Math.round(question.score || 5) : 0;
      feedback = isCorrect ? '回答正确' : `参考答案: ${correctAnswer}`;
    } else {
      // Essay: keep pending, AI grading will handle later
      feedback = '等待AI批改';
    }

    totalScore += score;
    await prisma.mockExamAnswer.update({
      where: { id: answer.id },
      data: {
        score,
        isCorrect,
        feedback,
        maxScore: Math.round(question.score || 5),
        gradedAt: new Date(),
        gradedBy: question.questionType === 'essay' ? null : 'auto',
      },
    });
  }

  // Update exam status
  await prisma.mockExam.update({
    where: { id: mockExamId },
    data: { status: 'completed' },
  });

  return { totalScore, maxScore: exam.totalScore, questionCount: questionIds.length };
}

/**
 * Get mock exam result with detailed breakdown
 */
export async function getMockExamResult(mockExamId: number, studentId: number) {
  const exam = await prisma.mockExam.findUnique({ where: { id: mockExamId } });
  if (!exam) throw new Error('Mock exam not found');

  const answers = await prisma.mockExamAnswer.findMany({
    where: { mockExamId, studentId },
    include: { question: true },
  });

  const totalScore = answers.reduce((sum, a) => sum + (a.score || 0), 0);
  const correctCount = answers.filter(a => a.isCorrect).length;
  const markedCount = answers.filter(a => a.isMarked).length;
  const totalTimeSpent = answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);

  return {
    exam,
    totalScore,
    maxScore: exam.totalScore,
    correctCount,
    totalQuestions: answers.length,
    markedCount,
    totalTimeSpent,
    answers,
  };
}

/**
 * Get student's mock exam list
 * Returns ALL exams the student can see (published/in_progress/completed),
 * with the student's own answer status attached. Without this, students who
 * have never taken an exam see an empty list even when exams are published.
 */
export async function getMockExamHistory(studentId: number) {
  // All exams that are visible to students (published or beyond)
  const exams = await prisma.mockExam.findMany({
    where: { status: { in: ['published', 'in_progress', 'completed'] } },
    orderBy: { createdAt: 'desc' },
    include: { paper: { select: { id: true, title: true, pdfUrl: true, purpose: true, subject: true, school: true } } },
  });

  // Student's answers for these exams
  const examAnswers = await prisma.mockExamAnswer.findMany({
    where: { studentId },
  });

  // Aggregate per-exam score for the student
  const scoreByExam = new Map<number, number>();
  const answeredCountByExam = new Map<number, number>();
  for (const a of examAnswers) {
    scoreByExam.set(a.mockExamId, (scoreByExam.get(a.mockExamId) || 0) + (a.score || 0));
    answeredCountByExam.set(a.mockExamId, (answeredCountByExam.get(a.mockExamId) || 0) + 1);
  }

  return exams.map(exam => ({
    ...exam,
    studentScore: scoreByExam.get(exam.id),
    answered: answeredCountByExam.get(exam.id) || 0,
  }));
}

/**
 * Get benchmark analysis - compare with class average and full marks
 */
export async function getBenchmarkAnalysis(mockExamId: number, studentId: number) {
  const result = await getMockExamResult(mockExamId, studentId);
  const exam = result.exam;

  // Get all students who took this exam
  const allAnswers = await prisma.mockExamAnswer.findMany({
    where: { mockExamId },
    select: { studentId: true, score: true, timeSpent: true },
  });

  const studentScores = new Map<number, number>();
  for (const a of allAnswers) {
    studentScores.set(a.studentId, (studentScores.get(a.studentId) || 0) + (a.score || 0));
  }

  const scores = Array.from(studentScores.values());
  const classAverage = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
  const maxInClass = scores.length > 0 ? Math.max(...scores) : 0;
  const minInClass = scores.length > 0 ? Math.min(...scores) : 0;
  const rank = scores.filter(s => s > result.totalScore).length + 1;

  return {
    studentScore: result.totalScore,
    maxScore: exam.totalScore,
    fullMarks: exam.totalScore,
    classAverage: Math.round(classAverage * 10) / 10,
    classMax: maxInClass,
    classMin: minInClass,
    rank,
    totalStudents: scores.length,
    percentile: scores.length > 0 ? Math.round(((scores.length - rank + 1) / scores.length) * 100) : 0,
  };
}

/**
 * Get wrong question analysis for mock exam
 */
export async function getWrongQuestionAnalysis(mockExamId: number, studentId: number) {
  const answers = await prisma.mockExamAnswer.findMany({
    where: { mockExamId, studentId, isCorrect: false },
    include: { question: true },
  });

  // Group by question type (replaces by-knowledge-point after decoupling)
  const byType: Record<string, { wrongCount: number; questions: number[] }> = {};
  for (const a of answers) {
    const qt = a.question.questionType || 'unknown';
    if (!byType[qt]) byType[qt] = { wrongCount: 0, questions: [] };
    byType[qt].wrongCount++;
    byType[qt].questions.push(a.questionId);
  }

  const sortedTypes = Object.entries(byType)
    .map(([questionType, data]) => ({ questionType, ...data }))
    .sort((a, b) => b.wrongCount - a.wrongCount);

  return {
    totalWrong: answers.length,
    byQuestionType: sortedTypes,
    wrongAnswers: answers,
  };
}

/**
 * Get all mock exams (admin)
 */
export async function listMockExams(status?: string) {
  return prisma.mockExam.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { id: true, name: true, studentId: true } },
      paper: { select: { id: true, title: true, pdfUrl: true, purpose: true, subject: true, school: true } },
    },
  });
}

/**
 * Get a mock exam by ID
 */
export async function getMockExam(id: number) {
  return prisma.mockExam.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, studentId: true } },
      paper: { select: { id: true, title: true, pdfUrl: true, purpose: true, subject: true, school: true } },
    },
  });
}

/**
 * Delete a mock exam
 */
export async function deleteMockExam(id: number) {
  return prisma.mockExam.delete({ where: { id } });
}
