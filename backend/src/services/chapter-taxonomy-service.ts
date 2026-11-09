import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TaxonomyError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'TaxonomyError';
    this.statusCode = statusCode;
  }
}

export interface SectionNode {
  id: number;
  order: number;
  title: string;
  resourceCount: number;
  paperCount: number;
  wrongQuestionCount: number;
}

export interface ChapterNode {
  id: number;
  order: number;
  title: string;
  sectionCount: number;
  sections: SectionNode[];
}

export interface TextbookNode {
  id: number;
  name: string;
  edition: string;
  grade: string | null;
  order: number;
  chapterCount: number;
  sectionCount: number;
  chapters: ChapterNode[];
}

/** 教材 → 章 → 节 树（含每个节的资源/试卷/错题计数） */
export async function getTaxonomyTree(subjectId?: number): Promise<TextbookNode[]> {
  const textbooks = await prisma.textbook.findMany({
    where: subjectId ? { subjectId } : undefined,
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    include: {
      chapters: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: {
          sections: {
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            include: {
              _count: {
                select: { videoResources: true, papers: true, wrongQuestions: true },
              },
            },
          },
        },
      },
    },
  });

  return textbooks.map((t) => ({
    id: t.id,
    name: t.name,
    edition: t.edition,
    grade: t.grade,
    order: t.order,
    chapterCount: t.chapters.length,
    sectionCount: t.chapters.reduce((acc, c) => acc + c.sections.length, 0),
    chapters: t.chapters.map((c) => ({
      id: c.id,
      order: c.order,
      title: c.title,
      sectionCount: c.sections.length,
      sections: c.sections.map((s) => ({
        id: s.id,
        order: s.order,
        title: s.title,
        resourceCount: s._count.videoResources,
        paperCount: s._count.papers,
        wrongQuestionCount: s._count.wrongQuestions,
      })),
    })),
  }));
}

/** 扁平节列表（学生端下拉/映射工作台用） */
export async function listSectionsFlat(subjectId?: number) {
  const rows = await prisma.section.findMany({
    where: subjectId ? { chapter: { textbook: { subjectId } } } : undefined,
    orderBy: [
      { chapter: { textbook: { order: 'asc' } } },
      { chapter: { order: 'asc' } },
      { order: 'asc' },
    ],
    include: { chapter: { include: { textbook: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    chapterId: s.chapterId,
    chapterTitle: s.chapter.title,
    textbookId: s.chapter.textbookId,
    textbookName: s.chapter.textbook.name,
    label: `${s.chapter.textbook.name} / ${s.chapter.title} / ${s.title}`,
  }));
}

// ---------- Textbook ----------
export async function createTextbook(data: {
  subjectId: number;
  name: string;
  edition?: string;
  grade?: string | null;
  order?: number;
}) {
  const name = (data.name || '').trim();
  if (!name) throw new TaxonomyError('教材名称不能为空');
  const edition = (data.edition || '人教A').trim();
  const exists = await prisma.textbook.findUnique({
    where: { subjectId_edition_name: { subjectId: data.subjectId, edition, name } },
  });
  if (exists) throw new TaxonomyError('同版本下已存在同名教材', 409);
  return prisma.textbook.create({
    data: {
      subjectId: data.subjectId,
      name,
      edition,
      grade: data.grade ?? null,
      order: data.order ?? 0,
    },
  });
}

export async function updateTextbook(
  id: number,
  data: { name?: string; edition?: string; grade?: string | null; order?: number }
) {
  const tb = await prisma.textbook.findUnique({ where: { id } });
  if (!tb) throw new TaxonomyError('教材不存在', 404);
  return prisma.textbook.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.edition !== undefined ? { edition: data.edition.trim() } : {}),
      ...(data.grade !== undefined ? { grade: data.grade } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
  });
}

export async function deleteTextbook(id: number) {
  const tb = await prisma.textbook.findUnique({ where: { id }, include: { chapters: true } });
  if (!tb) throw new TaxonomyError('教材不存在', 404);
  if (tb.chapters.length > 0) throw new TaxonomyError('该教材下仍有章节，请先删除章节', 400);
  await prisma.textbook.delete({ where: { id } });
  return { success: true, id };
}

// ---------- Chapter ----------
export async function createChapter(data: { textbookId: number; title: string; order?: number }) {
  const tb = await prisma.textbook.findUnique({ where: { id: data.textbookId } });
  if (!tb) throw new TaxonomyError('教材不存在', 404);
  const title = (data.title || '').trim();
  if (!title) throw new TaxonomyError('章节标题不能为空');
  let order = data.order;
  if (order === undefined) {
    const last = await prisma.chapter.findFirst({
      where: { textbookId: data.textbookId },
      orderBy: { order: 'desc' },
    });
    order = (last?.order ?? 0) + 1;
  }
  const dup = await prisma.chapter.findUnique({
    where: { textbookId_order: { textbookId: data.textbookId, order } },
  });
  if (dup) throw new TaxonomyError(`该教材下已有第 ${order} 章，请换一个序号`, 409);
  return prisma.chapter.create({ data: { textbookId: data.textbookId, title, order } });
}

export async function updateChapter(id: number, data: { title?: string; order?: number }) {
  const ch = await prisma.chapter.findUnique({ where: { id } });
  if (!ch) throw new TaxonomyError('章节不存在', 404);
  if (data.order !== undefined && data.order !== ch.order) {
    const dup = await prisma.chapter.findUnique({
      where: { textbookId_order: { textbookId: ch.textbookId, order: data.order } },
    });
    if (dup) throw new TaxonomyError(`该教材下已有第 ${data.order} 章，请换一个序号`, 409);
  }
  return prisma.chapter.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
  });
}

export async function deleteChapter(id: number) {
  const ch = await prisma.chapter.findUnique({ where: { id }, include: { sections: true } });
  if (!ch) throw new TaxonomyError('章节不存在', 404);
  if (ch.sections.length > 0) throw new TaxonomyError('该章下仍有小节，请先删除小节', 400);
  await prisma.chapter.delete({ where: { id } });
  return { success: true, id };
}

// ---------- Section ----------
export async function createSection(data: { chapterId: number; title: string; order?: number }) {
  const ch = await prisma.chapter.findUnique({ where: { id: data.chapterId } });
  if (!ch) throw new TaxonomyError('章节不存在', 404);
  const title = (data.title || '').trim();
  if (!title) throw new TaxonomyError('小节标题不能为空');
  let order = data.order;
  if (order === undefined) {
    const last = await prisma.section.findFirst({
      where: { chapterId: data.chapterId },
      orderBy: { order: 'desc' },
    });
    order = (last?.order ?? 0) + 1;
  }
  const dup = await prisma.section.findUnique({
    where: { chapterId_order: { chapterId: data.chapterId, order } },
  });
  if (dup) throw new TaxonomyError(`该章下已有第 ${order} 节，请换一个序号`, 409);
  return prisma.section.create({ data: { chapterId: data.chapterId, title, order } });
}

export async function updateSection(id: number, data: { title?: string; order?: number }) {
  const sec = await prisma.section.findUnique({ where: { id } });
  if (!sec) throw new TaxonomyError('小节不存在', 404);
  if (data.order !== undefined && data.order !== sec.order) {
    const dup = await prisma.section.findUnique({
      where: { chapterId_order: { chapterId: sec.chapterId, order: data.order } },
    });
    if (dup) throw new TaxonomyError(`该章下已有第 ${data.order} 节，请换一个序号`, 409);
  }
  return prisma.section.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
  });
}

/** 统计被引用数量：资源 / 试卷 / 错题 */
export async function countSectionReferences(sectionId: number) {
  const [resources, papers, wrongQuestions] = await Promise.all([
    prisma.videoResource.count({ where: { sectionId } }),
    prisma.examPaper.count({ where: { sectionId } }),
    prisma.studentWrongQuestion.count({ where: { sectionId } }),
  ]);
  return { resources, papers, wrongQuestions, total: resources + papers + wrongQuestions };
}

export async function deleteSection(id: number) {
  const sec = await prisma.section.findUnique({ where: { id } });
  if (!sec) throw new TaxonomyError('小节不存在', 404);
  const refs = await countSectionReferences(id);
  if (refs.total > 0) {
    throw new TaxonomyError(
      `该小节已被引用（资源 ${refs.resources} / 试卷 ${refs.papers} / 错题 ${refs.wrongQuestions}），请先解除关联`,
      409
    );
  }
  await prisma.section.delete({ where: { id } });
  return { success: true, id };
}
