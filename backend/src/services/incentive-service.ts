/**
 * Learning Incentive Service
 * Handles badges, check-ins, challenges, and notifications
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ===== Badge Types =====

export interface BadgeCondition {
  type: 'practice_count' | 'mastery_improvement' | 'streak_days' | 'perfect_score' | 'wrong_mastered';
  value: number;
}

export interface BadgeWithProgress {
  id: number;
  name: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  type: string;
  conditionType: string;
  conditionValue: number;
  rarity: string;
  progress: number;
  earned: boolean;
  earnedAt: Date | null;
}

// ===== Default Badges =====

const DEFAULT_BADGES = [
  // 练习徽章
  { name: 'practice_10', displayName: '初出茅庐', description: '完成10道练习题', type: 'practice', conditionType: 'practice_count', conditionValue: 10, rarity: 'common' },
  { name: 'practice_50', displayName: '勤学苦练', description: '完成50道练习题', type: 'practice', conditionType: 'practice_count', conditionValue: 50, rarity: 'rare' },
  { name: 'practice_100', displayName: '百题斩将', description: '完成100道练习题', type: 'practice', conditionType: 'practice_count', conditionValue: 100, rarity: 'epic' },
  { name: 'practice_500', displayName: '千锤百炼', description: '完成500道练习题', type: 'practice', conditionType: 'practice_count', conditionValue: 500, rarity: 'legendary' },
  // 进步徽章
  { name: 'progress_10', displayName: '稳步提升', description: '掌握度提升10分', type: 'progress', conditionType: 'mastery_improvement', conditionValue: 10, rarity: 'common' },
  { name: 'progress_30', displayName: '突飞猛进', description: '掌握度提升30分', type: 'progress', conditionType: 'mastery_improvement', conditionValue: 30, rarity: 'rare' },
  { name: 'progress_50', displayName: '蜕变成长', description: '掌握度提升50分', type: 'progress', conditionType: 'mastery_improvement', conditionValue: 50, rarity: 'epic' },
  // 毅力徽章
  { name: 'streak_7', displayName: '一周坚持', description: '连续打卡7天', type: 'persistence', conditionType: 'streak_days', conditionValue: 7, rarity: 'common' },
  { name: 'streak_30', displayName: '月度毅力', description: '连续打卡30天', type: 'persistence', conditionType: 'streak_days', conditionValue: 30, rarity: 'rare' },
  { name: 'streak_100', displayName: '百日筑基', description: '连续打卡100天', type: 'persistence', conditionType: 'streak_days', conditionValue: 100, rarity: 'legendary' },
  // 满分徽章
  { name: 'perfect_1', displayName: '满分初体验', description: '获得1次满分', type: 'perfect_score', conditionType: 'perfect_score', conditionValue: 1, rarity: 'rare' },
  { name: 'perfect_5', displayName: '满分达人', description: '获得5次满分', type: 'perfect_score', conditionType: 'perfect_score', conditionValue: 5, rarity: 'epic' },
  // 突破徽章
  { name: 'breakthrough_10', displayName: '错题克星', description: '攻克10道错题', type: 'breakthrough', conditionType: 'wrong_mastered', conditionValue: 10, rarity: 'common' },
  { name: 'breakthrough_50', displayName: '错题终结者', description: '攻克50道错题', type: 'breakthrough', conditionType: 'wrong_mastered', conditionValue: 50, rarity: 'epic' },
];

/**
 * Seed default badges if not exist
 */
export async function seedDefaultBadges(): Promise<void> {
  const count = await prisma.badge.count();
  if (count > 0) return;

  for (const badge of DEFAULT_BADGES) {
    await prisma.badge.create({
      data: {
        name: badge.name,
        displayName: badge.displayName,
        description: badge.description,
        type: badge.type,
        conditionType: badge.conditionType,
        conditionValue: badge.conditionValue,
        rarity: badge.rarity,
      },
    });
  }
}

// ===== Badge Services =====

/**
 * Get all badges with student's progress
 */
export async function getBadgesWithProgress(studentId: number): Promise<BadgeWithProgress[]> {
  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { conditionValue: 'asc' }],
  });

  const userBadges = await prisma.userBadge.findMany({
    where: { studentId },
  });

  const userBadgeMap = new Map<number, { progress: number; earned: boolean; earnedAt: Date | null }>(userBadges.map(ub => [ub.badgeId, { progress: ub.progress, earned: ub.earned, earnedAt: ub.earnedAt }] as [number, { progress: number; earned: boolean; earnedAt: Date | null }]));

  return badges.map((badge) => {
    const userBadge = userBadgeMap.get(badge.id);
    return {
      id: badge.id,
      name: badge.name,
      displayName: badge.displayName,
      description: badge.description,
      iconUrl: badge.iconUrl,
      type: badge.type,
      conditionType: badge.conditionType,
      conditionValue: badge.conditionValue,
      rarity: badge.rarity,
      progress: userBadge?.progress || 0,
      earned: userBadge?.earned || false,
      earnedAt: userBadge?.earnedAt || null,
    };
  });
}

/**
 * Get student's earned badges
 */
export async function getEarnedBadges(studentId: number) {
  return prisma.userBadge.findMany({
    where: { studentId, earned: true },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' },
  });
}

/**
 * Update badge progress for a student based on condition type
 */
export async function updateBadgeProgress(
  studentId: number,
  conditionType: string,
  currentValue: number
): Promise<void> {
  const badges = await prisma.badge.findMany({
    where: { conditionType, isActive: true },
  });

  for (const badge of badges) {
    const existing = await prisma.userBadge.findUnique({
      where: { studentId_badgeId: { studentId, badgeId: badge.id } },
    });

    const progress = Math.min(currentValue, badge.conditionValue);
    const earned = currentValue >= badge.conditionValue;

    if (existing) {
      // Skip if already earned
      if (existing.earned) continue;

      const wasEarned = existing.earned;
      await prisma.userBadge.update({
        where: { id: existing.id },
        data: {
          progress,
          earned,
          earnedAt: earned && !wasEarned ? new Date() : existing.earnedAt,
        },
      });

      // Send notification if newly earned
      if (earned && !wasEarned) {
        await sendIncentiveNotification(studentId, {
          type: 'badge_earned',
          title: '恭喜获得新徽章！',
          content: `你已获得徽章「${badge.displayName}」 - ${badge.description}`,
          metadata: { badgeId: badge.id, badgeName: badge.name },
        });
      }
    } else {
      await prisma.userBadge.create({
        data: {
          studentId,
          badgeId: badge.id,
          progress,
          earned,
          earnedAt: earned ? new Date() : null,
        },
      });

      if (earned) {
        await sendIncentiveNotification(studentId, {
          type: 'badge_earned',
          title: '恭喜获得新徽章！',
          content: `你已获得徽章「${badge.displayName}」 - ${badge.description}`,
          metadata: { badgeId: badge.id, badgeName: badge.name },
        });
      }
    }
  }
}

/**
 * Check and update all badges for a student (called after practice/grading)
 */
export async function checkAllBadges(studentId: number): Promise<void> {
  // 1. Practice count - count all answered questions
  const practiceCount = await prisma.answerRecord.count({
    where: { record: { studentId } },
  });
  await updateBadgeProgress(studentId, 'practice_count', practiceCount);

  // 2. Mastery improvement - compare earliest vs latest mastery
  const history = await prisma.masteryHistory.findMany({
    where: { studentId },
    orderBy: { recordedAt: 'asc' },
  });
  if (history.length >= 2) {
    const earliest = history[0];
    const latest = history[history.length - 1];
    const improvement = Math.max(0, latest.masteryLevel - earliest.masteryLevel);
    await updateBadgeProgress(studentId, 'mastery_improvement', improvement);
  }

  // 3. Streak days - current streak count
  const latestCheckIn = await prisma.checkIn.findFirst({
    where: { studentId },
    orderBy: { checkInDate: 'desc' },
  });
  if (latestCheckIn) {
    await updateBadgeProgress(studentId, 'streak_days', latestCheckIn.streakCount);
  }

  // 4. Perfect score - count exams/mock exams with full score
  const perfectScores = await prisma.mockExamAnswer.count({
    where: {
      studentId,
      isCorrect: true,
      score: { equals: undefined }, // We'll refine: score == maxScore
    },
  });
  // Better: count mock exams where totalScore == maxScore
  const mockExamRecords = await prisma.mockExamAnswer.findMany({
    where: { studentId },
    select: { score: true, maxScore: true },
  });
  const perfectCount = mockExamRecords.filter(r => r.score !== null && r.maxScore !== null && r.score === r.maxScore && r.maxScore > 0).length;
  await updateBadgeProgress(studentId, 'perfect_score', perfectCount);
  void perfectScores; // suppress unused warning

  // 5. Wrong questions mastered
  const masteredWrong = await prisma.wrongQuestion.count({
    where: { studentId, reviewStatus: 'mastered' },
  });
  await updateBadgeProgress(studentId, 'wrong_mastered', masteredWrong);
}

// ===== Check-in Services =====

/**
 * Check in for today
 */
export async function checkIn(studentId: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check if already checked in today
  const existing = await prisma.checkIn.findUnique({
    where: { studentId_checkInDate: { studentId, checkInDate: today } },
  });
  if (existing) {
    return { ...existing, alreadyCheckedIn: true };
  }

  // Find yesterday's check-in to compute streak
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayCheckIn = await prisma.checkIn.findUnique({
    where: { studentId_checkInDate: { studentId, checkInDate: yesterday } },
  });

  const streakCount = yesterdayCheckIn ? yesterdayCheckIn.streakCount + 1 : 1;

  // Get today's learning summary
  const todayStart = new Date(today);
  const todayEnd = new Date(now);
  const todayAnswers = await prisma.answerRecord.count({
    where: {
      record: { studentId },
      createdAt: { gte: todayStart, lte: todayEnd },
    },
  });
  const summary = JSON.stringify({
    practiceCount: todayAnswers,
    studyMinutes: 0, // Placeholder - could be computed from timeSpent
    correctRate: 0,
  });

  const checkInRecord = await prisma.checkIn.create({
    data: {
      studentId,
      checkInDate: today,
      streakCount,
      summary,
    },
  });

  // Update streak badges
  await updateBadgeProgress(studentId, 'streak_days', streakCount);

  // Send milestone notification
  if ([7, 30, 100].includes(streakCount)) {
    await sendIncentiveNotification(studentId, {
      type: 'streak_milestone',
      title: `连续打卡${streakCount}天！`,
      content: `你已连续打卡${streakCount}天，继续保持！`,
      metadata: { streakDays: streakCount },
    });
  }

  return { ...checkInRecord, alreadyCheckedIn: false };
}

/**
 * Get check-in calendar for a student (current month by default)
 */
export async function getCheckInCalendar(studentId: number, year?: number, month?: number) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month !== undefined ? month : now.getMonth();

  const startDate = new Date(y, m, 1);
  const endDate = new Date(y, m + 1, 0, 23, 59, 59);

  const checkIns = await prisma.checkIn.findMany({
    where: {
      studentId,
      checkInDate: { gte: startDate, lte: endDate },
    },
    orderBy: { checkInDate: 'asc' },
  });

  // Get current streak
  const latest = await prisma.checkIn.findFirst({
    where: { studentId },
    orderBy: { checkInDate: 'desc' },
  });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isCurrentStreakActive = latest
    ? (today.getTime() - latest.checkInDate.getTime()) / (1000 * 60 * 60 * 24) <= 1
    : false;

  return {
    checkIns: checkIns.map((c) => ({
      ...c,
      summary: typeof c.summary === 'string' ? JSON.parse(c.summary) : c.summary,
    })),
    currentStreak: isCurrentStreakActive ? latest?.streakCount || 0 : 0,
    totalCheckIns: await prisma.checkIn.count({ where: { studentId } }),
  };
}

/**
 * Check if student has checked in today
 */
export async function hasCheckedInToday(studentId: number): Promise<boolean> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const existing = await prisma.checkIn.findUnique({
    where: { studentId_checkInDate: { studentId, checkInDate: today } },
  });
  return !!existing;
}

// ===== Learning Statistics =====

/**
 * Get learning statistics for a student
 */
export async function getLearningStats(studentId: number) {
  // Total practice count
  const totalPractice = await prisma.answerRecord.count({
    where: { record: { studentId } },
  });

  // Correct rate (score > 0 means correct)
  const correctCount = await prisma.answerRecord.count({
    where: { record: { studentId }, score: { gt: 0 } },
  });
  const correctRate = totalPractice > 0 ? (correctCount / totalPractice) * 100 : 0;

  // Study time (sum of timeSpent in seconds)
  const answers = await prisma.answerRecord.findMany({
    where: { record: { studentId } },
    select: { timeSpent: true },
  });
  const totalStudySeconds = answers.reduce((sum: number, a: { timeSpent: number | null }) => sum + (a.timeSpent || 0), 0);
  const totalStudyMinutes = Math.floor(totalStudySeconds / 60);

  // Badges earned
  const badgesEarned = await prisma.userBadge.count({
    where: { studentId, earned: true },
  });

  // Check-in days
  const checkInDays = await prisma.checkIn.count({ where: { studentId } });

  // Current streak
  const latestCheckIn = await prisma.checkIn.findFirst({
    where: { studentId },
    orderBy: { checkInDate: 'desc' },
  });
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isStreakActive = latestCheckIn
    ? (today.getTime() - latestCheckIn.checkInDate.getTime()) / (1000 * 60 * 60 * 24) <= 1
    : false;
  const currentStreak = isStreakActive ? latestCheckIn?.streakCount || 0 : 0;
  const longestStreak = await prisma.checkIn.findFirst({
    where: { studentId },
    orderBy: { streakCount: 'desc' },
  });

  // Mastery improvement (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentHistory = await prisma.masteryHistory.findMany({
    where: { studentId, recordedAt: { gte: thirtyDaysAgo } },
    orderBy: { recordedAt: 'asc' },
  });
  let masteryImprovement = 0;
  if (recentHistory.length >= 2) {
    masteryImprovement = Math.max(
      0,
      recentHistory[recentHistory.length - 1].masteryLevel - recentHistory[0].masteryLevel
    );
  }

  return {
    totalPractice,
    correctCount,
    correctRate: Math.round(correctRate * 100) / 100,
    totalStudyMinutes,
    badgesEarned,
    checkInDays,
    currentStreak,
    longestStreak: longestStreak?.streakCount || 0,
    masteryImprovement,
  };
}

/**
 * Get mastery progress curve for visualization
 */
export async function getMasteryProgressCurve(studentId: number, days: number = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const history = await prisma.masteryHistory.findMany({
    where: { studentId, recordedAt: { gte: startDate } },
    orderBy: { recordedAt: 'asc' },
    include: { knowledgePoint: { select: { id: true, name: true } } },
  });

  // Group by date
  const byDate = new Map<string, { date: string; avgMastery: number; count: number }>();
  for (const h of history) {
    const dateKey = h.recordedAt.toISOString().split('T')[0];
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, { date: dateKey, avgMastery: 0, count: 0 });
    }
    const entry = byDate.get(dateKey)!;
    entry.avgMastery += h.masteryLevel;
    entry.count += 1;
  }

  return Array.from(byDate.values()).map(e => ({
    date: e.date,
    avgMastery: Math.round((e.avgMastery / e.count) * 100) / 100,
  }));
}

// ===== Leaderboard =====

/**
 * Get class leaderboard (anonymous option available)
 */
export async function getClassLeaderboard(classId: number, anonymous: boolean = false) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: {
      id: true,
      name: true,
      studentId: true,
    },
  });

  const stats: Array<{
    studentId: number;
    displayName: string;
    totalPractice: number;
    correctRate: number;
    currentStreak: number;
    badgesEarned: number;
    score: number;
  }> = [];

  for (const student of students) {
    const stat = await getLearningStats(student.id);
    // Composite score: practice + correctRate*10 + streak*5 + badges*20
    const score = stat.totalPractice + stat.correctRate * 10 + stat.currentStreak * 5 + stat.badgesEarned * 20;
    stats.push({
      studentId: student.id,
      displayName: anonymous ? `同学${student.id}` : student.name,
      totalPractice: stat.totalPractice,
      correctRate: stat.correctRate,
      currentStreak: stat.currentStreak,
      badgesEarned: stat.badgesEarned,
      score: Math.round(score),
    });
  }

  // Sort by score descending
  stats.sort((a, b) => b.score - a.score);

  // Assign ranks
  return stats.map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * Get all students leaderboard (anonymous by default)
 */
export async function getGlobalLeaderboard(anonymous: boolean = true, limit: number = 50) {
  const students = await prisma.student.findMany({
    where: { role: 'student' },
    select: { id: true, name: true, studentId: true, classId: true },
    take: 200, // Limit to avoid heavy computation
  });

  const stats: Array<{
    studentId: number;
    displayName: string;
    className: string;
    totalPractice: number;
    correctRate: number;
    currentStreak: number;
    badgesEarned: number;
    score: number;
  }> = [];

  // Get class names map
  const classes = await prisma.class.findMany({ select: { id: true, name: true } });
  const classMap = new Map(classes.map(c => [c.id, c.name]));

  for (const student of students) {
    const stat = await getLearningStats(student.id);
    const score = stat.totalPractice + stat.correctRate * 10 + stat.currentStreak * 5 + stat.badgesEarned * 20;
    stats.push({
      studentId: student.id,
      displayName: anonymous ? `同学${student.id}` : student.name,
      className: student.classId ? classMap.get(student.classId) || '-' : '-',
      totalPractice: stat.totalPractice,
      correctRate: stat.correctRate,
      currentStreak: stat.currentStreak,
      badgesEarned: stat.badgesEarned,
      score: Math.round(score),
    });
  }

  stats.sort((a, b) => b.score - a.score);
  return stats.slice(0, limit).map((s, i) => ({ ...s, rank: i + 1 }));
}

// ===== Achievement Wall =====

/**
 * Get achievement wall data for a student
 */
export async function getAchievementWall(studentId: number) {
  const [earnedBadges, checkIns, perfectScores] = await Promise.all([
    prisma.userBadge.findMany({
      where: { studentId, earned: true },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    }),
    prisma.checkIn.findMany({
      where: { studentId },
      orderBy: { checkInDate: 'desc' },
      take: 30,
    }),
    // Mock exams with full scores
    prisma.mockExamAnswer.findMany({
      where: { studentId, score: { equals: undefined } },
      take: 5,
    }),
  ]);

  // Get perfect score mock exam records
  const allMockAnswers = await prisma.mockExamAnswer.findMany({
    where: { studentId },
    select: { mockExamId: true, score: true, maxScore: true },
  });
  const perfectExams = allMockAnswers
    .filter((a: { mockExamId: number; score: number | null; maxScore: number | null }) => (a.score !== null && a.maxScore !== null && a.score === a.maxScore && a.maxScore > 0))
    .map((a: { mockExamId: number; score: number | null; maxScore: number | null }) => ({ mockExamId: a.mockExamId, score: a.score as number, maxScore: a.maxScore as number }));

  // Mastery improvements
  const history = await prisma.masteryHistory.findMany({
    where: { studentId },
    orderBy: { recordedAt: 'asc' },
  });
  const masteryImprovements: Array<{ knowledgePointId: number; improvement: number }> = [];
  const byKp = new Map<number, { first: number; latest: number }>();
  for (const h of history) {
    if (!byKp.has(h.knowledgePointId)) {
      byKp.set(h.knowledgePointId, { first: h.masteryLevel, latest: h.masteryLevel });
    } else {
      byKp.get(h.knowledgePointId)!.latest = h.masteryLevel;
    }
  }
  for (const [kpId, data] of byKp.entries()) {
    const improvement = data.latest - data.first;
    if (improvement > 0) {
      masteryImprovements.push({ knowledgePointId: kpId, improvement });
    }
  }
  masteryImprovements.sort((a, b) => b.improvement - a.improvement);

  return {
    earnedBadges,
    recentCheckIns: checkIns,
    perfectScores: perfectExams,
    masteryImprovements: masteryImprovements.slice(0, 10),
    totalBadges: earnedBadges.length,
    totalCheckIns: await prisma.checkIn.count({ where: { studentId } }),
    totalPerfectScores: perfectExams.length,
  };
}

// ===== Notification Services =====

/**
 * Send an incentive notification to a student
 */
export async function sendIncentiveNotification(
  studentId: number,
  notification: {
    type: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.incentiveNotification.create({
    data: {
      studentId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      metadata: JSON.stringify(notification.metadata || {}),
    },
  });
}

/**
 * Get notifications for a student
 */
export async function getNotifications(studentId: number, unreadOnly: boolean = false) {
  const where: { studentId: number; isRead?: boolean } = { studentId };
  if (unreadOnly) where.isRead = false;

  return prisma.incentiveNotification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(studentId: number, notificationId: number) {
  return prisma.incentiveNotification.updateMany({
    where: { id: notificationId, studentId },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * Send check-in reminder to students who haven't checked in today
 * (Called by a cron job at end of day)
 */
export async function sendCheckInReminders(): Promise<number> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find students who checked in yesterday but not today
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayCheckIns = await prisma.checkIn.findMany({
    where: { checkInDate: yesterday },
    select: { studentId: true },
  });

  let count = 0;
  for (const checkIn of yesterdayCheckIns) {
    const todayCheckIn = await prisma.checkIn.findUnique({
      where: { studentId_checkInDate: { studentId: checkIn.studentId, checkInDate: today } },
    });

    if (!todayCheckIn) {
      await sendIncentiveNotification(checkIn.studentId, {
        type: 'check_in_reminder',
        title: '今日打卡提醒',
        content: '你今天还没有打卡哦，坚持每日学习才能养成好习惯！',
        metadata: { streakDay: true },
      });
      count++;
    }
  }

  return count;
}

// ===== Challenge Services =====

/**
 * Create a challenge activity
 */
export async function createChallenge(data: {
  title: string;
  description?: string;
  type: string;
  classId?: number;
  organizerId: number;
  parameters?: Record<string, unknown>;
  startTime: Date;
  endTime: Date;
  badgeIds?: number[];
}) {
  const challenge = await prisma.challenge.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type,
      classId: data.classId,
      organizerId: data.organizerId,
      parameters: JSON.stringify(data.parameters || {}),
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'upcoming',
    },
  });

  // Add reward badges
  if (data.badgeIds && data.badgeIds.length > 0) {
    for (const badgeId of data.badgeIds) {
      await prisma.challengeBadge.create({
        data: {
          challengeId: challenge.id,
          badgeId,
          rule: JSON.stringify({ rank: 3 }),
        },
      });
    }
  }

  return challenge;
}

/**
 * Publish/Start a challenge
 */
export async function startChallenge(challengeId: number) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new Error('Challenge not found');

  // If class PK, auto-enroll all class students
  if (challenge.classId) {
    const students = await prisma.student.findMany({
      where: { classId: challenge.classId, role: 'student' },
    });
    for (const student of students) {
      await prisma.challengeParticipant.upsert({
        where: {
          challengeId_studentId: { challengeId, studentId: student.id },
        },
        update: {},
        create: { challengeId, studentId: student.id },
      });
    }
  }

  return prisma.challenge.update({
    where: { id: challengeId },
    data: { status: 'active' },
  });
}

/**
 * Student joins a challenge
 */
export async function joinChallenge(challengeId: number, studentId: number) {
  return prisma.challengeParticipant.upsert({
    where: { challengeId_studentId: { challengeId, studentId } },
    update: {},
    create: { challengeId, studentId },
  });
}

/**
 * Get challenge leaderboard
 */
export async function getChallengeLeaderboard(challengeId: number) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { participants: { include: { student: { select: { id: true, name: true } } } } },
  });
  if (!challenge) throw new Error('Challenge not found');

  // Compute progress for each participant
  const params = JSON.parse(challenge.parameters);
  const metric = (params.metric as string) || 'practice_count';

  const leaderboard: Array<{
    studentId: number;
    name: string;
    progress: number;
    rank: number;
  }> = [];

  for (const p of challenge.participants) {
    let progress = p.progress;
    // If not yet computed, compute from stats
    if (metric === 'practice_count') {
      const stats = await getLearningStats(p.studentId);
      progress = stats.totalPractice;
    } else if (metric === 'streak_days') {
      const stats = await getLearningStats(p.studentId);
      progress = stats.currentStreak;
    } else if (metric === 'correct_rate') {
      const stats = await getLearningStats(p.studentId);
      progress = Math.round(stats.correctRate);
    }

    leaderboard.push({
      studentId: p.studentId,
      name: p.student.name,
      progress,
      rank: 0,
    });
  }

  leaderboard.sort((a, b) => b.progress - a.progress);
  leaderboard.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  // Update progress in DB
  for (const entry of leaderboard) {
    await prisma.challengeParticipant.updateMany({
      where: { challengeId, studentId: entry.studentId },
      data: { progress: entry.progress, rank: entry.rank },
    });
  }

  return { challenge, leaderboard };
}

/**
 * End a challenge and award badges
 */
export async function endChallenge(challengeId: number) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      badges: true,
      participants: { orderBy: { rank: 'asc' } },
    },
  });
  if (!challenge) throw new Error('Challenge not found');

  // Award badges to top performers
  for (const cb of challenge.badges) {
    const rule = JSON.parse(cb.rule);
    const topRank = (rule.rank as number) || 3;

    const topParticipants = challenge.participants
      .filter(p => p.rank && p.rank <= topRank);

    for (const p of topParticipants) {
      // Create or update user badge
      const existing = await prisma.userBadge.findUnique({
        where: { studentId_badgeId: { studentId: p.studentId, badgeId: cb.badgeId } },
      });

      if (!existing || !existing.earned) {
        await prisma.userBadge.upsert({
          where: { studentId_badgeId: { studentId: p.studentId, badgeId: cb.badgeId } },
          update: {
            progress: 1,
            earned: true,
            earnedAt: new Date(),
          },
          create: {
            studentId: p.studentId,
            badgeId: cb.badgeId,
            progress: 1,
            earned: true,
            earnedAt: new Date(),
          },
        });

        // Notify
        const badge = await prisma.badge.findUnique({ where: { id: cb.badgeId } });
        if (badge) {
          await sendIncentiveNotification(p.studentId, {
            type: 'badge_earned',
            title: '挑战奖励徽章！',
            content: `你在挑战「${challenge.title}」中获得前${topRank}名，获得徽章「${badge.displayName}」`,
            metadata: { badgeId: badge.id, challengeId: challenge.id },
          });
        }
      }
    }
  }

  return prisma.challenge.update({
    where: { id: challengeId },
    data: { status: 'completed' },
  });
}

/**
 * List challenges
 */
export async function listChallenges(filters?: { organizerId?: number; classId?: number; status?: string }) {
  const where: {
    organizerId?: number;
    classId?: number;
    status?: string;
  } = {};
  if (filters?.organizerId) where.organizerId = filters.organizerId;
  if (filters?.classId) where.classId = filters.classId;
  if (filters?.status) where.status = filters.status;

  return prisma.challenge.findMany({
    where,
    include: {
      _count: { select: { participants: true } },
      badges: { include: { badge: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get challenge detail
 */
export async function getChallenge(challengeId: number) {
  return prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        include: { student: { select: { id: true, name: true } } },
      },
      badges: { include: { badge: true } },
      organizer: { select: { id: true, name: true } },
    },
  });
}
