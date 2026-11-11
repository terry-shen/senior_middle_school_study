/**
 * 学生学习服务（v3）：学科目录、视频主线课程、小节资源三档查询、学习进度与最近打开
 */
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { detectSubjectFromText } from './netdisk-index-service';

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
  { key: 'video', label: '主线视频', kinds: ['video'] },
  { key: 'lecture', label: '讲义', kinds: ['lecture', 'ppt', 'plan'] },
  { key: 'practice', label: '练习', kinds: ['practice'] },
  { key: 'exam', label: '试卷资料', kinds: ['exam'] },
] as const;

export type ResourceMode = 'featured' | 'more' | 'manage';

// ============ 学科目录 ============

export interface LearningSubject {
  id: number; code: string; name: string; icon: string | null; color: string | null; sectionCount: number;
}

export async function listLearningSubjects(): Promise<LearningSubject[]> {
  const subjects = await prisma.subject.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    select: { id: true, code: true, name: true, icon: true, color: true },
  });
  const counts = await prisma.section.groupBy({
    by: ['chapterId'],
    _count: { _all: true },
  });
  const chapters = await prisma.chapter.findMany({
    select: { id: true, textbook: { select: { subjectId: true } } },
  });
  const subjectOfChapter = new Map<number, number>();
  for (const c of chapters) subjectOfChapter.set(c.id, c.textbook.subjectId);
  const bySubject = new Map<number, number>();
  for (const row of counts) {
    const sid = subjectOfChapter.get(row.chapterId);
    if (sid == null) continue;
    bySubject.set(sid, (bySubject.get(sid) || 0) + row._count._all);
  }
  return subjects.map(s => ({ ...s, sectionCount: bySubject.get(s.id) || 0 }));
}

// ============ 小节资源 ============

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
    const total = await prisma.netdiskAsset.count({ where: { ...baseWhere, isPinned: false } });
    return {
      section: { id: section.id, title: section.title, chapterTitle: section.chapter.title, textbookName: section.chapter.textbook.name },
      groups,
      pinnedCount: pinned.length,
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
  const progress = await prisma.studentLearningProgress.upsert({
    where: { studentId },
    create: { studentId, sectionId, assetId: assetId ?? null },
    update: { sectionId, assetId: assetId ?? null },
  });
  await prisma.studentAssetOpen.create({ data: { studentId, sectionId, assetId: assetId ?? null } });
  // 仅保留最近 200 条访问记录
  const keep = await prisma.studentAssetOpen.findMany({
    where: { studentId },
    orderBy: { openedAt: 'desc' },
    take: 200,
    select: { id: true },
  });
  if (keep.length === 200) {
    await prisma.studentAssetOpen.deleteMany({
      where: { studentId, id: { lt: keep[keep.length - 1].id } },
    });
  }
  return progress;
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
    subjectId: row.section.chapter.textbook.subjectId,
    sectionTitle: row.section.title,
    chapterTitle: row.section.chapter.title,
    textbookName: row.section.chapter.textbook.name,
    assetId: row.assetId,
    assetName: row.asset ? row.asset.name : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface RecentOpen {
  sectionId: number; sectionTitle: string; chapterTitle: string; textbookName: string;
  assetId: number | null; assetName: string | null; openedAt: string;
}

export async function getRecentOpens(studentId: number, limit = 5): Promise<RecentOpen[]> {
  const rows = await prisma.studentAssetOpen.findMany({
    where: { studentId },
    orderBy: { openedAt: 'desc' },
    take: 40,
    include: {
      section: { include: { chapter: { include: { textbook: true } } } },
      asset: true,
    },
  });
  const out: RecentOpen[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.sectionId}:${r.assetId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      sectionId: r.sectionId,
      sectionTitle: r.section.title,
      chapterTitle: r.section.chapter.title,
      textbookName: r.section.chapter.textbook.name,
      assetId: r.assetId,
      assetName: r.asset?.name ?? null,
      openedAt: r.openedAt.toISOString(),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** 各学科的已浏览小节数（去重） */
export async function getViewedSectionCounts(studentId: number): Promise<Record<number, number>> {
  const rows = await prisma.studentAssetOpen.findMany({
    where: { studentId },
    select: { sectionId: true },
    distinct: ['sectionId'],
  });
  if (!rows.length) return {};
  const sections = await prisma.section.findMany({
    where: { id: { in: rows.map(r => r.sectionId) } },
    select: { id: true, chapter: { select: { textbook: { select: { subjectId: true } } } } },
  });
  const out: Record<number, number> = {};
  for (const s of sections) {
    const sid = s.chapter.textbook.subjectId;
    out[sid] = (out[sid] || 0) + 1;
  }
  return out;
}

// ============ 视频主线课程（系列 → 课程章节 → 视频 + 关联教材小节） ============

export interface VideoSeriesItem { id: number; name: string; courseNo: number | null; fsId: string | null; size: string | null }
export interface CourseSectionNode {
  id: number; title: string; textbookName: string; chapterTitle: string; resourceCount: number;
}
export interface VideoSeriesGroup { tag: string; videos: VideoSeriesItem[]; sections: CourseSectionNode[] }
export interface VideoSeries { series: string; groups: VideoSeriesGroup[]; total: number }

/** 教材章节 → 课程章节（阿不体系）的归并规则；顺序敏感 */
const CHAPTER_TAG_RULES: Array<[RegExp, string]> = [
  [/三角函数/, '三角函数'],
  [/集合|常用逻辑/, '集合与逻辑'],
  [/不等式/, '不等式'],
  [/函数的概念与性质|指数函数与对数函数/, '函数'],
  [/平面向量/, '向量'],
  [/复数/, '复数'],
  [/立体几何|空间向量/, '立体几何'],
  [/统计|概率/, '概率统计'],
  [/直线和圆/, '直线和圆'],
  [/圆锥曲线/, '圆曲'],
  [/数列/, '数列'],
  [/导数/, '导数'],
  [/计数原理|排列组合/, '排列组合'],
];

const TAG_ORDER = [
  '初高衔接', '集合与逻辑', '不等式', '函数', '三角函数', '向量', '数列', '立体几何',
  '直线和圆', '圆曲', '导数', '概率统计', '排列组合', '复数', '高考最后十课', '其他',
];

function resolveTagForChapter(chapterTitle: string): string | null {
  for (const [re, tag] of CHAPTER_TAG_RULES) {
    if (re.test(chapterTitle)) return tag;
  }
  return null;
}

const BOOK_ORDER = [
  '必修第一册', '必修第二册', '必修第三册', '选择性必修第一册', '选择性必修第二册', '选择性必修第三册',
  '必修1 分子与细胞', '必修2 遗传与进化', '选择性必修1 稳态与调节', '选择性必修2 生物与环境', '选择性必修3 生物技术与工程',
];
const PHYSICS_TAG_ALIASES: Array<[RegExp, string]> = [
  [/高中物理必修一|运动的描述|匀变速直线运动|弹簧专题/, '必修第一册'],
  [/高中物理必修二/, '必修第二册'],
  [/高中物理选修3-1|选修3-1/, '必修第三册'],
  [/选修3-2|电磁感应/, '选择性必修第二册'],
  [/高中物理选修3-5|动量/, '选择性必修第一册'],
];
const BIOLOGY_BOOK_PATTERNS: Array<[RegExp, string]> = [
  [/选择性必修三|选择性必修3/, '选择性必修3 生物技术与工程'],
  [/选择性必修二|选择性必修2/, '选择性必修2 生物与环境'],
  [/选择性必修一|选择性必修1/, '选择性必修1 稳态与调节'],
  [/必修二|必修2/, '必修2 遗传与进化'],
  [/必修一|必修1/, '必修1 分子与细胞'],
];
function normalizeVideoTag(subjectCode: string | null, rawTag: string, videoName: string): string {
  if (subjectCode === 'physics') {
    for (const [re, name] of PHYSICS_TAG_ALIASES) if (re.test(rawTag)) return name;
  }
  if (subjectCode === 'biology') {
    for (const [re, name] of BIOLOGY_BOOK_PATTERNS) if (re.test(videoName)) return name;
  }
  return rawTag;
}
function resolveSectionTag(subjectCode: string | null, chapterTitle: string, textbookName: string): string | null {
  if (subjectCode === 'physics' || subjectCode === 'biology' || subjectCode === 'chemistry') return textbookName || null;
  return resolveTagForChapter(chapterTitle);
}
const TAIL_TAGS = ['其他', '高考最后十课', '最后十课'];
const isTailTag = (tag: string) => TAIL_TAGS.some(t => tag.includes(t));

function compareGroups(a: VideoSeriesGroup, b: VideoSeriesGroup): number {
  const ta = isTailTag(a.tag) ? 1 : 0, tb = isTailTag(b.tag) ? 1 : 0;
  if (ta !== tb) return ta - tb;
  const ba = BOOK_ORDER.indexOf(a.tag), bb = BOOK_ORDER.indexOf(b.tag);
  if (ba >= 0 && bb >= 0 && ba !== bb) return ba - bb;
  if (ba >= 0 && bb < 0) return -1;
  if (bb >= 0 && ba < 0) return 1;
  const ia = TAG_ORDER.indexOf(a.tag), ib = TAG_ORDER.indexOf(b.tag);
  if (ia >= 0 && ib >= 0 && ia !== ib) return ia - ib;
  if (ia >= 0 && ib < 0) return -1;
  if (ib >= 0 && ia < 0) return 1;
  const na = Math.min(...a.videos.map(v => v.courseNo ?? 9999));
  const nb = Math.min(...b.videos.map(v => v.courseNo ?? 9999));
  if (na !== nb) return na - nb;
  if (a.videos.length !== b.videos.length) return b.videos.length - a.videos.length;
  return a.tag.localeCompare(b.tag, 'zh-CN');
}

function courseNoOf(name: string): number | null {
  const m1 = name.match(/^p(\d+)/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = name.match(/^\s*(\d{1,3})\./);
  return m2 ? parseInt(m2[1], 10) : null;
}

function tagOfName(name: string): string {
  const m = name.match(/【([^】]+)】/);
  return m ? m[1] : '其他';
}

function seriesOfPath(p: string): string {
  const parts = p.split('/');
  const i = parts.findIndex(x => x.includes('视频教学'));
  return i >= 0 && parts[i + 1] ? parts[i + 1] : '其他';
}

export async function getVideoSeries(
  studentId: number,
  subjectId?: number,
): Promise<{ series: VideoSeries[]; total: number }> {
  let subjectCode: string | null = null;
  if (subjectId) {
    const sub = await prisma.subject.findUnique({ where: { id: subjectId }, select: { code: true } });
    subjectCode = sub?.code ?? null;
  }

  const videoRows = await prisma.netdiskAsset.findMany({
    where: { assetKind: 'video', status: 'active' },
    select: { id: true, name: true, path: true, fsId: true, size: true, sectionId: true },
    orderBy: { id: 'asc' },
  });

  const sectionRows = await prisma.section.findMany({
    where: subjectId ? { chapter: { textbook: { subjectId } } } : undefined,
    select: { id: true, title: true, chapter: { select: { title: true, textbook: { select: { name: true } } } } },
    orderBy: { id: 'asc' },
  });
  const resCounts = await prisma.netdiskAsset.groupBy({
    by: ['sectionId'],
    where: { ...STUDENT_VISIBLE, sectionId: { not: null } },
    _count: { _all: true },
  });
  const resMap = new Map(resCounts.map(r => [r.sectionId as number, r._count._all]));
  const sectionBook = new Map<number, string>();
  for (const s of sectionRows) sectionBook.set(s.id, s.chapter?.textbook?.name || '');

  const sectionsByTag = new Map<string, CourseSectionNode[]>();
  for (const s of sectionRows) {
    const tag = resolveSectionTag(subjectCode, s.chapter?.title || '', s.chapter?.textbook?.name || '');
    if (!tag) continue;
    if (!sectionsByTag.has(tag)) sectionsByTag.set(tag, []);
    sectionsByTag.get(tag)!.push({
      id: s.id,
      title: s.title,
      textbookName: s.chapter?.textbook?.name || '',
      chapterTitle: s.chapter?.title || '',
      resourceCount: resMap.get(s.id) || 0,
    });
  }
  for (const list of sectionsByTag.values()) list.sort((a, b) => a.id - b.id);

  const tree = new Map<string, Map<string, VideoSeriesItem[]>>();
  let total = 0;
  for (const r of videoRows) {
    const series = seriesOfPath(r.path);
    const dirPath = r.path.replace(/\/[^/]+$/, '');
    const code = detectSubjectFromText(dirPath) || detectSubjectFromText(series);
    if (subjectCode && code !== subjectCode) continue;
    const rawTag = tagOfName(r.name);
    const normalized = normalizeVideoTag(subjectCode, rawTag, r.name);
    let tag = normalized;
    if (subjectCode && subjectCode !== 'math') {
      const book = r.sectionId != null ? sectionBook.get(r.sectionId) : '';
      tag = book || (BOOK_ORDER.includes(normalized) ? normalized : '其他');
    }
    if (!tree.has(series)) tree.set(series, new Map());
    const g = tree.get(series)!;
    if (!g.has(tag)) g.set(tag, []);
    g.get(tag)!.push({
      id: r.id,
      name: r.name,
      courseNo: courseNoOf(r.name),
      fsId: r.fsId != null ? String(r.fsId) : null,
      size: r.size != null ? String(r.size) : null,
    });
    total++;
  }

  const seriesList: VideoSeries[] = [...tree.entries()].map(([series, groups]) => {
    const groupList: VideoSeriesGroup[] = [...groups.entries()].map(([tag, videos]) => ({
      tag,
      videos: videos.sort((a, b) => (a.courseNo ?? 9999) - (b.courseNo ?? 9999) || a.id - b.id),
      sections: sectionsByTag.get(tag) || [],
    }));
    if (subjectCode) {
      for (const [tag, sections] of sectionsByTag.entries()) {
        if (!groupList.some(g => g.tag === tag)) groupList.push({ tag, videos: [], sections });
      }
    }
    groupList.sort(compareGroups);
    return { series, groups: groupList, total: groupList.reduce((n, g) => n + g.videos.length, 0) };
  });

  if (subjectCode) {
    const mainSeries = seriesList.filter(s => s.series !== '其他');
    const otherSeries = seriesList.find(s => s.series === '其他');
    if (mainSeries.length === 1 && otherSeries) {
      const target = mainSeries[0];
      for (const g of otherSeries.groups) {
        const exist = target.groups.find(x => x.tag === g.tag);
        if (exist) {
          exist.videos.push(...g.videos);
          exist.videos.sort((a, b) => (a.courseNo ?? 9999) - (b.courseNo ?? 9999) || a.id - b.id);
        } else {
          target.groups.push(g);
        }
      }
      target.groups.sort(compareGroups);
      target.total = target.groups.reduce((n, g) => n + g.videos.length, 0);
      return { series: mainSeries, total: target.total };
    }
  }

  seriesList.sort((a, b) => a.series.localeCompare(b.series, 'zh-CN'));
  return { series: seriesList, total };
}
