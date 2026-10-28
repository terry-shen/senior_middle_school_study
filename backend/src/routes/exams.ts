/**
 * Exam Generation Routes (compat)
 *
 * 自动组卷入口（代理到 exam-session-service）：
 * - POST /generate → 创建 ExamSession(source=auto, mode=online)
 * - POST /preview  → 组卷预览
 * - /templates     → 组卷模板 CRUD（ExamTemplate 保留）
 */

import { Router, Request, Response } from 'express';
import * as ExamSessionService from '../services/exam-session-service';
import { saveAsTemplate, getTemplates, getTemplateParams } from '../services/exam-generation-service';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();

/**
 * 自动出卷强制学科过滤（design 决策 4）：
 * subjectId 缺失/非法 → 400「请先选择学科」，杜绝跨学科混卷。
 */
function requireSubjectId(body: any): number {
  const n = parseInt(String(body?.subjectId), 10);
  if (!n || n <= 0 || isNaN(n)) {
    const err: any = new Error('请先选择学科');
    err.statusCode = 400;
    throw err;
  }
  return n;
}

// 自动组卷 → 创建 ExamSession（兼容旧 /api/exams/generate）
router.post('/generate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const subjectId = requireSubjectId(body);
    const session = await ExamSessionService.createExamSession({
      title: body.name || body.title,
      mode: 'online',
      source: 'auto',
      subjectId,
      totalScore: body.totalScore ? Number(body.totalScore) : undefined,
      duration: body.duration ? parseInt(String(body.duration)) : undefined,
      creatorId: (req as any).user.id,
      generationParams: body,
    });
    res.status(201).json({
      id: session.id,
      title: session.title,
      totalScore: session.totalScore,
      duration: session.duration,
      mockExamId: session.id, // 兼容旧前端字段
      examSession: session,
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 组卷预览
router.post('/preview', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    requireSubjectId(req.body ?? {});
    const result = await ExamSessionService.previewExamSession(req.body ?? {});
    res.json(result);
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 模板列表
router.get('/templates/list', requireAuth, async (_req: Request, res: Response) => {
  try {
    const templates = await getTemplates();
    res.json({ data: templates });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 保存模板
router.post('/templates', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const templateId = await saveAsTemplate(req.body ?? {}, (req as any).user.id);
    res.status(201).json({ success: true, templateId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 从模板生成
router.post('/templates/:id/generate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(String(req.params.id));
    const params = await getTemplateParams(templateId, req.body ?? {});
    const session = await ExamSessionService.createExamSession({
      title: params.name,
      mode: 'online',
      source: 'auto',
      totalScore: params.totalScore,
      duration: params.duration,
      creatorId: (req as any).user.id,
      generationParams: params,
    });
    res.status(201).json({ success: true, examSession: session });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
