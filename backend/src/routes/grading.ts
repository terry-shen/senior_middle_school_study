/**
 * Grading Routes
 *
 * AI批改（选择题/填空题自动判分，解答题人工）
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as GradingService from '../services/grading-service';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();

// 批改统计
router.get('/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const examSessionId = req.query.examSessionId ? parseInt(String(req.query.examSessionId)) : undefined;
    const stats = await GradingService.getGradingStats({ examSessionId });
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 批量判分某考试会话
router.post('/batch/:examSessionId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.examSessionId));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await GradingService.batchGradeExamSession(id);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 判分单个提交
router.post('/grade/:submissionId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.submissionId));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await GradingService.batchGradeBySubmissionId(id);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 手动调整总分（支持 submissionId 或 examSessionId+studentId 两种形式）
router.post('/adjust', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { examSessionId, studentId, submissionId, newScore, feedback } = req.body ?? {};
    let targetSessionId = examSessionId ? parseInt(String(examSessionId)) : 0;
    let targetStudentId = studentId ? parseInt(String(studentId)) : 0;
    if (submissionId && (!targetSessionId || !targetStudentId)) {
      const sub = await prisma.examSubmission.findUnique({ where: { id: parseInt(String(submissionId)) } });
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      targetSessionId = sub.examSessionId;
      targetStudentId = sub.studentId;
    }
    if (!targetSessionId || !targetStudentId) return res.status(400).json({ error: 'Invalid params' });
    const result = await GradingService.adjustGrade(
      targetSessionId, targetStudentId, Number(newScore), feedback
    );
    res.json({ success: true, submission: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 人工批改单题
router.post('/answer', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { examSessionId, studentId, questionId, score, feedback } = req.body ?? {};
    if (!examSessionId || !studentId || !questionId) return res.status(400).json({ error: 'Invalid params' });
    const result = await GradingService.gradeAnswerManually(
      parseInt(String(examSessionId)), parseInt(String(studentId)), parseInt(String(questionId)), Number(score), feedback
    );
    res.json({ success: true, submission: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
