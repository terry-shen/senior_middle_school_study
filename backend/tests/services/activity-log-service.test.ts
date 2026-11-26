import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  ACTIVITY_MAX_META_BYTES,
  deleteExpiredActivityLogs,
  validateActivityEvents,
} from '../../src/services/activity-log-service';

describe('activity log event validation', () => {
  const valid = {
    type: 'nav_click',
    pagePath: '/learning/math?tab=video',
    target: 'sidebar:math',
    label: '数学',
    subjectId: 3,
  };

  it('accepts a valid batch and strips query parameters from pagePath', () => {
    const result = validateActivityEvents({ events: [valid] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0].pagePath).toBe('/learning/math');
    expect(result.events[0].type).toBe('nav_click');
    expect(result.events[0].subjectId).toBe(3);
  });

  it('rejects an empty batch and batches over 50 events', () => {
    expect(validateActivityEvents({ events: [] }).ok).toBe(false);
    const tooMany = Array.from({ length: 51 }, () => valid);
    expect(validateActivityEvents({ events: tooMany }).ok).toBe(false);
  });

  it('rejects an unknown event type and writes nothing', () => {
    const result = validateActivityEvents({
      events: [{ ...valid, type: 'password_typed' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('事件类型');
  });

  it('rejects a pagePath that is not rooted or too long', () => {
    expect(validateActivityEvents({ events: [{ ...valid, pagePath: 'learning/math' }] }).ok).toBe(false);
    expect(
      validateActivityEvents({ events: [{ ...valid, pagePath: `/${'a'.repeat(200)}` }] }).ok
    ).toBe(false);
  });

  it('truncates long labels instead of storing unbounded text', () => {
    const result = validateActivityEvents({
      events: [{ ...valid, label: '学'.repeat(120) }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events[0].label).toHaveLength(80);
  });

  it('rejects meta larger than the limit', () => {
    const result = validateActivityEvents({
      events: [{ ...valid, meta: { text: 'x'.repeat(ACTIVITY_MAX_META_BYTES) } }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('meta');
  });
});

describe('activity log cleanup', () => {
  const dbPath = path.join(__dirname, `activity-cleanup-${process.pid}.db`);
  const url = `file:${dbPath.replace(/\\/g, '/')}`;
  let prisma: PrismaClient;

  beforeAll(async () => {
    fs.rmSync(dbPath, { force: true });
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const statements = [
      `CREATE TABLE "students" ("id" INTEGER PRIMARY KEY AUTOINCREMENT)`,
      `CREATE TABLE "student_activity_logs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "student_id" INTEGER NOT NULL,
        "session_id" INTEGER,
        "type" TEXT NOT NULL,
        "page_path" TEXT NOT NULL,
        "target" TEXT,
        "label" TEXT,
        "subject_id" INTEGER,
        "section_id" INTEGER,
        "asset_id" INTEGER,
        "meta" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE "learning_events" ("id" INTEGER PRIMARY KEY AUTOINCREMENT)`,
      `CREATE TABLE "daily_usage" ("id" INTEGER PRIMARY KEY AUTOINCREMENT)`,
      `CREATE TABLE "student_asset_opens" ("id" INTEGER PRIMARY KEY AUTOINCREMENT)`,
    ];
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.$executeRawUnsafe(`INSERT INTO "students" ("id") VALUES (1)`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    fs.rmSync(dbPath, { force: true });
  });

  it('deletes only logs older than 7 days and leaves other table rows untouched', async () => {
    const now = new Date('2026-11-26T12:00:00.000Z');
    const insertLog = (createdAt: Date) =>
      prisma.studentActivityLog.create({
        data: { studentId: 1, type: 'ui_click', pagePath: '/', createdAt },
      });

    await insertLog(new Date(now.getTime() - 8 * 24 * 3600 * 1000));
    await insertLog(new Date(now.getTime() - 7 * 24 * 3600 * 1000 - 1000));
    await insertLog(new Date(now.getTime() - 6 * 24 * 3600 * 1000));
    await prisma.$executeRawUnsafe(`INSERT INTO "learning_events" DEFAULT VALUES`);
    await prisma.$executeRawUnsafe(`INSERT INTO "daily_usage" DEFAULT VALUES`);
    await prisma.$executeRawUnsafe(`INSERT INTO "student_asset_opens" DEFAULT VALUES`);

    const result = await deleteExpiredActivityLogs({
      now,
      batchSize: 1,
      client: prisma,
    });

    expect(result.deleted).toBe(2);
    expect(result.batches).toBeGreaterThanOrEqual(2);
    const remaining = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count FROM "student_activity_logs"`
    );
    expect(Number(remaining[0].count)).toBe(1);
    const counts = await Promise.all([
      prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) AS count FROM "learning_events"`),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) AS count FROM "daily_usage"`),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) AS count FROM "student_asset_opens"`),
    ]);
    expect(counts.map((r) => Number(r[0].count))).toEqual([1, 1, 1]);
  });
});
