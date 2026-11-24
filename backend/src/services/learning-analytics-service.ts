import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 只保留资源级事件与会话事件：心跳与旧的视频/停留事件已废弃 */
export const EVENT_TYPES = ['asset_open', 'asset_session', 'download', 'login', 'logout'] as const;
export type LearningEventType = (typeof EVENT_TYPES)[number];

const TZ_OFFSET_MS = 8 * 3600 * 1000;
const SESSION_MAX_SEC = 7200;
const SESSION_MIN_SEC = 5;
const DOC_DWELL_MAX_SEC = 1800;
const VIDEO_DWELL_FACTOR = 1.2;
const DOWNLOAD_DEDUPE_MS = 60 * 1000;

function clampSec(v: unknown, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function localDate(d: Date): string {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function localHour(d: Date): number {
  return new Date(d.getTime() + TZ_OFFSET_MS).getUTCHours();
}

export interface RecordEventInput {
  studentId: number;
  type: string;
  sectionId?: number | null;
  assetId?: number | null;
  durationSec?: number;
  meta?: unknown;
}

interface SessionMeta {
  kind?: string;
  name?: string;
  playSec?: number;
  position?: number;
  duration?: number;
}

function parseMeta(raw: string | null): SessionMeta | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as SessionMeta; } catch { return null; }
}

export async function recordEvent(input: RecordEventInput) {
  const type = String(input.type || '');
  if (!EVENT_TYPES.includes(type as LearningEventType)) {
    const err = new Error('未知的事件类型');
    (err as { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const meta = (input.meta && typeof input.meta === 'object' ? input.meta : null) as SessionMeta | null;
  const playSec = clampSec(meta?.playSec, SESSION_MAX_SEC);
  const durationSec = clampSec(input.durationSec, SESSION_MAX_SEC);

  // 会话护栏：太短的静默丢弃；视频停留不超过时长×1.2；文档停留上限 30 分钟
  if (type === 'asset_session') {
    if (durationSec < SESSION_MIN_SEC && playSec < SESSION_MIN_SEC) return { skipped: true };
    const videoDuration = Math.round(Number(meta?.duration));
    if (Number.isFinite(videoDuration) && videoDuration > 0) {
      if (durationSec > videoDuration * VIDEO_DWELL_FACTOR) return { skipped: true, reason: 'dwell_exceeds_duration' };
    } else if (durationSec > DOC_DWELL_MAX_SEC) {
      return { skipped: true, reason: 'dwell_too_long' };
    }
  }

  // 同一学生同一资源的下载事件 60 秒内只记一次（客户端点击 + 服务端 attachment 各上报一次）
  if (type === 'download' && input.assetId != null) {
    const recent = await prisma.learningEvent.findFirst({
      where: { studentId: input.studentId, type: 'download', assetId: input.assetId, createdAt: { gte: new Date(Date.now() - DOWNLOAD_DEDUPE_MS) } },
      select: { id: true },
    });
    if (recent) return { id: recent.id, deduped: true };
  }

  const row = await prisma.learningEvent.create({
    data: {
      studentId: input.studentId,
      type,
      sectionId: input.sectionId ?? null,
      assetId: input.assetId ?? null,
      durationSec: type === 'asset_session' ? durationSec : 0,
      meta: input.meta == null ? null : JSON.stringify(input.meta),
    },
    select: { id: true },
  });
  return { id: row.id };
}

export interface RangeInput { from?: Date; to?: Date }

function rangeWhere(from?: Date, to?: Date) {
  const where: Record<string, unknown> = {};
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  return where;
}

function usageWhere(studentId?: number, from?: Date, to?: Date) {
  const where: {
    studentId?: number;
    date?: { gte?: string; lte?: string };
  } = {};
  if (studentId != null) where.studentId = studentId;
  if (from || to) {
    where.date = {
      ...(from ? { gte: localDate(from) } : {}),
      ...(to ? { lte: localDate(to) } : {}),
    };
  }
  return where;
}

function buildStreak(days: string[]): number {
  const set = new Set(days);
  const today = localDate(new Date());
  const yesterday = localDate(new Date(Date.now() - 86400000));
  const cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;
  let streak = 0;
  let t = new Date(`${cursor}T00:00:00+08:00`).getTime();
  while (set.has(localDate(new Date(t)))) {
    streak += 1;
    t -= 86400000;
  }
  return streak;
}

interface Agg {
  contentSec: number;
  videoSec: number;
  opens: number;
  downloads: number;
  days: Set<string>;
  lastActiveAt: Date | null;
  sections: Set<number>;
  openCount: Map<number, number>;
  playByAsset: Map<number, number>;
  durationByAsset: Map<number, number>;
}

function emptyAgg(): Agg {
  return {
    contentSec: 0, videoSec: 0, opens: 0, downloads: 0, days: new Set(), lastActiveAt: null,
    sections: new Set(), openCount: new Map(), playByAsset: new Map(), durationByAsset: new Map(),
  };
}

type EventRow = {
  id?: number; studentId?: number; type: string; sectionId: number | null; assetId: number | null;
  durationSec: number; meta: string | null; createdAt: Date;
};

function accumulate(a: Agg, e: EventRow) {
  // 登录/退出只进入行为时间线，不计入内容学习、覆盖章节或活跃天。
  if (e.type === 'login' || e.type === 'logout') return;
  const meta = parseMeta(e.meta);
  if (e.type === 'asset_session') {
    a.contentSec += e.durationSec;
    const play = Math.round(Number(meta?.playSec)) || 0;
    if (play > 0) a.videoSec += Math.min(play, SESSION_MAX_SEC);
    if (e.assetId != null) {
      a.playByAsset.set(e.assetId, (a.playByAsset.get(e.assetId) ?? 0) + play);
      const dur = Math.round(Number(meta?.duration));
      if (Number.isFinite(dur) && dur > 0) a.durationByAsset.set(e.assetId, Math.max(a.durationByAsset.get(e.assetId) ?? 0, dur));
    }
  }
  if (e.type === 'asset_open') {
    a.opens += 1;
    if (e.assetId != null) a.openCount.set(e.assetId, (a.openCount.get(e.assetId) ?? 0) + 1);
  }
  if (e.type === 'download') a.downloads += 1;
  if (e.sectionId != null) a.sections.add(e.sectionId);
  a.days.add(localDate(e.createdAt));
  if (!a.lastActiveAt || e.createdAt > a.lastActiveAt) a.lastActiveAt = e.createdAt;
}

function completionOf(a: Agg) {
  let watched = 0;
  let total = 0;
  for (const [assetId, played] of a.playByAsset) {
    const dur = a.durationByAsset.get(assetId) ?? 0;
    if (dur > 0) { watched += Math.min(played, dur); total += dur; }
  }
  return total > 0 ? Math.round((watched / total) * 100) : null;
}

function revisitOf(a: Agg) {
  let n = 0;
  for (const count of a.openCount.values()) if (count >= 2) n += 1;
  return n;
}

/** 学生概览：内容学习时长/视频观看/覆盖章节/回访资源/下载/活跃与连续 */
export async function getOverview(from?: Date, to?: Date) {
  const students = await prisma.student.findMany({
    where: { role: 'student' },
    select: { id: true, studentId: true, name: true, class: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });
  const events = await prisma.learningEvent.findMany({
    where: rangeWhere(from, to),
    select: { studentId: true, type: true, sectionId: true, assetId: true, durationSec: true, meta: true, createdAt: true },
  });
  const usageRows = await prisma.dailyUsage.groupBy({
    by: ['studentId'],
    where: usageWhere(undefined, from, to),
    _sum: { activeSec: true },
  });
  const usageByStudent = new Map(
    usageRows.map((row) => [row.studentId, row._sum.activeSec ?? 0])
  );

  const map = new Map<number, Agg>();
  for (const e of events) {
    let a = map.get(e.studentId);
    if (!a) { a = emptyAgg(); map.set(e.studentId, a); }
    accumulate(a, e);
  }

  return students.map((s) => {
    const a = map.get(s.id);
    const days = a ? [...a.days].sort() : [];
    return {
      studentId: s.id,
      studentNo: s.studentId,
      name: s.name,
      className: s.class?.name ?? null,
      contentSec: a?.contentSec ?? 0,
      videoSec: a?.videoSec ?? 0,
      usageSec: usageByStudent.get(s.id) ?? 0,
      coveredSections: a ? a.sections.size : 0,
      revisitAssets: a ? revisitOf(a) : 0,
      opens: a?.opens ?? 0,
      downloads: a?.downloads ?? 0,
      activeDays: days.length,
      streak: buildStreak(days),
      lastActiveAt: a?.lastActiveAt ?? null,
      videoCompletion: a ? completionOf(a) : null,
    };
  });
}

/** 单学生详情：每日/时段、章节投入、资源会话、视频进度分布、章节覆盖、下载明细 */
export async function getStudentDetail(studentId: number, from?: Date, to?: Date) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, studentId: true, name: true, class: { select: { name: true } } },
  });
  if (!student) {
    const err = new Error('学生不存在');
    (err as { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const events = await prisma.learningEvent.findMany({
    where: { studentId, ...rangeWhere(from, to) },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: { id: true, type: true, sectionId: true, assetId: true, durationSec: true, meta: true, createdAt: true },
  });

  const usageRows = await prisma.dailyUsage.findMany({
    where: usageWhere(studentId, from, to),
    select: { date: true, activeSec: true },
  });
  const todayUsage = await prisma.dailyUsage.findUnique({
    where: { studentId_date: { studentId, date: localDate(new Date()) } },
    select: { activeSec: true },
  });

  const daily = new Map<string, { sec: number; videoSec: number; opens: number; usageSec: number }>();
  const hours = new Array(24).fill(0) as number[];
  const bySection = new Map<number, number>();

  for (const e of events) {
    const meta = parseMeta(e.meta);
    const d = localDate(e.createdAt);
    const slot = daily.get(d) ?? { sec: 0, videoSec: 0, opens: 0, usageSec: 0 };
    if (e.type === 'asset_session') {
      slot.sec += e.durationSec;
      const play = Math.round(Number(meta?.playSec)) || 0;
      slot.videoSec += play;
      hours[localHour(e.createdAt)] += e.durationSec || play;
    }
    if (e.type === 'asset_open') slot.opens += 1;
    daily.set(d, slot);
    if (e.sectionId != null) {
      const add = e.type === 'asset_session' ? (e.durationSec || (Math.round(Number(meta?.playSec)) || 0)) : 0;
      bySection.set(e.sectionId, (bySection.get(e.sectionId) ?? 0) + add);
    }
  }

  for (const row of usageRows) {
    const slot = daily.get(row.date) ?? { sec: 0, videoSec: 0, opens: 0, usageSec: 0 };
    slot.usageSec += row.activeSec;
    daily.set(row.date, slot);
  }

  const topSectionIds = [...bySection.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  const sectionIdsAll = [...new Set(events.map((e) => e.sectionId).filter((v): v is number => v != null))];
  const assetIdsAll = [...new Set(events.map((e) => e.assetId).filter((v): v is number => v != null))];
  const [sections, assets, allSections] = await Promise.all([
    sectionIdsAll.length
      ? prisma.section.findMany({
        where: { id: { in: sectionIdsAll } },
        select: {
          id: true, title: true,
          chapter: { select: { title: true, textbook: { select: { name: true, subject: { select: { id: true, name: true, icon: true } } } } } },
        },
      })
      : Promise.resolve([]),
    assetIdsAll.length
      ? prisma.netdiskAsset.findMany({ where: { id: { in: assetIdsAll } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.section.findMany({
      select: { id: true, chapter: { select: { textbook: { select: { subject: { select: { id: true, name: true, icon: true } } } } } } },
    }),
  ]);
  const secMap = new Map(sections.map((s) => [s.id, s]));
  const assetMap = new Map(assets.map((a) => [a.id, a]));
  const titleOf = (id: number) => secMap.get(id)?.title ?? `#${id}`;

  // 资源维度：停留、播放、打开次数
  const byAsset = new Map<string, { assetId: number | null; name: string; sectionId: number | null; dwellSec: number; playSec: number; opens: number; duration: number; lastAt: Date }>();
  for (const e of events) {
    if (!['asset_session', 'asset_open'].includes(e.type)) continue;
    const meta = parseMeta(e.meta);
    const key = e.assetId != null ? `a${e.assetId}` : `n${meta?.name ?? e.id}`;
    const name = (e.assetId != null ? assetMap.get(e.assetId)?.name : null) ?? meta?.name ?? (e.assetId != null ? `资源 #${e.assetId}` : '未识别资源');
    const slot = byAsset.get(key) ?? { assetId: e.assetId ?? null, name, sectionId: e.sectionId ?? null, dwellSec: 0, playSec: 0, opens: 0, duration: 0, lastAt: e.createdAt };
    if (e.type === 'asset_session') {
      slot.dwellSec += e.durationSec;
      slot.playSec += Math.round(Number(meta?.playSec)) || 0;
      const dur = Math.round(Number(meta?.duration));
      if (Number.isFinite(dur) && dur > 0) slot.duration = Math.max(slot.duration, dur);
    }
    if (e.type === 'asset_open') slot.opens += 1;
    if (!slot.sectionId && e.sectionId) slot.sectionId = e.sectionId;
    byAsset.set(key, slot);
  }
  const assetRows = [...byAsset.values()];
  const topAssets = assetRows
    .filter((a) => a.dwellSec > 0 || a.playSec > 0 || a.opens > 0)
    .sort((a, b) => (b.dwellSec + b.playSec) - (a.dwellSec + a.playSec) || b.opens - a.opens)
    .slice(0, 15)
    .map((a) => ({
      ...a,
      sectionTitle: a.sectionId != null ? titleOf(a.sectionId) : null,
      chapterTitle: a.sectionId != null ? secMap.get(a.sectionId)?.chapter.title ?? null : null,
      subjectName: a.sectionId != null ? secMap.get(a.sectionId)?.chapter.textbook.subject?.name ?? null : null,
    }));

  // 视频观看进度（按视频聚合播放秒数）
  const progressRows = assetRows
    .filter((a) => a.duration > 0)
    .map((a) => ({
      assetId: a.assetId,
      name: a.name,
      playSec: a.playSec,
      duration: a.duration,
      percent: Math.min(100, Math.round((a.playSec / a.duration) * 100)),
      lastAt: a.lastAt,
    }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .slice(0, 20);
  const buckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 10}%`, count: 0 }));
  for (const r of progressRows) {
    const idx = Math.min(9, Math.floor(r.percent / 10));
    buckets[idx].count += 1;
  }

  // 章节覆盖：按学科统计已覆盖 / 总节数
  const coveredIds = new Set(events.filter((e) => e.sectionId != null).map((e) => e.sectionId as number));
  const subjectTotals = new Map<string, { subjectName: string; total: number; covered: number }>();
  for (const s of allSections) {
    const subject = s.chapter.textbook.subject;
    if (!subject) continue;
    const key = String(subject.id);
    const slot = subjectTotals.get(key) ?? { subjectName: `${subject.icon ?? ''} ${subject.name}`.trim(), total: 0, covered: 0 };
    slot.total += 1;
    if (coveredIds.has(s.id)) slot.covered += 1;
    subjectTotals.set(key, slot);
  }
  const coverageBySubject = [...subjectTotals.values()]
    .filter((s) => s.covered > 0)
    .map((s) => ({ ...s, percent: Math.round((s.covered / s.total) * 100) }))
    .sort((a, b) => b.covered - a.covered);
  const totalSectionCount = allSections.length;

  const subjectSec = new Map<string, number>();
  const topSections = topSectionIds.map((id) => {
    const s = secMap.get(id);
    const sec = bySection.get(id) ?? 0;
    const subject = s?.chapter.textbook.subject;
    if (subject) subjectSec.set(`${subject.icon} ${subject.name}`, (subjectSec.get(`${subject.icon} ${subject.name}`) ?? 0) + sec);
    return {
      sectionId: id,
      title: s?.title ?? `#${id}`,
      chapterTitle: s?.chapter.title ?? null,
      textbookName: s?.chapter.textbook.name ?? null,
      subjectName: subject?.name ?? null,
      sec,
    };
  });

  const buildRow = (e: EventRow) => {
    const s = e.sectionId != null ? secMap.get(e.sectionId) : undefined;
    const meta = parseMeta(e.meta);
    return {
      id: e.id ?? 0,
      type: e.type,
      sectionId: e.sectionId,
      assetId: e.assetId,
      assetName: (e.assetId != null ? assetMap.get(e.assetId)?.name : null) ?? meta?.name ?? null,
      sectionTitle: s?.title ?? null,
      chapterTitle: s?.chapter.title ?? null,
      textbookName: s?.chapter.textbook.name ?? null,
      subjectName: s?.chapter.textbook.subject?.name ?? null,
      durationSec: e.durationSec,
      meta: meta as Record<string, unknown> | null,
      createdAt: e.createdAt,
    };
  };

  const recent = events.slice(0, 30).map(buildRow);
  const downloads = events.filter((e) => e.type === 'download').slice(0, 50).map(buildRow);

  const agg = emptyAgg();
  for (const e of events) accumulate(agg, e);

  const usageSec = usageRows.reduce((sum, row) => sum + row.activeSec, 0);

  return {
    student,
    totals: {
      contentSec: agg.contentSec,
      videoSec: agg.videoSec,
      usageSec,
      todayUsageSec: todayUsage?.activeSec ?? 0,
      opens: agg.opens,
      downloads: agg.downloads,
      coveredSections: agg.sections.size,
      revisitAssets: revisitOf(agg),
      events: events.length,
      videoCompletion: completionOf(agg),
    },
    daily: [...daily.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => ({ date, ...v })),
    hours,
    topSections,
    topAssets,
    progress: { rows: progressRows, buckets },
    coverage: { coveredSections: agg.sections.size, totalSections: totalSectionCount, bySubject: coverageBySubject },
    downloads,
    subjectShare: [...subjectSec.entries()].map(([name, sec]) => ({ name, sec })).sort((a, b) => b.sec - a.sec),
    recent,
  };
}

/** 清理已废弃的历史事件（心跳/停留/旧视频进度） */
export async function purgeLegacyEvents() {
  const res = await prisma.learningEvent.deleteMany({
    where: { type: { in: ['heartbeat', 'asset_dwell', 'video_progress'] } },
  });
  return { deleted: res.count };
}
