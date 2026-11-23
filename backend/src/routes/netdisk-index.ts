/**
 * 网盘资源索引与映射工作台 API（M3）
 */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as svc from '../services/netdisk-index-service';
import * as learning from '../services/learning-service';

const router = Router();

function toInt(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

function serialize(row: Record<string, unknown>) {
  return {
    ...row,
    fsId: row.fsId != null ? String(row.fsId) : null,
    size: row.size != null ? String(row.size) : null,
  };
}

function fail(res: any, e: unknown) {
  const status = (e as { statusCode?: number })?.statusCode ?? 500;
  res.status(status).json({ error: (e as Error).message });
}

// ===== 扫描控制 =====
router.post('/scan', requireAuth, requireAdmin, async (req, res) => {
  try {
    const restart = !!req.body?.restart;
    const rawDirs = req.body?.dirs;
    const dirs = Array.isArray(rawDirs)
      ? rawDirs.map((d: unknown) => String(d ?? '').trim()).filter((d: string) => d.length > 0)
      : undefined;
    const result = await svc.startScan({ restart, dirs });
    res.json({ success: true, ...result });
  } catch (e) { fail(res, e); }
});

router.post('/scan/pause', requireAuth, requireAdmin, async (_req, res) => {
  try { res.json({ success: true, status: await svc.pauseScan() }); }
  catch (e) { fail(res, e); }
});

router.get('/scan/status', requireAuth, requireAdmin, async (_req, res) => {
  try { res.json({ success: true, status: await svc.getScanStatus() }); }
  catch (e) { fail(res, e); }
});

// ===== 统计 =====
router.get('/stats', requireAuth, requireAdmin, async (_req, res) => {
  try { res.json({ success: true, ...(await svc.getStats()) }); }
  catch (e) { fail(res, e); }
});

// ===== 资源列表 =====
router.get('/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await svc.listAssets({
      sectionId: q.sectionId !== undefined && q.sectionId !== '' ? toInt(q.sectionId) : undefined,
      unmapped: q.unmapped === '1' || q.unmapped === 'true',
      assetKind: q.assetKind,
      audience: q.audience,
      audienceGroup: q.audienceGroup === 'student' ? 'student' : undefined,
      subjectCode: q.subjectCode || undefined,
      status: q.status,
      q: q.q,
      mapConfirmed: q.mapConfirmed === undefined ? undefined : q.mapConfirmed === '1' || q.mapConfirmed === 'true',
      isPinned: q.isPinned === undefined ? undefined : q.isPinned === '1' || q.isPinned === 'true',
      page: toInt(q.page) ?? 1,
      limit: toInt(q.limit) ?? 50,
    });
    res.json({
      success: true,
      data: result.data.map(r => serialize(r as unknown as Record<string, unknown>)),
      pagination: result.pagination,
    });
  } catch (e) { fail(res, e); }
});

// ===== 单条更新 =====
router.patch('/assets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'id 非法' });
    const b = req.body ?? {};
    const data: Parameters<typeof svc.updateAsset>[1] = {};
    if (b.sectionId !== undefined) data.sectionId = b.sectionId === null || b.sectionId === '' ? null : toInt(b.sectionId);
    if (b.mapConfirmed !== undefined) data.mapConfirmed = !!b.mapConfirmed;
    if (b.isPinned !== undefined) data.isPinned = !!b.isPinned;
    if (b.status !== undefined) data.status = String(b.status);
    if (b.assetKind !== undefined) data.assetKind = String(b.assetKind);
    if (b.audience !== undefined) data.audience = String(b.audience);
    if (b.librarySeries !== undefined) data.librarySeries = b.librarySeries === null ? null : String(b.librarySeries);
    if (b.libraryBook !== undefined) data.libraryBook = b.libraryBook === null ? null : String(b.libraryBook);
    if (b.librarySubject !== undefined) data.librarySubject = b.librarySubject === null ? null : String(b.librarySubject);
    const row = await svc.updateAsset(id, data);
    res.json({ success: true, data: serialize(row as unknown as Record<string, unknown>) });
  } catch (e) { fail(res, e); }
});

// ===== 批量操作 =====
router.post('/assets/batch', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ids, action, sectionId, librarySeries, libraryBook, librarySubject } = req.body ?? {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids 不能为空' });
    const result = await svc.batchAction(ids.map(Number), action, sectionId == null ? null : toInt(sectionId), {
      subject: librarySubject == null ? undefined : String(librarySubject),
      series: librarySeries == null ? undefined : String(librarySeries),
      book: libraryBook == null ? undefined : String(libraryBook),
    });
    res.json(result);
  } catch (e) { fail(res, e); }
});

// ===== 全量重新自动映射（不覆盖人工确认） =====
router.post('/remap', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await svc.remapAll();
    res.json({ success: true, ...result });
  } catch (e) { fail(res, e); }
});

// ===== 三层收敛抽检 =====
router.get('/convergence', requireAuth, requireAdmin, async (req, res) => {
  try {
    const raw = String(req.query.sectionIds ?? '');
    const ids = raw.split(',').map(s => toInt(s)).filter((n): n is number => n != null);
    if (!ids.length) return res.status(400).json({ error: 'sectionIds 必填' });
    res.json({ success: true, sections: await svc.sectionConvergence(ids) });
  } catch (e) { fail(res, e); }
});

// ===== 目录清理 =====
router.get('/directories', requireAuth, requireAdmin, async (_req, res) => {
  try { res.json({ success: true, data: await svc.getDirectoryStats() }); }
  catch (e) { fail(res, e); }
});

router.post('/directories/action', requireAuth, requireAdmin, async (req, res) => {
  try {
    const dir = String(req.body?.dir ?? '');
    const action = String(req.body?.action ?? '') as svc.DirectoryAction;
    if (!dir) return res.status(400).json({ error: 'dir 必填' });
    if (!['archive', 'ignore', 'restore'].includes(action)) return res.status(400).json({ error: 'action 非法' });
    res.json(await svc.batchDirectoryAction(dir, action));
  } catch (e) { fail(res, e); }
});

// ===== 单节收敛详情（含学生端预览） =====
router.get('/sections/:id/convergence', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'id 非法' });
    const detail = await svc.getSectionConvergenceDetail(id);
    const [featured, more] = await Promise.all([
      learning.getSectionResources(id, 'featured'),
      learning.getSectionResources(id, 'more', 1, 1),
    ]);
    const featuredGroups = (featured as { groups?: { key: string; label: string; items: { id: number; name: string; assetKind: string }[] }[] }).groups ?? [];
    const moreTotal = (more as { pagination?: { total?: number } }).pagination?.total ?? 0;
    res.json({
      success: true,
      ...detail,
      preview: {
        groups: featuredGroups.map((g) => ({ key: g.key, label: g.label, items: g.items.map((i) => ({ id: i.id, name: i.name, assetKind: i.assetKind })) })),
        moreCount: moreTotal,
      },
    });
  } catch (e) { fail(res, e); }
});

// ===== 撤销 =====
router.post('/undo/:token', requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await svc.undoBatch(String(req.params.token))); }
  catch (e) { fail(res, e); }
});

export default router;
