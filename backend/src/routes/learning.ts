/**
 * 学习 API（v3）：学科目录 / 小节资源 / 视频主线课程 / 学习进度 / 最近打开
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/permission';
import * as learning from '../services/learning-service';

const router = Router();

function toInt(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}
function fail(res: any, e: unknown) {
  res.status((e as { statusCode?: number })?.statusCode ?? 500).json({ error: (e as Error).message });
}

// 学科目录（含 sectionCount，驱动学科 Tab）
router.get('/subjects', requireAuth, async (_req, res) => {
  try {
    res.json({ success: true, data: await learning.listLearningSubjects() });
  } catch (e) { fail(res, e); }
});

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

router.get('/recent', requireAuth, async (req, res) => {
  try {
    const limit = toInt(req.query.limit) ?? 5;
    res.json({ success: true, data: await learning.getRecentOpens(req.user!.id, limit) });
  } catch (e) { fail(res, e); }
});

router.get('/viewed-counts', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, data: await learning.getViewedSectionCounts(req.user!.id) });
  } catch (e) { fail(res, e); }
});

// 视频主线课程：按系列 → 课程章节 → 视频 + 关联教材小节
router.get('/video-series', requireAuth, async (req, res) => {
  try {
    const subjectId = toInt(req.query.subjectId);
    res.json({ success: true, ...(await learning.getVideoSeries(req.user!.id, subjectId ?? undefined)) });
  } catch (e) { fail(res, e); }
});

export default router;
