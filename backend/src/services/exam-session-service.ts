/**
 * Exam Session Service
 *
 * 统一考试会话服务，合并 MockExam + Exam + GeneratedExam。
 * - mode='whole_paper': 整卷考试（下载试卷→线下作答→上传答题纸）
 * - mode='online': 在线逐题考试（在线答题→自动判分）
 * - source='library': 从试卷库选整卷
 * - source='auto': 从题库自动组卷
 * - source='manual': 手动选题
 */

import { PrismaClient } from '@prisma/client';
import { selectQuestions, previewExam as previewQuestions, ExamGenerationParams } from './exam-generation-service';

const prisma = new PrismaClient();

export interface CreateExamSessionData {
  title: string;
  mode: 'whole_paper' | 'online';
  source?: 'library' | 'auto' | 'manual';
  content?: string; // JSON: 在线模式=题ID数组, 整卷=空
  paperId?: number; // 整卷关联 ExamPaper
  subjectId?: number; // 学科维度
  totalScore?: number;
  duration?: number;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  creatorId: number;
  // auto 组卷参数
  generationParams?: ExamGenerationParams;
}

export interface PublishData {
  classIds?: number[];
  studentIds?: number[];
  startTime?: Date | string | null;
  endTime?: Date | string | null;
}

function toDateTime(value: any, _field: string): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s) return undefined;
  // datetime-local 格式 "YYYY-MM-DDTHH:MM" → 补秒
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    return new Date(s + ':00');
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error(`Invalid ${_field}: ${value}`);
  return d;
}

/**
 * 创建考试会话
 */
export async function createExamSession(data: CreateExamSessionData) {
  const source = data.source || (data.mode === 'whole_paper' ? 'library' : 'manual');

  // 自动组卷模式：从题库选题
  let content = data.content || '[]';
  let totalScore = data.totalScore || 0;

  if (source === 'auto' && data.generationParams) {
    const selected = await selectQuestions(data.generationParams);
    const questionIds = selected.map((q: any) => q.id);
    content = JSON.stringify(questionIds);
    totalScore = data.totalScore || selected.reduce((sum: number, q: any) => sum + (q.score || 5), 0);
  }

  if (data.mode === 'whole_paper' && data.paperId) {
    content = '[]'; // 整卷模式 content 为空
    if (!totalScore) {
      const paper = await prisma.examPaper.findUnique({ where: { id: data.paperId }, select: { totalScore: true } });
      totalScore = paper?.totalScore || 100;
    }
  }

  return prisma.examSession.create({
    data: {
      title: data.title,
      mode: data.mode,
      source,
      content,
      paperId: data.paperId || null,
      subjectId: data.subjectId || null,
      totalScore,
      duration: data.duration || 120,
      startTime: toDateTime(data.startTime, 'startTime'),
      endTime: toDateTime(data.endTime, 'endTime'),
      status: 'draft',
      creatorId: data.creatorId,
    },
    include: { paper: { select: { id: true, title: true, pdfUrl: true, purpose: true, subject: { select: { id: true, name: true } }, school: true } } },
  });
}

/**
 * 预览自动组卷
 */
export async function previewExamSession(params: ExamGenerationParams) {
  const preview = await previewQuestions(params);
  return { ...preview, count: preview.questions.length };
}

/**
 * 发布考试会话（分配学生）
 */
export async function publishExamSession(id: number, data: PublishData = {}) {
  const startTime = toDateTime(data.startTime, 'startTime');
  const endTime = toDateTime(data.endTime, 'endTime');

  // 未指定学生 → 分配全部学生
  let studentIds = data.studentIds;
  if (!studentIds || studentIds.length === 0) {
    if (data.classIds && data.classIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { classId: { in: data.classIds }, role: 'student' },
        select: { id: true },
      });
      studentIds = students.map((s) => s.id);
    } else {
      const students = await prisma.student.findMany({
        where: { role: 'student' },
        select: { id: true },
      });
      studentIds = students.map((s) => s.id);
    }
  }

  // 为每个学生创建空的 ExamSubmission（在线模式）
  const session = await prisma.examSession.findUnique({ where: { id } });
  if (!session) throw new Error('Exam session not found');

  if (session.mode === 'online') {
    for (const sid of studentIds) {
      await prisma.examSubmission.upsert({
        where: { examSessionId_studentId: { examSessionId: id, studentId: sid } },
        create: { examSessionId: id, studentId: sid, mode: 'online', status: 'pending' },
        update: {},
      });
    }
  }

  return prisma.examSession.update({
    where: { id },
    data: {
      status: 'published',
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    },
    include: { paper: { select: { id: true, title: true, pdfUrl: true, purpose: true } } },
  });
}

/**
 * 学生开始考试
 */
export async function startExamSession(id: number, studentId: number) {
  const session = await prisma.examSession.findUnique({ where: { id } });
  if (!session) throw new Error('考试会话不存在');
  if (session.status !== 'published' && session.status !== 'ongoing') {
    throw new Error(`考试当前状态为 ${session.status}，无法开始`);
  }

  // 更新考试状态为 ongoing
  if (session.status === 'published') {
    await prisma.examSession.update({ where: { id }, data: { status: 'ongoing' } });
  }

  // 在线模式：确保有 ExamSubmission
  if (session.mode === 'online') {
    const submission = await prisma.examSubmission.upsert({
      where: { examSessionId_studentId: { examSessionId: id, studentId } },
      create: { examSessionId: id, studentId, mode: 'online', status: 'pending' },
      update: {},
    });
    return { session, submission };
  }

  // 整卷模式：返回考试信息（学生下载试卷）
  return { session, submission: null };
}

/**
 * 保存答案（在线模式）
 */
export async function saveAnswer(
  examSessionId: number,
  studentId: number,
  questionId: number,
  answer: string,
  timeSpent?: number
) {
  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });
  if (!submission) throw new Error('未找到答题记录');

  const answers: any[] = submission.answers ? JSON.parse(submission.answers) : [];
  const idx = answers.findIndex((a) => a.questionId === questionId);
  const entry = { questionId, answer, timeSpent: timeSpent || 0 };
  if (idx >= 0) answers[idx] = entry;
  else answers.push(entry);

  return prisma.examSubmission.update({
    where: { id: submission.id },
    data: { answers: JSON.stringify(answers), status: 'pending' },
  });
}

/**
 * 提交考试
 */
export async function submitExamSession(examSessionId: number, studentId: number) {
  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });
  if (!submission) throw new Error('未找到答题记录');
  if (submission.status === 'submitted' || submission.status === 'graded') {
    throw new Error('已提交过');
  }

  // 自动判分（选择题/填空题）
  const session = await prisma.examSession.findUnique({ where: { id: examSessionId } });
  let totalScore: number | null = null;

  if (session && session.mode === 'online') {
    const questionIds: number[] = JSON.parse(session.content || '[]');
    const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
    const answers: any[] = submission.answers ? JSON.parse(submission.answers) : [];

    let computedScore = 0;
    const gradedAnswers = answers.map((a) => {
      const q = questions.find((x) => x.id === a.questionId);
      if (!q) return a;
      let isCorrect = false;
      let score = 0;
      if (q.questionType === 'single_choice' || q.questionType === 'multiple_choice' || q.questionType === 'choice') {
        const correct = (q.answer || '').trim();
        const given = (a.answer || '').trim();
        isCorrect = correct && given && correct === given;
        score = isCorrect ? (q.score || 5) : 0;
      } else if (q.questionType === 'fill') {
        const correct = (q.answer || '').trim();
        const given = (a.answer || '').trim();
        isCorrect = correct && given && correct === given;
        score = isCorrect ? (q.score || 5) : 0;
      }
      if (isCorrect) computedScore += score;
      return { ...a, isCorrect, score, feedback: isCorrect ? '正确' : '错误' };
    });

    return prisma.examSubmission.update({
      where: { id: submission.id },
      data: {
        answers: JSON.stringify(gradedAnswers),
        status: 'graded',
        totalScore: computedScore,
        submittedAt: new Date(),
        gradedAt: new Date(),
      },
    });
  }

  return prisma.examSubmission.update({
    where: { id: submission.id },
    data: { status: 'submitted', submittedAt: new Date() },
  });
}

/**
 * 获取考试会话详情
 */
export async function getExamSessionById(id: number) {
  return prisma.examSession.findUnique({
    where: { id },
    include: {
      paper: { select: { id: true, title: true, pdfUrl: true, purpose: true, subject: { select: { id: true, name: true } }, school: true } },
      creator: { select: { id: true, name: true, studentId: true } },
      submissions: true,
      answerSheets: true,
    },
  });
}

/**
 * 列出考试会话
 */
export async function listExamSessions(filters: { status?: string; mode?: string; creatorId?: number; subjectId?: number; page?: number; limit?: number } = {}) {
  const { status, mode, creatorId, subjectId, page = 1, limit = 20 } = filters;
  const where: any = {};
  if (status) where.status = status;
  if (mode) where.mode = mode;
  if (creatorId) where.creatorId = creatorId;
  if (subjectId) where.subjectId = subjectId;

  const [data, total] = await Promise.all([
    prisma.examSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        paper: { select: { id: true, title: true, pdfUrl: true, purpose: true, subject: { select: { id: true, name: true } }, school: true } },
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.examSession.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
}

/**
 * 学生视角：列出已发布的考试
 */
export async function listExamSessionsForStudent(studentId: number, subjectId?: number) {
  const sessions = await prisma.examSession.findMany({
    where: {
      status: { in: ['published', 'ongoing', 'graded'] },
      ...(subjectId ? { subjectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      paper: { select: { id: true, title: true, pdfUrl: true, purpose: true, subject: { select: { id: true, name: true } }, school: true } },
      submissions: { where: { studentId } },
    },
  });

  // 附加学生作答状态
  return sessions.map((s) => ({
    ...s,
    studentSubmission: s.submissions[0] || null,
    studentScore: s.submissions[0]?.totalScore ?? null,
    answered: !!s.submissions[0],
  }));
}

/**
 * 获取学生答题记录
 */
export async function getStudentSubmission(examSessionId: number, studentId: number) {
  return prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });
}

/**
 * 获取考试题目（在线模式）
 */
export async function getExamQuestions(examSessionId: number) {
  const session = await prisma.examSession.findUnique({ where: { id: examSessionId } });
  if (!session) throw new Error('考试会话不存在');

  const questionIds: number[] = JSON.parse(session.content || '[]');
  if (questionIds.length === 0) return [];

  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { paper: { select: { id: true, title: true } } },
  });

  // 按原始顺序排列 + 解析 options
  const ordered = questionIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  return ordered.map((q: any) => {
    let parsedOptions = null;
    if (q.options) {
      try { parsedOptions = JSON.parse(q.options); } catch { /* keep string */ }
    }
    return { ...q, options: Array.isArray(parsedOptions) ? parsedOptions : q.options };
  });
}

/**
 * 批改统计
 */
export async function getGradingStats(filters: { examSessionId?: number } = {}) {
  const where: any = {};
  if (filters.examSessionId) where.examSessionId = filters.examSessionId;

  const submissions = await prisma.examSubmission.findMany({
    where,
    select: { id: true, status: true, totalScore: true, mode: true },
  });

  const total = submissions.length;
  const graded = submissions.filter((s) => s.status === 'graded').length;
  const pending = submissions.filter((s) => s.status === 'pending' || s.status === 'submitted').length;
  const scores = submissions.filter((s) => s.totalScore !== null).map((s) => s.totalScore!);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0;

  const byType: Record<string, { total: number; graded: number; avgScore: number }> = {};
  for (const s of submissions) {
    const mode = s.mode || 'online';
    if (!byType[mode]) byType[mode] = { total: 0, graded: 0, avgScore: 0 };
    byType[mode].total++;
    if (s.status === 'graded') byType[mode].graded++;
  }
  for (const k of Object.keys(byType)) {
    byType[k].avgScore = avgScore;
  }

  return { total, graded, pending, avgScore, byType };
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
  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });
  if (!submission) throw new Error('未找到答题记录');

  const answers: any[] = submission.answers ? JSON.parse(submission.answers) : [];
  return prisma.examSubmission.update({
    where: { id: submission.id },
    data: {
      totalScore: newScore,
      status: 'graded',
      gradedAt: new Date(),
      gradedBy: studentId, // 这里实际应该是 teacherId，由路由层传入
      answers: feedback ? JSON.stringify(answers.map((a) => ({ ...a, feedback }))) : undefined,
    },
  });
}

/**
 * 删除考试会话
 */
export async function deleteExamSession(id: number) {
  await prisma.examSubmission.deleteMany({ where: { examSessionId: id } });
  await prisma.answerSheet.deleteMany({ where: { examSessionId: id } });
  return prisma.examSession.delete({ where: { id } });
}

/**
 * 取消发布（删除考试会话及关联数据）
 */
export async function unpublishExamSession(id: number) {
  return deleteExamSession(id);
}

/**
 * 取消考试（管理员）：保留考试与答题数据，仅把状态回退为 draft，
 * 使其不再出现在学生列表中（listExamSessionsForStudent 只查 published/ongoing/graded）。
 */
export async function cancelExamSession(id: number) {
  const session = await prisma.examSession.findUnique({ where: { id } });
  if (!session) throw new Error('考试会话不存在');
  if (session.status === 'draft') throw new Error('考试已是草稿状态');
  return prisma.examSession.update({
    where: { id },
    data: { status: 'draft', startTime: null, endTime: null },
  });
}

/**
 * 重做考试（学生）：清空本人答题记录，回到 pending 状态，可重新作答并再次提交。
 * - 整卷模式不支持在线重做（学生线下作答 + 上传答题纸）
 * - 会话若已结束(graded)则回退为 ongoing，允许再次进入答题
 */
export async function resetExamSubmission(examSessionId: number, studentId: number) {
  const session = await prisma.examSession.findUnique({ where: { id: examSessionId } });
  if (!session) throw new Error('考试会话不存在');
  if (session.mode === 'whole_paper') throw new Error('整卷考试不支持在线重做');
  if (session.status === 'draft') throw new Error('考试未发布，无法重做');

  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });

  // 会话已结束 → 回退为 ongoing，学生才能再次进入答题
  if (session.status === 'graded') {
    await prisma.examSession.update({ where: { id: examSessionId }, data: { status: 'ongoing' } });
  }

  if (!submission) {
    return prisma.examSubmission.create({
      data: { examSessionId, studentId, mode: 'online', status: 'pending', answers: '[]' },
    });
  }

  return prisma.examSubmission.update({
    where: { id: submission.id },
    data: {
      answers: '[]',
      status: 'pending',
      totalScore: null,
      submittedAt: null,
      gradedAt: null,
      gradedBy: null,
    },
  });
}

/**
 * 查看答卷（学生）：返回全部题目 + 本人答案 + 正确答案 + 解析。
 */
export async function getExamReview(examSessionId: number, studentId: number) {
  const session = await prisma.examSession.findUnique({ where: { id: examSessionId } });
  if (!session) throw new Error('考试会话不存在');

  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });
  if (!submission) throw new Error('未找到答题记录');

  const questions: any[] = await getExamQuestions(examSessionId);
  const answers: any[] = submission.answers ? JSON.parse(submission.answers) : [];
  const answerMap = new Map<number, any>();
  for (const a of answers) answerMap.set(a.questionId, a);

  const items = questions.map((q: any) => {
    const mine = answerMap.get(q.id);
    return {
      id: q.id,
      questionNumber: q.questionNumber,
      content: q.content,
      questionType: q.questionType,
      options: q.options,
      score: q.score,
      correctAnswer: q.answer ?? null,
      analysis: q.analysis ?? null,
      myAnswer: mine?.answer ?? null,
      isCorrect: mine?.isCorrect ?? null,
      earnedScore: mine?.score ?? null,
      feedback: mine?.feedback ?? null,
      timeSpent: mine?.timeSpent ?? null,
    };
  });

  return {
    session: {
      id: session.id,
      title: session.title,
      mode: session.mode,
      totalScore: session.totalScore,
      duration: session.duration,
    },
    mode: session.mode,
    status: submission.status,
    score: submission.totalScore ?? null,
    submittedAt: submission.submittedAt,
    gradedAt: submission.gradedAt,
    totalQuestions: items.length,
    answeredCount: answers.length,
    correctCount: items.filter((i) => i.isCorrect === true).length,
    questions: items,
  };
}

// ===== 标准预设（原 mock-exam-service STANDARD_PRESETS） =====

export const STANDARD_PRESETS: Record<string, { totalScore: number; duration: number }> = {
  gaokao: { totalScore: 150, duration: 120 },
  midterm: { totalScore: 100, duration: 90 },
  final: { totalScore: 100, duration: 90 },
  custom: { totalScore: 100, duration: 60 },
};

/**
 * 标记/取消标记题目（在线模式，存入 answers JSON 的 marked 标志）
 */
export async function toggleMark(
  examSessionId: number,
  studentId: number,
  questionId: number
) {
  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });
  if (!submission) throw new Error('未找到答题记录');

  const answers: any[] = submission.answers ? JSON.parse(submission.answers) : [];
  const idx = answers.findIndex((a) => a.questionId === questionId);
  if (idx >= 0) {
    answers[idx].marked = !answers[idx].marked;
  } else {
    answers.push({ questionId, answer: '', marked: true, timeSpent: 0 });
  }

  return prisma.examSubmission.update({
    where: { id: submission.id },
    data: { answers: JSON.stringify(answers) },
  });
}

/**
 * 考试结果（学生视角）
 * 在线模式：ExamSubmission 判分详情；整卷模式：AnswerSheet 批改结果
 */
export async function getExamSessionResult(examSessionId: number, studentId: number) {
  const session = await prisma.examSession.findUnique({
    where: { id: examSessionId },
    include: { paper: { select: { id: true, title: true, pdfUrl: true } } },
  });
  if (!session) throw new Error('考试会话不存在');

  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId, studentId } },
  });

  if (session.mode === 'whole_paper') {
    const sheets = await prisma.answerSheet.findMany({
      where: { examSessionId, studentId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      session: { id: session.id, title: session.title, mode: session.mode, totalScore: session.totalScore },
      mode: 'whole_paper' as const,
      score: sheets.find((s) => s.status === 'graded')?.totalScore ?? null,
      answerSheets: sheets,
      submission: null,
    };
  }

  // 在线模式：统计正确率
  const answers: any[] = submission?.answers ? JSON.parse(submission.answers) : [];
  const graded = answers.filter((a) => a.isCorrect !== undefined);
  const correctCount = graded.filter((a) => a.isCorrect).length;

  return {
    session: { id: session.id, title: session.title, mode: session.mode, totalScore: session.totalScore },
    mode: 'online' as const,
    score: submission?.totalScore ?? null,
    total: graded.length,
    correct: correctCount,
    answers,
    submission,
    answerSheets: [],
  };
}

/**
 * 对标分析（班级/全体排名）
 */
export async function getBenchmarkAnalysis(examSessionId: number, studentId: number) {
  const submissions = await prisma.examSubmission.findMany({
    where: { examSessionId, totalScore: { not: null } },
    orderBy: { totalScore: 'desc' },
    include: { student: { select: { id: true, name: true } } },
  });

  const scores = submissions.map((s) => s.totalScore!);
  const myIdx = submissions.findIndex((s) => s.studentId === studentId);
  const myScore = myIdx >= 0 ? submissions[myIdx].totalScore! : null;

  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    totalParticipants: submissions.length,
    myScore,
    myRank: myIdx >= 0 ? myIdx + 1 : null,
    percentile: myIdx >= 0 && scores.length > 0
      ? Math.round(((submissions.length - myIdx) / submissions.length) * 100)
      : null,
    average: Math.round(avg * 10) / 10,
    max: scores.length > 0 ? Math.max(...scores) : null,
    min: scores.length > 0 ? Math.min(...scores) : null,
  };
}

/**
 * 老师查看某考试的所有提交（批改用）
 */
export async function listExamSubmissions(examSessionId: number) {
  return prisma.examSubmission.findMany({
    where: { examSessionId },
    include: { student: { select: { id: true, name: true, studentId: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
