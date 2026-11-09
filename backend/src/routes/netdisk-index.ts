/**
 * 网盘资源索引与映射工作台 API（M3）
 */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as svc from '../services/netdisk-index-service';

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
    const result = await svc.startScan({ restart });
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
    const row = await svc.updateAsset(id, data);
    res.json({ success: true, data: serialize(row as unknown as Record<string, unknown>) });
  } catch (e) { fail(res, e); }
});

// ===== 批量操作 =====
router.post('/assets/batch', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ids, action, sectionId } = req.body ?? {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids 不能为空' });
    const result = await svc.batchAction(ids.map(Number), action, sectionId == null ? null : toInt(sectionId));
    res.json(result);
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

export default router;
