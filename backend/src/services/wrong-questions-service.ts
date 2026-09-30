/**
 * Student Wrong Questions Service
 *
 * 学生自主录入错题本（拍照/手动），不依赖 Question 表外键，
 * 重练用自评判分，掌握度按自由文本标签分组。
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateWrongQuestionInput {
  source?: 'photo' | 'manual';
  imageUrl?: string | null;
  content?: string | null;
  options?: string | null; // JSON 字符串数组
  myAnswer?: string | null;
  correctAnswer?: string | null;
  analysis?: string | null;
  questionType?: string;
  difficulty?: string;
  knowledgePointTags?: string | null;
  notes?: string | null;
}

export interface UpdateWrongQuestionInput {
  imageUrl?: string | null;
  content?: string | null;
  options?: string | null;
  myAnswer?: string | null;
  correctAnswer?: string | null;
  analysis?: string | null;
  questionType?: string;
  difficulty?: string;
  knowledgePointTags?: string | null;
  notes?: string | null;
}

export interface WrongQuestionFilters {
  questionType?: string;
  difficulty?: string;
  tag?: string; // 模糊匹配 knowledgePointTags
  reviewStatus?: string; // new/reviewing/mastered
  viewMode?: 'unmastered' | 'all'; // 默认 unmastered
  sortBy?: 'createdAt' | 'lastReviewAt';
  page?: number;
  limit?: number;
}

/**
 * 创建错题
 */
export async function createWrongQuestion(
  studentId: number,
  data: CreateWrongQuestionInput
) {
  return prisma.studentWrongQuestion.create({
    data: {
      studentId,
      source: data.source ?? 'manual',
      imageUrl: data.imageUrl ?? null,
      content: data.content ?? null,
      options: data.options ?? null,
      myAnswer: data.myAnswer ?? null,
      correctAnswer: data.correctAnswer ?? null,
      analysis: data.analysis ?? null,
      questionType: data.questionType ?? 'unknown',
      difficulty: data.difficulty ?? 'unknown',
      knowledgePointTags: data.knowledgePointTags ?? null,
      notes: data.notes ?? null,
    },
  });
}

/**
 * 查询错题列表（多维筛选 + 分页 + 视图消减）
 */
export async function getWrongQuestions(
  studentId: number,
  filters: WrongQuestionFilters = {}
) {
  const {
    questionType,
    difficulty,
    tag,
    reviewStatus,
    viewMode = 'unmastered',
    sortBy = 'createdAt',
    page = 1,
    limit = 20,
  } = filters;

  const where: Prisma.StudentWrongQuestionWhereInput = { studentId };

  if (questionType && questionType !== 'all') {
    where.questionType = questionType;
  }
  if (difficulty && difficulty !== 'all') {
    where.difficulty = difficulty;
  }
  if (reviewStatus && reviewStatus !== 'all') {
    where.reviewStatus = reviewStatus;
  } else if (viewMode === 'unmastered') {
    // 默认视图：仅未掌握
    where.reviewStatus = { not: 'mastered' };
  }
  if (tag && tag.trim()) {
    where.knowledgePointTags = { contains: tag.trim() };
  }

  const orderBy: Prisma.StudentWrongQuestionOrderByWithRelationInput =
    sortBy === 'lastReviewAt'
      ? { lastReviewAt: 'desc' }
      : { createdAt: 'desc' };

  const [data, total] = await Promise.all([
    prisma.studentWrongQuestion.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.studentWrongQuestion.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

/**
 * 获取错题详情
 */
export async function getWrongQuestionById(id: number, studentId: number) {
  return prisma.studentWrongQuestion.findFirst({
    where: { id, studentId },
  });
}

/**
 * 更新错题（补录题面/编辑）
 */
export async function updateWrongQuestion(
  id: number,
  studentId: number,
  data: UpdateWrongQuestionInput
) {
  return prisma.studentWrongQuestion.update({
    where: { id },
    data: {
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.options !== undefined && { options: data.options }),
      ...(data.myAnswer !== undefined && { myAnswer: data.myAnswer }),
      ...(data.correctAnswer !== undefined && { correctAnswer: data.correctAnswer }),
      ...(data.analysis !== undefined && { analysis: data.analysis }),
      ...(data.questionType !== undefined && { questionType: data.questionType }),
      ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
      ...(data.knowledgePointTags !== undefined && { knowledgePointTags: data.knowledgePointTags }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

/**
 * 删除错题
 */
export async function deleteWrongQuestion(id: number, studentId: number) {
  return prisma.studentWrongQuestion.deleteMany({
    where: { id, studentId },
  });
}

/**
 * 重练自评
 * - selfAssessment='correct' → reviewStatus=mastered, wrongCount 不变
 * - selfAssessment='wrong'   → wrongCount+1, reviewStatus='reviewing'
 */
export async function practiceWrongQuestion(
  id: number,
  studentId: number,
  selfAssessment: 'correct' | 'wrong',
  userAnswer?: string
) {
  const now = new Date();
  if (selfAssessment === 'correct') {
    return prisma.studentWrongQuestion.update({
      where: { id },
      data: {
        reviewStatus: 'mastered',
        lastReviewAt: now,
        myAnswer: userAnswer ?? undefined,
      },
    });
  }
  // 答错
  const current = await prisma.studentWrongQuestion.findFirst({
    where: { id, studentId },
    select: { wrongCount: true },
  });
  return prisma.studentWrongQuestion.update({
    where: { id },
    data: {
      wrongCount: (current?.wrongCount ?? 0) + 1,
      reviewStatus: 'reviewing',
      lastReviewAt: now,
      myAnswer: userAnswer ?? undefined,
    },
  });
}

/**
 * 标记/取消掌握
 */
export async function setMastered(
  id: number,
  studentId: number,
  mastered: boolean
) {
  return prisma.studentWrongQuestion.update({
    where: { id },
    data: {
      reviewStatus: mastered ? 'mastered' : 'reviewing',
      lastReviewAt: new Date(),
    },
  });
}

/**
 * 掌握度概览：按知识点标签分组
 * 掌握度 = 已掌握数 / 总数 × 100%
 * 未打标签的错题归入「未分类」行
 */
export async function getMasteryOverview(studentId: number) {
  const all = await prisma.studentWrongQuestion.findMany({
    where: { studentId },
    select: {
      knowledgePointTags: true,
      reviewStatus: true,
    },
  });

  type GroupStat = {
    tag: string;
    total: number;
    mastered: number;
    mastery: number; // 0-100
    weak: boolean; // mastery < 50
  };

  const groups = new Map<string, { total: number; mastered: number }>();

  for (const item of all) {
    let tags: string[] = [];
    if (item.knowledgePointTags && item.knowledgePointTags.trim()) {
      tags = item.knowledgePointTags
        .split(/[,，;；]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (tags.length === 0) tags = ['未分类'];

    for (const t of tags) {
      const g = groups.get(t) ?? { total: 0, mastered: 0 };
      g.total += 1;
      if (item.reviewStatus === 'mastered') g.mastered += 1;
      groups.set(t, g);
    }
  }

  const overview: GroupStat[] = Array.from(groups.entries()).map(([tag, stat]) => {
    const mastery = stat.total === 0 ? 0 : Math.round((stat.mastered / stat.total) * 100);
    return {
      tag,
      total: stat.total,
      mastered: stat.mastered,
      mastery,
      weak: mastery < 50,
    };
  });

  // 排序：未分类最后；其余按掌握度升序（薄弱在前）
  overview.sort((a, b) => {
    if (a.tag === '未分类' && b.tag !== '未分类') return 1;
    if (b.tag === '未分类' && a.tag !== '未分类') return -1;
    return a.mastery - b.mastery;
  });

  const total = all.length;
  const masteredCount = all.filter((x) => x.reviewStatus === 'mastered').length;
  const overallMastery = total === 0 ? 0 : Math.round((masteredCount / total) * 100);

  return {
    overall: {
      total,
      mastered: masteredCount,
      mastery: overallMastery,
    },
    groups: overview,
  };
}

/**
 * 打印导出：返回排版数据供前端 window.print() 渲染
 */
export async function getPrintExportData(
  studentId: number,
  ids: number[],
  includeAnswerAnalysis: boolean = false
) {
  const items = await prisma.studentWrongQuestion.findMany({
    where: { id: { in: ids }, studentId },
    orderBy: { createdAt: 'desc' },
  });

  return items.map((item, idx) => ({
    index: idx + 1,
    id: item.id,
    questionType: item.questionType,
    difficulty: item.difficulty,
    content: item.content,
    imageUrl: item.imageUrl,
    options: item.options,
    knowledgePointTags: item.knowledgePointTags,
    ...(includeAnswerAnalysis && {
      myAnswer: item.myAnswer,
      correctAnswer: item.correctAnswer,
      analysis: item.analysis,
    }),
  }));
}
