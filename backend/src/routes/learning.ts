/**
 * 学生学习 API（M4）：章节资源 / 学习进度 / 章节地图 / 我的学习工作台
 */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as learning from '../services/learning-service';

const router = Router();

function toInt(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}
function fail(res: any, e: unknown) {
  res.status((e as { statusCode?: number })?.statusCode ?? 500).json({ error: (e as Error).message });
}

router.get('/sections/:id/resources', requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'id 非法' });
    const modeRaw = String(req.query.mode ?? 'featured');
    const mode = modeRaw === 'more' || modeRaw === 'manage' ? modeRaw : 'featured';
    if (mode === 'manage' && req.user?.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
    const result = await learning.getSectionResources(id, mode, toInt(req.query.page) ?? 1, toInt(req.query.limit) ?? 12);
    res.json({ success: true, ...result });
  } catch (e) { fail(res, e); }
});

router.get('/sections/:id/papers', requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'id 非法' });
    res.json({ success: true, data: await learning.getSectionPapers(id) });
  } catch (e) { fail(res, e); }
});

router.get('/sections/:id/wrong-questions', requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'id 非法' });
    const studentId = toInt(req.query.studentId);
    const target = req.user?.role === 'admin' && studentId != null ? studentId : req.user!.id;
    res.json({ success: true, data: await learning.getSectionWrongQuestions(id, target) });
  } catch (e) { fail(res, e); }
});

router.post('/progress', requireAuth, async (req, res) => {
  try {
    const sectionId = toInt(req.body?.sectionId);
    if (sectionId == null) return res.status(400).json({ error: 'sectionId 必填' });
    const assetId = req.body?.assetId == null ? null : toInt(req.body.assetId);
    const row = await learning.recordProgress(req.user!.id, sectionId, assetId);
    res.json({ success: true, progress: { sectionId: row.sectionId, assetId: row.assetId } });
  } catch (e) { fail(res, e); }
});

router.get('/progress', requireAuth, async (req, res) => {
  try { res.json({ success: true, progress: await learning.getProgress(req.user!.id) }); }
  catch (e) { fail(res, e); }
});

router.get('/map', requireAuth, async (req, res) => {
  try {
    const subjectId = toInt(req.query.subjectId);
    res.json({ success: true, data: await learning.getLearningMap(req.user!.id, subjectId ?? undefined) });
  } catch (e) { fail(res, e); }
});

router.get('/workbench', requireAuth, async (req, res) => {
  try {
    const subjectId = toInt(req.query.subjectId);
    res.json({ success: true, ...(await learning.getWorkbench(req.user!.id, subjectId ?? undefined)) });
  } catch (e) { fail(res, e); }
});

// 管理端：某学生章节地图（只读，供学生管理入口复用）
router.get('/map/student/:studentId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const studentId = toInt(req.params.studentId);
    if (studentId == null) return res.status(400).json({ error: 'studentId 非法' });
    const subjectId = toInt(req.query.subjectId);
    res.json({ success: true, data: await learning.getLearningMap(studentId, subjectId ?? undefined) });
  } catch (e) { fail(res, e); }
});

export default router;
