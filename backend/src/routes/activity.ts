import { Router, Request, Response, NextFunction } from 'express';
import { requireAdmin, requireStudent } from '../middleware/permission';
import {
  ACTIVITY_RETENTION_DAYS,
  createActivityLogs,
  isActivityEventType,
  queryStudentActivityLogs,
  validateActivityEvents,
} from '../services/activity-log-service';

const router = Router();
const MAX_BODY_BYTES = 32 * 1024;

function limitBody(req: Request, res: Response, next: NextFunction) {
  const length = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return res.status(413).json({
      success: false,
      error: '请求体过大',
    });
  }
  next();
}

/**
 * POST /api/activity/events
 * Students only. The server owns studentId, sessionId and createdAt.
 */
router.post('/events', requireStudent, limitBody, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: '仅学生可上报访问流水',
      });
    }

    const validation = validateActivityEvents(req.body);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await createActivityLogs(
      req.user.id,
      req.user.sessionId,
      validation.events
    );

    return res.json({
      success: true,
      accepted: result.count,
      createdAt: result.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Activity log write failed:', error);
    return res.status(500).json({ success: false, error: '访问流水写入失败' });
  }
});

/**
 * GET /api/activity/students/:id?days=7&type=&page=1&limit=50
 * Admin-only read view. Never returns more than the 7-day retention window.
 */
router.get('/students/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ success: false, error: '学生 ID 非法' });
    }

    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    if (type && !isActivityEventType(type)) {
      return res.status(400).json({ success: false, error: '事件类型非法' });
    }

    const days = req.query.days == null ? ACTIVITY_RETENTION_DAYS : Number(req.query.days);
    const page = req.query.page == null ? 1 : Number(req.query.page);
    const limit = req.query.limit == null ? 50 : Number(req.query.limit);

    const result = await queryStudentActivityLogs(studentId, {
      days: Number.isFinite(days) ? days : ACTIVITY_RETENTION_DAYS,
      type: type || null,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      retentionDays: result.retentionDays,
    });
  } catch (error) {
    console.error('Activity log query failed:', error);
    return res.status(500).json({ success: false, error: '访问流水查询失败' });
  }
});

export default router;
