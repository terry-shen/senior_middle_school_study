/**
 * 学习行为统计服务：事件采集、有效时长、按学生/时间/章节/学科聚合
 * 时区固定 Asia/Shanghai（+08:00）
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const EVENT_TYPES = ['heartbeat', 'asset_open', 'asset_dwell', 'video_progress', 'download', 'login'] as const;
export type LearningEventType = (typeof EVENT_TYPES)[number];

const TZ_OFFSET_MS = 8 * 3600 * 1000;
const HEARTBEAT_MAX_SEC = 60;
const DWELL_MAX_SEC = 7200;
const VIDEO_MAX_SEC = 600;
const DOWNLOAD_DEDUPE_MS = 60 * 1000;

function clampSec(v: unknown, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return 0;
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

export async function recordEvent(input: RecordEventInput) {
  const type = String(input.type || '');
  if (!EVENT_TYPES.includes(type as LearningEventType)) {
    const err = new Error('未知的事件类型');
    (err as { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const isVideo = type === 'video_progress';
  const isDwell = type === 'asset_dwell';
  const durationSec = isVideo
    ? clampSec(input.durationSec, VIDEO_MAX_SEC)
    : isDwell
      ? clampSec(input.durationSec, DWELL_MAX_SEC)
      : clampSec(input.durationSec, HEARTBEAT_MAX_SEC);

  // 同一学生同一资源的下载事件 60 秒内只记一次（客户端点击 + 服务端 attachment 会各上报一次）
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
      durationSec,
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

function buildStreak(days: string[]): number {
  const set = new Set(days);
  const today = localDate(new Date());
  const yesterday = localDate(new Date(Date.now() - 86400000));
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;
  let streak = 0;
  let t = new Date(`${cursor}T00:00:00+08:00`).getTime();
  while (set.has(localDate(new Date(t)))) {
    streak += 1;
    t -= 86400000;
  }
  return streak;
}

/** 学生概览：区间内有效时长/视频时长/打开/下载/活跃天数/连续天数/视频完成率 */
export async function getOverview(from?: Date, to?: Date) {
  const students = await prisma.student.findMany({
    where: { role: 'student' },
    select: { id: true, studentId: true, name: true, class: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });
  const events = await prisma.learningEvent.findMany({
    where: rangeWhere(from, to),
    select: { studentId: true, type: true, durationSec: true, createdAt: true, assetId: true, meta: true },
  });

  interface Acc {
    studySec: number; videoSec: number; opens: number; downloads: number;
    days: Set<string>; lastActiveAt: Date | null; videoPlayed: Map<number, number>; videoTotal: Map<number, number>;
  }
  const map = new Map<number, Acc>();
  for (const e of events) {
    let a = map.get(e.studentId);
    if (!a) {
      a = { studySec: 0, videoSec: 0, opens: 0, downloads: 0, days: new Set(), lastActiveAt: null, videoPlayed: new Map(), videoTotal: new Map() };
      map.set(e.studentId, a);
    }
    if (e.type === 'heartbeat') a.studySec += e.durationSec;
    if (e.type === 'video_progress') {
      a.videoSec += e.durationSec;
      if (e.assetId != null) {
        a.videoPlayed.set(e.assetId, (a.videoPlayed.get(e.assetId) ?? 0) + e.durationSec);
        if (e.meta) {
          try {
            const meta = JSON.parse(e.meta) as { duration?: number };
            const d = Math.round(Number(meta.duration));
            if (Number.isFinite(d) && d > 0) a.videoTotal.set(e.assetId, Math.max(a.videoTotal.get(e.assetId) ?? 0, d));
          } catch { /* ignore */ }
        }
      }
    }
    if (e.type === 'asset_open') a.opens += 1;
    if (e.type === 'download') a.downloads += 1;
    a.days.add(localDate(e.createdAt));
    if (!a.lastActiveAt || e.createdAt > a.lastActiveAt) a.lastActiveAt = e.createdAt;
  }

  return students.map((s) => {
    const a = map.get(s.id);
    const days = a ? [...a.days].sort() : [];
    let watched = 0;
    let total = 0;
    if (a) {
      for (const [assetId, played] of a.videoPlayed) {
        const dur = a.videoTotal.get(assetId) ?? 0;
        if (dur > 0) { watched += Math.min(played, dur); total += dur; }
      }
    }
    return {
      studentId: s.id,
      studentNo: s.studentId,
      name: s.name,
      className: s.class?.name ?? null,
      studySec: a?.studySec ?? 0,
      videoSec: a?.videoSec ?? 0,
      opens: a?.opens ?? 0,
      downloads: a?.downloads ?? 0,
      activeDays: days.length,
      streak: buildStreak(days),
      lastActiveAt: a?.lastActiveAt ?? null,
      videoCompletion: total > 0 ? Math.round((watched / total) * 100) : null,
    };
  });
}

/** 单学生详情：每日时长、24h 分布、章节 Top、学科占比、最近事件 */
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

  const daily = new Map<string, { sec: number; videoSec: number; opens: number }>();
  const hours = new Array(24).fill(0) as number[];
  const bySection = new Map<number, number>();

  for (const e of events) {
    const d = localDate(e.createdAt);
    const slot = daily.get(d) ?? { sec: 0, videoSec: 0, opens: 0 };
    if (e.type === 'heartbeat') { slot.sec += e.durationSec; hours[localHour(e.createdAt)] += e.durationSec; }
    if (e.type === 'video_progress') {
      slot.videoSec += e.durationSec;
      hours[localHour(e.createdAt)] += e.durationSec;
    }
    if (e.type === 'asset_open') slot.opens += 1;
    daily.set(d, slot);
    if (e.sectionId != null) {
      const add = e.type === 'heartbeat' || e.type === 'video_progress' || e.type === 'asset_dwell' ? e.durationSec : 0;
      bySection.set(e.sectionId, (bySection.get(e.sectionId) ?? 0) + add);
    }
  }

  const topSectionIds = [...bySection.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  const sectionIdsAll = [...new Set(events.map((e) => e.sectionId).filter((v): v is number => v != null))];
  const assetIdsAll = [...new Set(events.map((e) => e.assetId).filter((v): v is number => v != null))];
  const [sections, assets] = await Promise.all([
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
  ]);
  const secMap = new Map(sections.map((s) => [s.id, s]));
  const assetMap = new Map(assets.map((a) => [a.id, a]));
  const titleOf = (id: number) => secMap.get(id)?.title ?? `#${id}`;

  // 资源维度：停留时长（asset_dwell）与视频观看时长（video_progress）合并统计
  const byAsset = new Map<string, { assetId: number | null; name: string; sectionId: number | null; sec: number; videoSec: number; opens: number; lastAt: Date }>();
  for (const e of events) {
    if (!['asset_dwell', 'video_progress', 'asset_open'].includes(e.type)) continue;
    const metaName = (() => {
      if (!e.meta) return null;
      try { const m = JSON.parse(e.meta) as { name?: string }; return m?.name ?? null; } catch { return null; }
    })();
    const key = e.assetId != null ? `a${e.assetId}` : `n${metaName ?? e.id}`;
    const name = (e.assetId != null ? assetMap.get(e.assetId)?.name : null) ?? metaName ?? (e.assetId != null ? `资源 #${e.assetId}` : '未识别资源');
    const slot = byAsset.get(key) ?? { assetId: e.assetId ?? null, name, sectionId: e.sectionId ?? null, sec: 0, videoSec: 0, opens: 0, lastAt: e.createdAt };
    if (e.type === 'asset_dwell') slot.sec += e.durationSec;
    if (e.type === 'video_progress') { slot.sec += e.durationSec; slot.videoSec += e.durationSec; }
    if (e.type === 'asset_open') slot.opens += 1;
    if (!slot.sectionId && e.sectionId) slot.sectionId = e.sectionId;
    byAsset.set(key, slot);
  }
  const topAssets = [...byAsset.values()]
    .filter((a) => a.sec > 0 || a.opens > 0)
    .sort((a, b) => b.sec - a.sec || b.opens - a.opens)
    .slice(0, 15)
    .map((a) => ({
      ...a,
      sectionTitle: a.sectionId != null ? titleOf(a.sectionId) : null,
      chapterTitle: a.sectionId != null ? secMap.get(a.sectionId)?.chapter.title ?? null : null,
      subjectName: a.sectionId != null ? secMap.get(a.sectionId)?.chapter.textbook.subject?.name ?? null : null,
    }));

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

  const recent = events.slice(0, 30).map((e) => {
    const s = e.sectionId != null ? secMap.get(e.sectionId) : undefined;
    let parsedMeta: Record<string, unknown> | null = null;
    if (e.meta) { try { parsedMeta = JSON.parse(e.meta) as Record<string, unknown>; } catch { parsedMeta = null; } }
    const metaName = typeof parsedMeta?.name === 'string' ? parsedMeta.name : null;
    return {
      id: e.id,
      type: e.type,
      sectionId: e.sectionId,
      assetId: e.assetId,
      assetName: (e.assetId != null ? assetMap.get(e.assetId)?.name : null) ?? metaName,
      sectionTitle: s?.title ?? null,
      chapterTitle: s?.chapter.title ?? null,
      textbookName: s?.chapter.textbook.name ?? null,
      subjectName: s?.chapter.textbook.subject?.name ?? null,
      durationSec: e.durationSec,
      meta: parsedMeta,
      createdAt: e.createdAt,
    };
  });

  return {
    student,
    totals: {
      studySec: events.filter((e) => e.type === 'heartbeat').reduce((n, e) => n + e.durationSec, 0),
      videoSec: events.filter((e) => e.type === 'video_progress').reduce((n, e) => n + e.durationSec, 0),
      dwellSec: events.filter((e) => e.type === 'asset_dwell').reduce((n, e) => n + e.durationSec, 0),
      opens: events.filter((e) => e.type === 'asset_open').length,
      downloads: events.filter((e) => e.type === 'download').length,
      events: events.length,
    },
    daily: [...daily.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => ({ date, ...v })),
    hours,
    topSections,
    topAssets,
    subjectShare: [...subjectSec.entries()].map(([name, sec]) => ({ name, sec })).sort((a, b) => b.sec - a.sec),
    recent,
  };
}
