/**
 * Exam Generation Service
 * 自动出卷服务：智能选题算法、试卷生成、导出
 */

import { PrismaClient } from '@prisma/client';
import { LLMService } from './llm-service';

const prisma = new PrismaClient();

// 出卷参数接口
export interface ExamGenerationParams {
  name: string;
  totalScore: number;
  duration?: number;
  /** 指定从某一导入试卷中出卷；缺省/0 表示从全部题目中抽取 */
  paperId?: number;
  typeDistribution: {
    choice?: number;         // 选择题数量（旧枚举别名，兼容 single_choice）
    single_choice?: number;  // 单选题数量
    multiple_choice?: number; // 多选题数量
    fill?: number;    // 填空题数量
    essay?: number;   // 解答题数量
    [key: string]: number | undefined;
  };
  difficultyDistribution: {
    easy?: number;      // 简单题比例 (0-1)
    medium?: number;    // 中等题比例 (0-1)
    hard?: number;      // 困难题比例 (0-1)
    very_hard?: number; // 极难题比例 (0-1)
  };
  scoreDistribution: {
    choice?: number;         // 选择题每题分值（旧枚举别名）
    single_choice?: number;  // 单选题每题分值
    multiple_choice?: number; // 多选题每题分值
    fill?: number;    // 填空题每题分值
    essay?: number;   // 解答题每题分值
    [key: string]: number | undefined;
  };
}

// 选题结果
interface SelectedQuestion {
  id: number;
  questionId: number;
  questionNumber: number;
  score: number;
}

// 试卷生成结果
export interface GeneratedExamResult {
  id: number;
  title: string;
  totalScore: number;
  duration?: number;
  questions: SelectedQuestion[];
  parameters: ExamGenerationParams;
}

/**
 * 智能选题算法（贪心+CSP）
 * 基于知识点覆盖和难度分布约束选择试题
 */
export async function selectQuestions(params: ExamGenerationParams): Promise<SelectedQuestion[]> {
  const selectedQuestions: SelectedQuestion[] = [];
  let questionNumber = 1;

  // 容错：参数可能部分缺省
  const typeDistribution = params.typeDistribution || {};
  const difficultyDistribution = params.difficultyDistribution || {};
  const scoreDistribution = params.scoreDistribution || {};

  // 1. 获取题库中的所有题目（可限定来源试卷）
  const allQuestions = await prisma.question.findMany({
    where: {
      OR: [
        { analysis: { not: '' } },
        { answer: { not: '' } }
      ],
      ...(params.paperId && params.paperId > 0 ? { paperId: params.paperId } : {}),
    },
    orderBy: { questionNumber: 'asc' }
  });

  // 2. 按题型分类（兼容新旧枚举：choice≈single_choice）
  const isChoiceLike = (t: string | null) => t === 'choice' || t === 'single_choice';
  const questionsByType: Record<string, typeof allQuestions> = {
    choice: allQuestions.filter(q => isChoiceLike(q.questionType)),
    single_choice: allQuestions.filter(q => isChoiceLike(q.questionType)),
    multiple_choice: allQuestions.filter(q => q.questionType === 'multiple_choice'),
    fill: allQuestions.filter(q => q.questionType === 'fill'),
    essay: allQuestions.filter(q => q.questionType === 'essay'),
  };

  // 3. 按难度分类
  const questionsByDifficulty: Record<string, typeof allQuestions> = {
    easy: allQuestions.filter(q => q.difficulty === 'easy'),
    medium: allQuestions.filter(q => q.difficulty === 'medium'),
    hard: allQuestions.filter(q => q.difficulty === 'hard'),
    very_hard: allQuestions.filter(q => q.difficulty === 'very_hard'),
  };

  // 4. 单选题（选择题）选题：兼容 choice / single_choice 两种键
  const singleChoiceCount = typeDistribution.single_choice ?? typeDistribution.choice ?? 0;
  if (singleChoiceCount > 0) {
    const count = singleChoiceCount;
    const scorePerQuestion = scoreDistribution.single_choice ?? scoreDistribution.choice ?? 5;
    const selected = selectByDifficulty(
      questionsByType.single_choice,
      count,
      difficultyDistribution
    );

    selected.forEach(q => {
      selectedQuestions.push({
        id: q.id,
        questionId: q.id,
        questionNumber: questionNumber++,
        score: scorePerQuestion
      });
    });
  }

  // 4b. 多选题选题
  const multipleChoiceCount = typeDistribution.multiple_choice ?? 0;
  if (multipleChoiceCount > 0) {
    const count = multipleChoiceCount;
    const scorePerQuestion = scoreDistribution.multiple_choice ?? 5;
    const selected = selectByDifficulty(
      questionsByType.multiple_choice,
      count,
      difficultyDistribution
    );

    selected.forEach(q => {
      selectedQuestions.push({
        id: q.id,
        questionId: q.id,
        questionNumber: questionNumber++,
        score: scorePerQuestion
      });
    });
  }

  // 5. 填空题选题
  if (typeDistribution.fill && typeDistribution.fill > 0) {
    const count = typeDistribution.fill;
    const scorePerQuestion = scoreDistribution.fill || 10;
    const selected = selectByDifficulty(
      questionsByType.fill,
      count,
      difficultyDistribution
    );

    selected.forEach(q => {
      selectedQuestions.push({
        id: q.id,
        questionId: q.id,
        questionNumber: questionNumber++,
        score: scorePerQuestion
      });
    });
  }

  // 6. 解答题选题
  if (typeDistribution.essay && typeDistribution.essay > 0) {
    const count = typeDistribution.essay;
    const scorePerQuestion = scoreDistribution.essay || 15;
    const selected = selectByDifficulty(
      questionsByType.essay,
      count,
      difficultyDistribution
    );

    selected.forEach(q => {
      selectedQuestions.push({
        id: q.id,
        questionId: q.id,
        questionNumber: questionNumber++,
        score: scorePerQuestion
      });
    });
  }

  return selectedQuestions;
}

/**
 * 按难度分布选择题目
 */
function selectByDifficulty(
  questions: any[],
  count: number,
  distribution: ExamGenerationParams['difficultyDistribution']
): any[] {
  const selected: any[] = [];
  const used = new Set<number>();
  
  // 计算每种难度的题目数量
  const easyCount = Math.round(count * (distribution.easy || 0.3));
  const mediumCount = Math.round(count * (distribution.medium || 0.5));
  const hardCount = Math.round(count * (distribution.hard || 0.2));
  
  // 选择简单题
  const easyQuestions = questions.filter(q => q.difficulty === 'easy' && !used.has(q.id));
  for (let i = 0; i < Math.min(easyCount, easyQuestions.length); i++) {
    selected.push(easyQuestions[i]);
    used.add(easyQuestions[i].id);
  }
  
  // 选择中等题
  const mediumQuestions = questions.filter(q => q.difficulty === 'medium' && !used.has(q.id));
  for (let i = 0; i < Math.min(mediumCount, mediumQuestions.length); i++) {
    selected.push(mediumQuestions[i]);
    used.add(mediumQuestions[i].id);
  }
  
  // 选择困难题
  const hardQuestions = questions.filter(q => q.difficulty === 'hard' && !used.has(q.id));
  for (let i = 0; i < Math.min(hardCount, hardQuestions.length); i++) {
    selected.push(hardQuestions[i]);
    used.add(hardQuestions[i].id);
  }
  
  // 如果数量不够，补充其他题目
  while (selected.length < count) {
    const remaining = questions.filter(q => !used.has(q.id));
    if (remaining.length === 0) break;
    selected.push(remaining[0]);
    used.add(remaining[0].id);
  }
  
  return selected;
}

/**
 * 生成试卷
 */
export async function generateExam(
  params: ExamGenerationParams,
  creatorId: number,
  templateId?: number
): Promise<GeneratedExamResult> {
  // 1. 选择题目
  const questions = await selectQuestions(params);
  
  // 2. 计算总分
  const totalScore = questions.reduce((sum, q) => sum + q.score, 0);
  
  // 3. 保存到数据库
  const exam = await prisma.generatedExam.create({
    data: {
      templateId,
      title: params.name,
      totalScore,
      duration: params.duration,
      questions: JSON.stringify(questions),
      parameters: JSON.stringify(params),
      status: 'draft',
      creatorId
    }
  });
  
  return {
    id: exam.id,
    title: exam.title,
    totalScore: exam.totalScore,
    duration: exam.duration || undefined,
    questions,
    parameters: params
  };
}

/**
 * 预览试卷（不保存）
 * 返回题目详情（内容/题型/难度）供前端渲染预览卡片
 */
export async function previewExam(params: ExamGenerationParams): Promise<{
  questions: (SelectedQuestion & {
    content: string;
    questionType: string;
    difficulty: string | null;
    options: string | null;
    imageUrl: string | null;
  })[];
  totalScore: number;
  coverage: {
    difficultyDistribution: Record<string, number>;
    typeDistribution: Record<string, number>;
  };
}> {
  const questions = await selectQuestions(params);
  const totalScore = questions.reduce((sum, q) => sum + q.score, 0);

  // 获取题目详情以计算覆盖率
  const questionIds = questions.map(q => q.questionId);
  const questionDetails = await prisma.question.findMany({
    where: { id: { in: questionIds } }
  });
  const detailMap = new Map(questionDetails.map(q => [q.id, q]));

  // 合并题目详情到选题结果
  const enrichedQuestions = questions.map(q => {
    const detail = detailMap.get(q.questionId);
    return {
      ...q,
      content: detail?.content || '',
      questionType: detail?.questionType || 'unknown',
      difficulty: detail?.difficulty || null,
      options: detail?.options || null,
      imageUrl: detail?.imageUrl || null,
    };
  });

  // 计算难度分布
  const difficultyDistribution: Record<string, number> = {};
  questionDetails.forEach(q => {
    const diff = q.difficulty || 'medium';
    difficultyDistribution[diff] = (difficultyDistribution[diff] || 0) + 1;
  });

  // 计算题型分布
  const typeDistribution: Record<string, number> = {};
  questionDetails.forEach(q => {
    typeDistribution[q.questionType] = (typeDistribution[q.questionType] || 0) + 1;
  });

  return {
    questions: enrichedQuestions,
    totalScore,
    coverage: {
      difficultyDistribution,
      typeDistribution
    }
  };
}

/**
 * 替换试卷中的题目
 */
export async function replaceQuestion(
  examId: number,
  questionIndex: number,
  newQuestionId: number
): Promise<GeneratedExamResult> {
  const exam = await prisma.generatedExam.findUnique({
    where: { id: examId }
  });
  
  if (!exam) {
    throw new Error('Exam not found');
  }
  
  const questions: SelectedQuestion[] = JSON.parse(exam.questions);
  
  if (questionIndex < 0 || questionIndex >= questions.length) {
    throw new Error('Invalid question index');
  }
  
  // 获取新题目信息
  const newQuestion = await prisma.question.findUnique({
    where: { id: newQuestionId }
  });
  
  if (!newQuestion) {
    throw new Error('Question not found');
  }
  
  // 替换题目
  questions[questionIndex] = {
    id: newQuestion.id,
    questionId: newQuestion.id,
    questionNumber: questions[questionIndex].questionNumber,
    score: questions[questionIndex].score
  };
  
  // 更新数据库
  const updated = await prisma.generatedExam.update({
    where: { id: examId },
    data: {
      questions: JSON.stringify(questions)
    }
  });
  
  return {
    id: updated.id,
    title: updated.title,
    totalScore: updated.totalScore,
    duration: updated.duration || undefined,
    questions,
    parameters: JSON.parse(updated.parameters)
  };
}

/**
 * 获取试卷详情
 */
export async function getExam(examId: number): Promise<GeneratedExamResult | null> {
  const exam = await prisma.generatedExam.findUnique({
    where: { id: examId }
  });
  
  if (!exam) return null;
  
  return {
    id: exam.id,
    title: exam.title,
    totalScore: exam.totalScore,
    duration: exam.duration || undefined,
    questions: JSON.parse(exam.questions),
    parameters: JSON.parse(exam.parameters)
  };
}

/**
 * 获取用户的试卷列表
 */
export async function getExams(
  creatorId?: number,
  status?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ data: any[]; total: number }> {
  const where: any = {};
  if (creatorId) where.creatorId = creatorId;
  if (status) where.status = status;
  
  const [exams, total] = await Promise.all([
    prisma.generatedExam.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        creator: {
          select: { id: true, name: true, studentId: true }
        }
      }
    }),
    prisma.generatedExam.count({ where })
  ]);
  
  return { data: exams, total };
}

/**
 * 更新试卷状态
 */
export async function updateExamStatus(
  examId: number,
  status: string
): Promise<void> {
  await prisma.generatedExam.update({
    where: { id: examId },
    data: { status }
  });
}

/**
 * 删除试卷
 */
export async function deleteExam(examId: number): Promise<void> {
  await prisma.generatedExam.delete({
    where: { id: examId }
  });
}

/**
 * 保存为模板
 */
export async function saveAsTemplate(
  params: ExamGenerationParams,
  creatorId: number
): Promise<number> {
  const template = await prisma.examTemplate.create({
    data: {
      name: params.name,
      totalScore: params.totalScore,
      duration: params.duration,
      questionCount: 
        (params.typeDistribution.choice || 0) +
        (params.typeDistribution.fill || 0) +
        (params.typeDistribution.essay || 0),
      typeDistribution: JSON.stringify(params.typeDistribution),
      difficultyDistribution: JSON.stringify(params.difficultyDistribution),
      scoreDistribution: JSON.stringify(params.scoreDistribution),
      creatorId
    }
  });

  return template.id;
}

/**
 * 获取模板列表
 */
export async function getTemplates(): Promise<any[]> {
  return prisma.examTemplate.findMany({
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' }
    ],
    include: {
      creator: {
        select: { id: true, name: true }
      }
    }
  });
}

/**
 * 从模板生成试卷
 */
export async function generateFromTemplate(
  templateId: number,
  creatorId: number,
  customParams?: Partial<ExamGenerationParams>
): Promise<GeneratedExamResult> {
  const template = await prisma.examTemplate.findUnique({
    where: { id: templateId }
  });
  
  if (!template) {
    throw new Error('Template not found');
  }
  
  const params: ExamGenerationParams = {
    name: customParams?.name || template.name,
    totalScore: customParams?.totalScore || template.totalScore,
    duration: customParams?.duration || template.duration || undefined,
    typeDistribution: customParams?.typeDistribution || JSON.parse(template.typeDistribution),
    difficultyDistribution: customParams?.difficultyDistribution || JSON.parse(template.difficultyDistribution),
    scoreDistribution: customParams?.scoreDistribution || JSON.parse(template.scoreDistribution)
  };
  
  return generateExam(params, creatorId, templateId);
}