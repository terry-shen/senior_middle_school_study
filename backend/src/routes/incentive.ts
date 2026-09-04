/**
 * Learning Incentive Routes
 * Badges, Check-ins, Challenges, Notifications, Leaderboard
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin, requireStudent, requireOwnershipOrAdmin } from '../middleware/permission';
import * as incentiveService from '../services/incentive-service';

const router = Router();

// ===== Badges =====

// Get all badges with current user's progress
router.get('/badges', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.query.studentId)) || (req as any).user.id;
    const badges = await incentiveService.getBadgesWithProgress(studentId);
    res.json(badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// Get earned badges
router.get('/badges/earned', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.query.studentId)) || (req as any).user.id;
    const badges = await incentiveService.getEarnedBadges(studentId);
    res.json(badges);
  } catch (error) {
    console.error('Error fetching earned badges:', error);
    res.status(500).json({ error: 'Failed to fetch earned badges' });
  }
});

// Seed default badges (admin only)
router.post('/badges/seed', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await incentiveService.seedDefaultBadges();
    res.json({ message: 'Default badges seeded successfully' });
  } catch (error) {
    console.error('Error seeding badges:', error);
    res.status(500).json({ error: 'Failed to seed badges' });
  }
});

// Manually check and update badges for a student
router.post('/badges/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.body.studentId)) || (req as any).user.id;
    await incentiveService.checkAllBadges(studentId);
    res.json({ message: 'Badges checked successfully' });
  } catch (error) {
    console.error('Error checking badges:', error);
    res.status(500).json({ error: 'Failed to check badges' });
  }
});

// ===== Check-ins =====

// Check in for today
router.post('/check-in', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user.id;
    const result = await incentiveService.checkIn(studentId);
    if (result.alreadyCheckedIn) {
      res.json({ message: 'Already checked in today', alreadyCheckedIn: true, data: result });
    } else {
      res.status(201).json({ message: 'Check-in successful', alreadyCheckedIn: false, data: result });
    }
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Check if checked in today
router.get('/check-in/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user.id;
    const checkedIn = await incentiveService.hasCheckedInToday(studentId);
    res.json({ checkedIn });
  } catch (error) {
    console.error('Error checking check-in status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Get check-in calendar
router.get('/check-in/calendar', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.query.studentId)) || (req as any).user.id;
    const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
    const month = req.query.month !== undefined ? parseInt(String(req.query.month)) : undefined;
    const calendar = await incentiveService.getCheckInCalendar(studentId, year, month);
    res.json(calendar);
  } catch (error) {
    console.error('Error fetching check-in calendar:', error);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// ===== Learning Statistics =====

// Get learning statistics for current user
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.query.studentId)) || (req as any).user.id;
    const stats = await incentiveService.getLearningStats(studentId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get mastery progress curve
router.get('/stats/mastery-curve', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.query.studentId)) || (req as any).user.id;
    const days = parseInt(String(req.query.days)) || 30;
    const curve = await incentiveService.getMasteryProgressCurve(studentId, days);
    res.json(curve);
  } catch (error) {
    console.error('Error fetching mastery curve:', error);
    res.status(500).json({ error: 'Failed to fetch curve' });
  }
});

// ===== Leaderboard =====

// Get class leaderboard
router.get('/leaderboard/class/:classId', requireAuth, async (req: Request, res: Response) => {
  try {
    const classId = parseInt(String(req.params.classId));
    const anonymous = req.query.anonymous === 'true';
    const leaderboard = await incentiveService.getClassLeaderboard(classId, anonymous);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching class leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get global leaderboard
router.get('/leaderboard/global', requireAuth, async (req: Request, res: Response) => {
  try {
    const anonymous = req.query.anonymous !== 'false'; // default true
    const limit = parseInt(String(req.query.limit)) || 50;
    const leaderboard = await incentiveService.getGlobalLeaderboard(anonymous, limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ===== Achievement Wall =====

// Get achievement wall
router.get('/achievements', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.query.studentId)) || (req as any).user.id;
    const achievements = await incentiveService.getAchievementWall(studentId);
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching achievement wall:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// ===== Notifications =====

// Get notifications
router.get('/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user.id;
    const unreadOnly = req.query.unread === 'true';
    const notifications = await incentiveService.getNotifications(studentId, unreadOnly);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user.id;
    const notificationId = parseInt(String(req.params.id));
    await incentiveService.markNotificationRead(studentId, notificationId);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification:', error);
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// ===== Challenges =====

// Create a challenge (admin)
router.post('/challenges', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const challenge = await incentiveService.createChallenge({
      title: req.body.title,
      description: req.body.description,
      type: req.body.type || 'class_pk',
      classId: req.body.classId,
      organizerId: (req as any).user.id,
      parameters: req.body.parameters,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
      badgeIds: req.body.badgeIds,
    });
    res.status(201).json(challenge);
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// List challenges
router.get('/challenges', requireAuth, async (req: Request, res: Response) => {
  try {
    const filters: { organizerId?: number; classId?: number; status?: string } = {};
    if (req.query.organizerId) filters.organizerId = parseInt(String(req.query.organizerId));
    if (req.query.classId) filters.classId = parseInt(String(req.query.classId));
    if (req.query.status) filters.status = String(req.query.status);
    const challenges = await incentiveService.listChallenges(filters);
    res.json(challenges);
  } catch (error) {
    console.error('Error listing challenges:', error);
    res.status(500).json({ error: 'Failed to list challenges' });
  }
});

// Get challenge detail
router.get('/challenges/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const challengeId = parseInt(String(req.params.id));
    const challenge = await incentiveService.getChallenge(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

// Start/publish a challenge (admin)
router.post('/challenges/:id/start', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const challengeId = parseInt(String(req.params.id));
    const challenge = await incentiveService.startChallenge(challengeId);
    res.json(challenge);
  } catch (error) {
    console.error('Error starting challenge:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// End a challenge (admin) - awards badges
router.post('/challenges/:id/end', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const challengeId = parseInt(String(req.params.id));
    const challenge = await incentiveService.endChallenge(challengeId);
    res.json(challenge);
  } catch (error) {
    console.error('Error ending challenge:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Join a challenge (student)
router.post('/challenges/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const challengeId = parseInt(String(req.params.id));
    const studentId = (req as any).user.id;
    const participant = await incentiveService.joinChallenge(challengeId, studentId);
    res.status(201).json(participant);
  } catch (error) {
    console.error('Error joining challenge:', error);
    res.status(500).json({ error: 'Failed to join challenge' });
  }
});

// Get challenge leaderboard
router.get('/challenges/:id/leaderboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const challengeId = parseInt(String(req.params.id));
    const result = await incentiveService.getChallengeLeaderboard(challengeId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching challenge leaderboard:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
