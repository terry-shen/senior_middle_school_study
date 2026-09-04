/**
 * AI Grading Routes
 * API endpoints for automatic grading
 */

import { Router, Request, Response } from 'express';
import {
  gradeAnswerRecord,
  batchGradeExamRecord,
  adjustGrade,
  getGradingStats,
} from '../services/grading-service';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();

/**
 * POST /api/grading/grade/:recordId
 * Grade a single answer record
 */
router.post('/grade/:recordId', requireAuth, async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.recordId as string);
    const result = await gradeAnswerRecord(recordId, req.user?.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/grading/batch/:examRecordId
 * Batch grade all answers for an exam record
 */
router.post('/batch/:examRecordId', requireAuth, async (req: Request, res: Response) => {
  try {
    const examRecordId = parseInt(req.params.examRecordId as string);
    const result = await batchGradeExamRecord(examRecordId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/grading/adjust/:recordId
 * Manually adjust a grade
 */
router.post('/adjust/:recordId', requireAuth, async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.recordId as string);
    const { newScore, reason } = req.body;

    if (newScore === undefined || !reason) {
      return res.status(400).json({ error: 'Missing newScore or reason' });
    }

    const result = await adjustGrade(recordId, newScore, reason, req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/grading/stats
 * Get grading statistics
 */
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await getGradingStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;