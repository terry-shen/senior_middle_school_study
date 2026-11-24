/**
 * Student session lifecycle.
 *
 * Server time is the only trusted clock. Sessions are never deleted on logout;
 * they keep their exit reason so login/logout history stays available.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { recordEvent } from './learning-analytics-service';

const prisma = new PrismaClient();

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_DISCONNECT_MS = 3 * 60 * 1000;
export const SESSION_SEEN_TOUCH_MS = 30 * 1000;
export const HEARTBEAT_MAX_SEC = 60;

const TZ_OFFSET_MS = 8 * 3600 * 1000;

export type SessionEndReason = 'manual' | 'idle' | 'disconnected';
export type SessionInvalidCode = 'missing' | 'expired' | 'ended' | 'idle';

type SessionWithStudent = Prisma.SessionGetPayload<{ include: { student: true } }>;

export type SessionValidation =
  | { ok: true; session: SessionWithStudent }
  | { ok: false; code: SessionInvalidCode; reason?: string | null };

export function beijingDateKey(date: Date): string {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Only the server decides how many seconds a heartbeat may add. */
export function activeDeltaSec(lastActiveAt: Date, now: Date): number {
  const ms = now.getTime() - lastActiveAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(HEARTBEAT_MAX_SEC, Math.round(ms / 1000));
}

async function safeRecordSessionEvent(
  studentId: number,
  type: 'login' | 'logout',
  meta: Record<string, unknown>
) {
  try {
    await recordEvent({ studentId, type, meta });
  } catch (error) {
    // Logging must never block login/logout.
    console.warn(`Failed to record ${type} event:`, error);
  }
}

async function recordDailyLogin(studentId: number, at: Date) {
  const date = beijingDateKey(at);
  await prisma.dailyUsage.upsert({
    where: { studentId_date: { studentId, date } },
    create: { studentId, date, loginCount: 1, firstLoginAt: at },
    update: { loginCount: { increment: 1 } },
  });
  await prisma.dailyUsage.updateMany({
    where: { studentId, date, firstLoginAt: null },
    data: { firstLoginAt: at },
  });
}

async function recordDailyLogout(studentId: number, at: Date) {
  const date = beijingDateKey(at);
  await prisma.dailyUsage.upsert({
    where: { studentId_date: { studentId, date } },
    create: { studentId, date, lastLogoutAt: at },
    update: { lastLogoutAt: at },
  });
}

/**
 * Create a login session and its daily/login-event bookkeeping.
 * The caller owns JWT creation and expiry calculation.
 */
export async function createStudentSession(
  studentId: number,
  token: string,
  expiresAt: Date,
  loginAt = new Date()
) {
  const session = await prisma.session.create({
    data: {
      studentId,
      token,
      expiresAt,
      lastActiveAt: loginAt,
      lastSeenAt: loginAt,
    },
  });
  await recordDailyLogin(studentId, loginAt);
  await safeRecordSessionEvent(studentId, 'login', {
    sessionId: session.id,
    loginAt: loginAt.toISOString(),
  });
  return { session, loginAt };
}

async function finishSession(
  session: SessionWithStudent,
  reason: SessionEndReason,
  endedAt: Date
): Promise<{ success: boolean; ended: boolean; reason?: string | null; endedAt?: Date }> {
  const updated = await prisma.session.updateMany({
    where: { id: session.id, endedAt: null },
    data: { endedAt, endReason: reason },
  });

  if (updated.count === 0) {
    return { success: true, ended: false, reason: session.endReason, endedAt: session.endedAt ?? undefined };
  }

  try {
    await recordDailyLogout(session.studentId, endedAt);
  } catch (error) {
    console.warn('Failed to update daily logout:', error);
  }

  await safeRecordSessionEvent(session.studentId, 'logout', {
    sessionId: session.id,
    reason,
    endedAt: endedAt.toISOString(),
  });

  return { success: true, ended: true, reason, endedAt };
}

/**
 * Validate a token against the session table.
 * Expired, ended and idle sessions never authenticate. Idle sessions are closed
 * as a server-side fallback for clients that disappeared without logging out.
 */
export async function validateSessionToken(
  token: string,
  options: { touchSeen?: boolean } = {}
): Promise<SessionValidation> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { student: true },
  });

  if (!session) return { ok: false, code: 'missing' };
  if (session.endedAt) return { ok: false, code: 'ended', reason: session.endReason };

  const now = new Date();
  if (session.expiresAt <= now) {
    return { ok: false, code: 'expired' };
  }

  // Idle logout applies to students only; admins keep their normal 24h session.
  if (session.student.role === 'student') {
    const idleAt = new Date(session.lastActiveAt.getTime() + SESSION_IDLE_MS);
    if (now.getTime() - session.lastActiveAt.getTime() > SESSION_IDLE_MS) {
      await endSessionById(session.id, 'idle', idleAt);
      return { ok: false, code: 'idle', reason: 'idle' };
    }
  }

  if (options.touchSeen !== false) {
    const elapsed = now.getTime() - session.lastSeenAt.getTime();
    if (elapsed >= SESSION_SEEN_TOUCH_MS) {
      await prisma.session.updateMany({
        where: { id: session.id, endedAt: null },
        data: { lastSeenAt: now },
      });
      session.lastSeenAt = now;
    }
  }

  return { ok: true, session };
}

/**
 * Record one presence/activity heartbeat.
 * active=false only updates lastSeenAt. active=true also moves lastActiveAt and
 * adds at most 60 seconds to both the session and the Beijing-day summary.
 */
export async function recordHeartbeat(token: string, active: boolean) {
  const validation = await validateSessionToken(token, { touchSeen: false });
  if (!validation.ok) return validation;

  const now = new Date();
  const { session } = validation;

  if (!active) {
    await prisma.session.updateMany({
      where: { id: session.id, endedAt: null },
      data: { lastSeenAt: now },
    });
    return {
      ok: true as const,
      activeSec: session.activeSec,
      countedSec: 0,
      lastActiveAt: session.lastActiveAt,
    };
  }

  const countedSec = activeDeltaSec(session.lastActiveAt, now);
  await prisma.session.updateMany({
    where: { id: session.id, endedAt: null },
    data: {
      lastActiveAt: now,
      lastSeenAt: now,
      ...(countedSec > 0 ? { activeSec: { increment: countedSec } } : {}),
    },
  });

  if (countedSec > 0) {
    const date = beijingDateKey(now);
    await prisma.dailyUsage.upsert({
      where: { studentId_date: { studentId: session.studentId, date } },
      create: { studentId: session.studentId, date, activeSec: countedSec },
      update: { activeSec: { increment: countedSec } },
    });
  }

  return {
    ok: true as const,
    activeSec: session.activeSec + countedSec,
    countedSec,
    lastActiveAt: now,
  };
}

export async function endSessionByToken(
  token: string,
  reason: SessionEndReason,
  endedAt = new Date()
) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { student: true },
  });
  if (!session) return { success: false, ended: false };
  return finishSession(session, reason, endedAt);
}

export async function endSessionById(
  sessionId: number,
  reason: SessionEndReason,
  endedAt = new Date()
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { student: true },
  });
  if (!session) return { success: false, ended: false };
  return finishSession(session, reason, endedAt);
}

/**
 * Close sessions whose page presence disappeared for more than 3 minutes.
 * The conditional update in finishSession makes this safe to run repeatedly.
 */
export async function sweepDisconnectedSessions(now = new Date()) {
  const threshold = new Date(now.getTime() - SESSION_DISCONNECT_MS);
  const sessions = await prisma.session.findMany({
    // Only student sessions are forced offline; admins keep the full 24h session.
    where: {
      endedAt: null,
      lastSeenAt: { lt: threshold },
      student: { role: 'student' },
    },
    include: { student: true },
    orderBy: { lastSeenAt: 'asc' },
    take: 500,
  });

  let closed = 0;
  for (const session of sessions) {
    const endedAt = session.lastSeenAt < threshold ? session.lastSeenAt : now;
    const result = await finishSession(session, 'disconnected', endedAt);
    if (result.ended) closed += 1;
  }
  return { scanned: sessions.length, closed };
}

let sweeper: NodeJS.Timeout | null = null;

export function startSessionSweeper(intervalMs = 60 * 1000) {
  if (sweeper) return sweeper;
  sweeper = setInterval(() => {
    sweepDisconnectedSessions().catch((error) => {
      console.error('Session sweeper failed:', error);
    });
  }, intervalMs);
  sweeper.unref?.();
  return sweeper;
}

export function stopSessionSweeper() {
  if (sweeper) {
    clearInterval(sweeper);
    sweeper = null;
  }
}
