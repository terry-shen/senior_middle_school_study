/**
 * Subject Service — 学科字典管理
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SubjectInput {
  code: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  order?: number;
  isActive?: boolean;
}

export async function getSubjects(includeInactive: boolean = true) {
  return prisma.subject.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
}

export async function createSubject(data: SubjectInput) {
  const exists = await prisma.subject.findUnique({ where: { code: data.code } });
  if (exists) {
    throw new SubjectConflictError(`学科 code「${data.code}」已存在`);
  }
  return prisma.subject.create({ data });
}

export async function updateSubject(id: number, data: Partial<SubjectInput>) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) throw new SubjectNotFoundError('学科不存在');
  // code 不可修改（已关联数据的标识符）
  const { code: _ignored, ...rest } = data;
  return prisma.subject.update({ where: { id }, data: rest });
}

export async function deleteSubject(id: number) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) throw new SubjectNotFoundError('学科不存在');
  const inUse = await checkSubjectInUse(id);
  if (inUse.used) {
    throw new SubjectConflictError(`该学科已关联 ${inUse.total} 条业务数据，无法删除（可改为停用）`);
  }
  await prisma.subject.delete({ where: { id } });
}

export async function checkSubjectInUse(id: number) {
  const [papers, questions, examSessions, wrongQuestions, knowledgePoints] = await Promise.all([
    prisma.examPaper.count({ where: { subjectId: id } }),
    prisma.question.count({ where: { subjectId: id } }),
    prisma.examSession.count({ where: { subjectId: id } }),
    prisma.studentWrongQuestion.count({ where: { subjectId: id } }),
    prisma.knowledgePoint.count({ where: { subjectId: id } }),
  ]);
  const total = papers + questions + examSessions + wrongQuestions + knowledgePoints;
  return { used: total > 0, total, breakdown: { papers, questions, examSessions, wrongQuestions, knowledgePoints } };
}

/** 通过 Subject.code 查 id（路由层把 autoExtractMetadata 的 subjectCode 转成 subjectId 用） */
export async function findSubjectIdByCode(code: string): Promise<number | null> {
  const s = await prisma.subject.findUnique({ where: { code }, select: { id: true } });
  return s?.id ?? null;
}

export class SubjectConflictError extends Error {}
export class SubjectNotFoundError extends Error {}
