/**
 * Student activity log.
 *
 * This is deliberately separate from LearningEvent: it is a high-volume,
 * short-lived trail used for diagnostics, not a learning achievement metric.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ACTIVITY_EVENT_TYPES = [
  'page_view',
  'nav_click',
  'subject_open',
  'chapter_open',
  'asset_open',
  'video_play',
  'video_pause',
  'video_ended',
  'video_seek',
  'search',
  'filter',
  'download',
  'ui_click',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const ACTIVITY_RETENTION_DAYS = 7;
export const ACTIVITY_CLEANUP_BATCH = 2000;
export const ACTIVITY_MAX_EVENTS = 50;
export const ACTIVITY_MAX_PAGE_PATH = 200;
export const ACTIVITY_MAX_TARGET = 120;
export const ACTIVITY_MAX_LABEL = 80;
export const ACTIVITY_MAX_META_BYTES = 2 * 1024;
export const ACTIVITY_MAX_QUERY_LIMIT = 100;

const activityTypeSet = new Set<string>(ACTIVITY_EVENT_TYPES);

export interface ActivityEventInput {
  type: ActivityEventType;
  pagePath: string;
  target?: string | null;
  label?: string | null;
  subjectId?: number | null;
  sectionId?: number | null;
  assetId?: number | null;
  meta?: unknown;
}

export interface NormalizedActivityEvent {
  type: ActivityEventType;
  pagePath: string;
  target: string | null;
  label: string | null;
  subjectId: number | null;
  sectionId: number | null;
  assetId: number | null;
  meta: string | null;
}

export type ActivityValidationResult =
  | { ok: true; events: NormalizedActivityEvent[] }
  | { ok: false; error: string };

export function isActivityEventType(value: unknown): value is ActivityEventType {
  return typeof value === 'string' && activityTypeSet.has(value);
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function optionalId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function serializeMeta(value: unknown): string | null | false {
  if (value == null) return null;
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (!text) return null;
    if (Buffer.byteLength(text, 'utf8') > ACTIVITY_MAX_META_BYTES) return false;
    JSON.parse(text);
    return text;
  } catch {
    return false;
  }
}

function normalizePagePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const pathOnly = value.split(/[?#]/, 1)[0].trim();
  if (!pathOnly.startsWith('/') || pathOnly.length > ACTIVITY_MAX_PAGE_PATH) return null;
  return pathOnly;
}

/**
 * Validate the whole batch before writing. One bad event rejects the batch so
 * partial writes cannot make diagnostics harder.
 */
export function validateActivityEvents(payload: unknown): ActivityValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'events 必须是 1-50 条数组' };
  }

  const events = (payload as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length < 1 || events.length > ACTIVITY_MAX_EVENTS) {
    return { ok: false, error: `events 必须是 1-${ACTIVITY_MAX_EVENTS} 条数组` };
  }

  const normalized: NormalizedActivityEvent[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const item = events[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `第 ${i + 1} 条事件格式非法` };
    }

    const input = item as Record<string, unknown>;
    if (!isActivityEventType(input.type)) {
      return { ok: false, error: `第 ${i + 1} 条事件类型非法` };
    }

    const pagePath = normalizePagePath(input.pagePath);
    if (!pagePath) {
      return { ok: false, error: `第 ${i + 1} 条 pagePath 非法` };
    }

    const meta = serializeMeta(input.meta);
    if (meta === false) {
      return { ok: false, error: `第 ${i + 1} 条 meta 超过限制` };
    }

    normalized.push({
      type: input.type,
      pagePath,
      target: optionalString(input.target, ACTIVITY_MAX_TARGET),
      label: optionalString(input.label, ACTIVITY_MAX_LABEL),
      subjectId: optionalId(input.subjectId),
      sectionId: optionalId(input.sectionId),
      assetId: optionalId(input.assetId),
      meta,
    });
  }

  return { ok: true, events: normalized };
}

export async function createActivityLogs(
  studentId: number,
  sessionId: number | null,
  events: NormalizedActivityEvent[],
  options: { now?: Date; client?: PrismaClient } = {}
) {
  const client = options.client ?? prisma;
  const createdAt = options.now ?? new Date();
  const data: Prisma.StudentActivityLogCreateManyInput[] = events.map((event) => ({
    studentId,
    sessionId,
    type: event.type,
    pagePath: event.pagePath,
    target: event.target,
    label: event.label,
    subjectId: event.subjectId,
    sectionId: event.sectionId,
    assetId: event.assetId,
    meta: event.meta,
    createdAt,
  }));

  const result = await client.studentActivityLog.createMany({ data });
  return { count: result.count, createdAt };
}

function parseMeta(value: string | null): Record<string, unknown> | string | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return value;
  }
}

export interface ActivityQueryOptions {
  days?: number;
  type?: string | null;
  page?: number;
  limit?: number;
  now?: Date;
  client?: PrismaClient;
}

export async function queryStudentActivityLogs(
  studentId: number,
  options: ActivityQueryOptions = {}
) {
  const client = options.client ?? prisma;
  const now = options.now ?? new Date();
  const days = Math.min(
    ACTIVITY_RETENTION_DAYS,
    Math.max(1, Number.isFinite(options.days) ? Number(options.days) : ACTIVITY_RETENTION_DAYS)
  );
  const page = Math.max(1, Number.isFinite(options.page) ? Number(options.page) : 1);
  const limit = Math.min(
    ACTIVITY_MAX_QUERY_LIMIT,
    Math.max(1, Number.isFinite(options.limit) ? Number(options.limit) : 50)
  );
  const from = new Date(now.getTime() - days * 24 * 3600 * 1000);

  const where: Prisma.StudentActivityLogWhereInput = {
    studentId,
    createdAt: { gte: from },
    ...(options.type ? { type: options.type } : {}),
  };

  const [rows, total] = await Promise.all([
    client.studentActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.studentActivityLog.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      type: row.type,
      pagePath: row.pagePath,
      target: row.target,
      label: row.label,
      subjectId: row.subjectId,
      sectionId: row.sectionId,
      assetId: row.assetId,
      meta: parseMeta(row.meta),
      createdAt: row.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    retentionDays: ACTIVITY_RETENTION_DAYS,
    from,
  };
}

export interface CleanupOptions {
  now?: Date;
  batchSize?: number;
  client?: PrismaClient;
}

/**
 * Delete expired activity logs in small batches so SQLite is not locked for a
 * long time. Other tables are untouched by design.
 */
export async function deleteExpiredActivityLogs(options: CleanupOptions = {}) {
  const client = options.client ?? prisma;
  const now = options.now ?? new Date();
  const batchSize = Math.max(1, options.batchSize ?? ACTIVITY_CLEANUP_BATCH);
  const cutoff = new Date(now.getTime() - ACTIVITY_RETENTION_DAYS * 24 * 3600 * 1000);

  let deleted = 0;
  let batches = 0;

  for (;;) {
    const rows = await client.studentActivityLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: batchSize,
    });
    if (rows.length === 0) break;

    const result = await client.studentActivityLog.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    deleted += result.count;
    batches += 1;

    if (rows.length < batchSize) break;
    await new Promise((resolve) => setImmediate(resolve));
  }

  return { deleted, batches, cutoff };
}

let bootstrapTimer: NodeJS.Timeout | null = null;
let dailyTimer: NodeJS.Timeout | null = null;

function msUntilNextCleanup(now: Date): number {
  const offset = 8 * 3600 * 1000;
  const beijing = new Date(now.getTime() + offset);
  const next = new Date(
    Date.UTC(
      beijing.getUTCFullYear(),
      beijing.getUTCMonth(),
      beijing.getUTCDate(),
      3,
      10,
      0,
      0
    ) - offset
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

function runCleanup() {
  deleteExpiredActivityLogs()
    .then((result) => {
      if (result.deleted > 0) {
        console.log(`Activity log cleanup deleted ${result.deleted} rows in ${result.batches} batches`);
      }
    })
    .catch((error) => console.error('Activity log cleanup failed:', error));
}

function scheduleDailyCleanup() {
  dailyTimer = setTimeout(() => {
    runCleanup();
    scheduleDailyCleanup();
  }, msUntilNextCleanup(new Date()));
  dailyTimer.unref?.();
}

/** Startup compensation after 60s, then daily at 03:10 Beijing time. */
export function startActivityLogCleanup() {
  if (bootstrapTimer) return;
  bootstrapTimer = setTimeout(() => {
    runCleanup();
    bootstrapTimer = null;
  }, 60 * 1000);
  bootstrapTimer.unref?.();
  scheduleDailyCleanup();
}

export function stopActivityLogCleanup() {
  if (bootstrapTimer) {
    clearTimeout(bootstrapTimer);
    bootstrapTimer = null;
  }
  if (dailyTimer) {
    clearTimeout(dailyTimer);
    dailyTimer = null;
  }
}
