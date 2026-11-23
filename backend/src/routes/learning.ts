/**
 * 学习 API（v3）：学科目录 / 小节资源 / 视频主线课程 / 学习进度 / 最近打开
 */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as learning from '../services/learning-service';
import * as analytics from '../services/learning-analytics-service';

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

// 教辅资源库（未映射）：汇总分组 / 文件列表
function libraryFilters(req: any) {
  const subjectId = toInt(req.query.subjectId);
  if (subjectId == null) return { error: 'subjectId 必填' as const };
  return {
    subjectId,
    kind: req.query.kind ? String(req.query.kind) : undefined,
    year: toInt(req.query.year) ?? undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    series: req.query.series ? String(req.query.series) : undefined,
    book: req.query.book ? String(req.query.book) : undefined,
    page: toInt(req.query.page) ?? 1,
    limit: toInt(req.query.limit) ?? 30,
  };
}

router.get('/resource-library/summary', requireAuth, async (req, res) => {
  try {
    const f = libraryFilters(req);
    if ('error' in f) return res.status(400).json({ error: f.error });
    res.json({ success: true, ...(await learning.getResourceLibrarySummary(f)) });
  } catch (e) { fail(res, e); }
});

router.get('/resource-library/assets', requireAuth, async (req, res) => {
  try {
    const f = libraryFilters(req);
    if ('error' in f) return res.status(400).json({ error: f.error });
    res.json({ success: true, ...(await learning.getResourceLibraryAssets(f)) });
  } catch (e) { fail(res, e); }
});

router.get('/resource-library/admin/tree', requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json({ success: true, ...(await learning.getAdminLibraryTree()) });
  } catch (e) { fail(res, e); }
});

router.get('/resource-library/admin/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    res.json({
      success: true,
      ...(await learning.getAdminLibraryAssets({
        subjectCode: q.subjectCode || undefined,
        series: q.series || undefined,
        book: q.book || undefined,
        q: q.q || undefined,
        page: toInt(q.page) ?? 1,
        limit: toInt(q.limit) ?? 50,
      })),
    });
  } catch (e) { fail(res, e); }
});

router.post('/resource-library/admin/move', requireAuth, requireAdmin, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.toSubject) return res.status(400).json({ error: 'toSubject 必填' });
    res.json(await learning.moveAdminLibraryCategory({
      fromSubject: b.fromSubject ? String(b.fromSubject) : undefined,
      fromSeries: b.fromSeries ? String(b.fromSeries) : undefined,
      fromBook: b.fromBook ? String(b.fromBook) : undefined,
      toSubject: String(b.toSubject),
      toSeries: b.toSeries == null ? undefined : String(b.toSeries),
      toBook: b.toBook == null ? undefined : String(b.toBook),
    }));
  } catch (e) { fail(res, e); }
});


// 学习行为事件上报（心跳 / 打开 / 视频进度 / 下载 / 登录）
router.post('/event', requireAuth, async (req, res) => {
  try {
    const body = req.body ?? {};
    const result = await analytics.recordEvent({
      studentId: req.user!.id,
      type: String(body.type ?? ''),
      sectionId: toInt(body.sectionId),
      assetId: toInt(body.assetId),
      durationSec: toInt(body.durationSec) ?? 0,
      meta: body.meta,
    });
    res.json({ success: true, ...result });
  } catch (e) { fail(res, e); }
});

function parseRange(req: any) {
  const days = Math.min(365, Math.max(1, toInt(req.query.days) ?? 30));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from, to };
}

// 学习分析：学生概览（仅管理员）
router.get('/analytics/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    res.json({ success: true, data: await analytics.getOverview(from, to) });
  } catch (e) { fail(res, e); }
});

// 学习分析：单学生详情（仅管理员）
router.get('/analytics/students/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: '无效的学生 ID' });
    const { from, to } = parseRange(req);
    res.json({ success: true, ...(await analytics.getStudentDetail(id, from, to)) });
  } catch (e) { fail(res, e); }
});

export default router;
