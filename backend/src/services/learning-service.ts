/**
 * 学生学习服务（M4）：章节资源三档查询、学习进度、章节地图、我的学习工作台
 */
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const STUDENT_VISIBLE: Prisma.NetdiskAssetWhereInput = {
  status: 'active',
  audience: { in: ['student', 'both'] },
  mapConfirmed: true,
};

export interface AssetLite {
  id: number; fsId: string | null; name: string; ext: string | null; size: string | null;
  assetKind: string; audience: string; year: number | null; region: string | null; series: string | null;
  isPinned: boolean; status: string; mapConfirmed: boolean;
}

function toLite(a: {
  id: number; fsId: bigint | null; name: string; ext: string | null; size: bigint | null;
  assetKind: string; audience: string; year: number | null; region: string | null; series: string | null;
  isPinned: boolean; status: string; mapConfirmed: boolean;
}): AssetLite {
  return {
    id: a.id, fsId: a.fsId != null ? String(a.fsId) : null, name: a.name, ext: a.ext,
    size: a.size != null ? String(a.size) : null, assetKind: a.assetKind, audience: a.audience,
    year: a.year, region: a.region, series: a.series, isPinned: a.isPinned, status: a.status,
    mapConfirmed: a.mapConfirmed,
  };
}

export const RESOURCE_GROUPS = [
  { key: 'video', label: '视频', kinds: ['video'] },
  { key: 'lecture', label: '讲义', kinds: ['lecture', 'ppt', 'plan'] },
  { key: 'practice', label: '练习', kinds: ['practice'] },
  { key: 'exam', label: '试卷资料', kinds: ['exam'] },
] as const;

export type ResourceMode = 'featured' | 'more' | 'manage';

export async function getSectionResources(sectionId: number, mode: ResourceMode, page = 1, limit = 12) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { chapter: { include: { textbook: true } } },
  });
  if (!section) throw Object.assign(new Error('小节不存在'), { statusCode: 404 });

  const baseWhere = mode === 'manage' ? { sectionId } : { sectionId, ...STUDENT_VISIBLE };

  if (mode === 'featured') {
    const pinned = await prisma.netdiskAsset.findMany({
      where: { ...baseWhere, isPinned: true },
      orderBy: { id: 'asc' },
    });
    const groups = RESOURCE_GROUPS.map(g => ({
      key: g.key,
      label: g.label,
      items: pinned.filter(a => (g.kinds as readonly string[]).includes(a.assetKind)).slice(0, 5).map(toLite),
    }));
    const pinnedCount = pinned.length;
    const total = await prisma.netdiskAsset.count({ where: { ...baseWhere, isPinned: false } });
    return {
      section: { id: section.id, title: section.title, chapterTitle: section.chapter.title, textbookName: section.chapter.textbook.name },
      groups,
      pinnedCount,
      moreCount: total,
    };
  }

  const p = Math.max(1, page);
  const l = Math.min(100, Math.max(1, limit));
  const where = { ...baseWhere, ...(mode === 'more' ? { isPinned: false } : {}) };
  const [total, data] = await Promise.all([
    prisma.netdiskAsset.count({ where }),
    prisma.netdiskAsset.findMany({
      where,
      orderBy: [{ assetKind: 'asc' }, { id: 'asc' }],
      skip: (p - 1) * l,
      take: l,
    }),
  ]);
  return {
    section: { id: section.id, title: section.title, chapterTitle: section.chapter.title, textbookName: section.chapter.textbook.name },
    data: data.map(toLite),
    pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) },
  };
}

/** 本节试卷（整卷，学生可下载） */
export async function getSectionPapers(sectionId: number) {
  const papers = await prisma.examPaper.findMany({
    where: { sectionId },
    orderBy: { id: 'desc' },
    take: 20,
    select: {
      id: true, title: true, year: true, region: true, examType: true, totalScore: true,
      duration: true, purpose: true, pdfUrl: true, status: true,
      subject: { select: { id: true, name: true } },
    },
  });
  return papers;
}

/** 本节错题（当前学生） */
export async function getSectionWrongQuestions(sectionId: number, studentId: number) {
  return prisma.studentWrongQuestion.findMany({
    where: { sectionId, studentId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true, content: true, imageUrl: true, questionType: true, difficulty: true,
      myAnswer: true, correctAnswer: true, analysis: true, reviewStatus: true, createdAt: true,
    },
  });
}

// ============ 学习进度 ============
export async function recordProgress(studentId: number, sectionId: number, assetId?: number | null) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) throw Object.assign(new Error('小节不存在'), { statusCode: 404 });
  if (assetId != null) {
    const asset = await prisma.netdiskAsset.findUnique({ where: { id: assetId }, select: { sectionId: true } });
    if (!asset) throw Object.assign(new Error('资源不存在'), { statusCode: 404 });
    if (asset.sectionId != null && asset.sectionId !== sectionId) {
      throw Object.assign(new Error('资源不属于该小节'), { statusCode: 400 });
    }
  }
  return prisma.studentLearningProgress.upsert({
    where: { studentId },
    create: { studentId, sectionId, assetId: assetId ?? null },
    update: { sectionId, assetId: assetId ?? null },
  });
}

export async function getProgress(studentId: number) {
  const row = await prisma.studentLearningProgress.findUnique({
    where: { studentId },
    include: {
      section: { include: { chapter: { include: { textbook: true } } } },
      asset: true,
    },
  });
  if (!row) return null;
  return {
    sectionId: row.sectionId,
    sectionTitle: row.section.title,
    chapterTitle: row.section.chapter.title,
    textbookName: row.section.chapter.textbook.name,
    assetId: row.assetId,
    assetName: row.asset ? row.asset.name : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============ 章节地图（含资源数与薄弱标记） ============
export async function getLearningMap(studentId: number, subjectId?: number) {
  const sections = await prisma.section.findMany({
    where: subjectId ? { chapter: { textbook: { subjectId } } } : undefined,
    include: { chapter: { include: { textbook: true } } },
    orderBy: [{ chapter: { textbook: { order: 'asc' } } }, { chapter: { order: 'asc' } }, { order: 'asc' }],
  });
  const ids = sections.map(s => s.id);
  const [resCounts, weakCounts, paperCounts, progress] = await Promise.all([
    prisma.netdiskAsset.groupBy({ by: ['sectionId'], where: { sectionId: { in: ids }, ...STUDENT_VISIBLE }, _count: { _all: true } }),
    prisma.studentWrongQuestion.groupBy({ by: ['sectionId'], where: { studentId, sectionId: { in: ids }, reviewStatus: { not: 'mastered' } }, _count: { _all: true } }),
    prisma.examPaper.groupBy({ by: ['sectionId'], where: { sectionId: { in: ids } }, _count: { _all: true } }),
    prisma.studentLearningProgress.findUnique({ where: { studentId }, select: { sectionId: true } }),
  ]);
  const rMap = new Map(resCounts.map(r => [r.sectionId as number, r._count?._all ?? 0]));
  const wMap = new Map(weakCounts.map(r => [r.sectionId as number, r._count?._all ?? 0]));
  const pMap = new Map(paperCounts.map(r => [r.sectionId as number, r._count?._all ?? 0]));

  const books = new Map<number, {
    id: number; name: string; edition: string; grade: string | null; order: number; chapters: Map<number, {
      id: number; order: number; title: string; sections: {
        id: number; order: number; title: string; resourceCount: number; paperCount: number; weakCount: number; isCurrent: boolean;
      }[];
    }>;
  }>();

  for (const sec of sections) {
    const tb = sec.chapter.textbook;
    let book = books.get(tb.id);
    if (!book) {
      book = { id: tb.id, name: tb.name, edition: tb.edition, grade: tb.grade, order: tb.order, chapters: new Map() };
      books.set(tb.id, book);
    }
    let ch = book.chapters.get(sec.chapter.id);
    if (!ch) {
      ch = { id: sec.chapter.id, order: sec.chapter.order, title: sec.chapter.title, sections: [] };
      book.chapters.set(sec.chapter.id, ch);
    }
    ch.sections.push({
      id: sec.id, order: sec.order, title: sec.title,
      resourceCount: rMap.get(sec.id) ?? 0,
      paperCount: pMap.get(sec.id) ?? 0,
      weakCount: wMap.get(sec.id) ?? 0,
      isCurrent: progress?.sectionId === sec.id,
    });
  }

  return [...books.values()]
    .sort((a, b) => a.order - b.order)
    .map(b => ({
      id: b.id, name: b.name, edition: b.edition, grade: b.grade,
      chapters: [...b.chapters.values()].sort((x, y) => x.order - y.order),
    }));
}

// ============ 我的学习工作台 ============
export async function getWorkbench(studentId: number, subjectId?: number) {
  const [progress, pendingExams, weakCount, weakTop] = await Promise.all([
    getProgress(studentId),
    prisma.examSession.findMany({
      where: {
        status: { in: ['published', 'ongoing'] },
        ...(subjectId ? { subjectId } : {}),
        assignments: { some: { studentId } },
        submissions: { none: { studentId, status: { in: ['submitted', 'graded'] } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, mode: true, totalScore: true, duration: true, status: true, createdAt: true,
        paper: { select: { id: true, title: true, purpose: true } } },
    }),
    prisma.studentWrongQuestion.count({
      where: { studentId, reviewStatus: { not: 'mastered' }, ...(subjectId ? { subjectId } : {}) },
    }),
    prisma.studentWrongQuestion.findMany({
      where: { studentId, reviewStatus: { not: 'mastered' }, ...(subjectId ? { subjectId } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { id: true, content: true, questionType: true, sectionId: true, createdAt: true },
    }),
  ]);
  return { progress, pendingExams, weakCount, weakTop };
}
