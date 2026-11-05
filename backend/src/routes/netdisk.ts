import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as netdisk from '../services/netdisk-service';

const prisma = new PrismaClient();
const router = Router();

function toStatusCode(e: unknown): number {
  return (e as { statusCode?: number })?.statusCode ?? 500;
}

// GET /api/netdisk/status
// GET /api/netdisk/status (admin — 返回完整凭证用于表单回填)
router.get('/status', requireAuth, requireAdmin, async (_req, res) => {
  try { res.json(await netdisk.getStatus()); }
  catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

// PUT /api/netdisk/config (admin)
router.put('/config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { appKey, appSecret, signKey, redirectUri } = req.body ?? {};
    if (!appKey || !appSecret) return res.status(400).json({ error: 'AppKey/AppSecret 必填' });
    const clean = redirectUri && String(redirectUri).trim() ? String(redirectUri).trim() : null;
    const row = await netdisk.saveConfig(String(appKey), String(appSecret), signKey ? String(signKey) : null, clean);
    res.json({ success: true, status: row.status });
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// GET /api/netdisk/authorize-url (admin)
router.get('/authorize-url', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const redirectUri = await netdisk.getEffectiveRedirectUri();
    const cfg = await netdisk.getConfig();
    if (!cfg) return res.status(400).json({ error: '请先配置应用凭证' });
    const url = netdisk.buildAuthorizeUrl(redirectUri).replace('{appKey}', cfg.appKey);
    res.json({ authorizeUrl: url, redirectUri });
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// GET /api/netdisk/callback — 百度 OAuth 回调
router.get('/callback', async (req, res) => {
  try {
    const { code, error } = req.query as { code?: string; error?: string };
    if (error) return res.status(400).json({ error: `授权失败: ${error}` });
    if (!code) return res.status(400).json({ error: '缺少 code 参数' });
    const redirectUri = await netdisk.getEffectiveRedirectUri();
    const result = await netdisk.handleCallback(code, redirectUri);
    res.json({ ...result });
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

// POST /api/netdisk/unbind (admin)
router.post('/unbind', requireAuth, requireAdmin, async (_req, res) => {
  try { res.json(await netdisk.unbind()); }
  catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// GET /api/netdisk/files?dir= (admin)
router.get('/files', requireAuth, requireAdmin, async (req, res) => {
  try {
    const dir = (req.query.dir as string) || '/';
    res.json({ files: await netdisk.listFiles(dir) });
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

// POST /api/netdisk/share (admin) — body: resourceIds
router.post('/share', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { resourceIds } = req.body ?? {};
    if (!Array.isArray(resourceIds) || resourceIds.length === 0) return res.status(400).json({ error: 'resourceIds 必填' });
    const resources = await prisma.videoResource.findMany({ where: { id: { in: resourceIds.map(Number) }, fsId: { not: null } } });
    const results = [];
    for (const r of resources) {
      if (r.fsId == null) { results.push({ id: r.id, error: '无 fsId' }); continue; }
      try {
        const s = await netdisk.createShare([Number(r.fsId)]);
        await prisma.videoResource.update({ where: { id: r.id }, data: { shareUrl: s.shareUrl } });
        results.push({ id: r.id, shareUrl: s.shareUrl });
      } catch (e: unknown) { results.push({ id: r.id, error: (e as Error).message }); }
    }
    res.json({ success: true, results });
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

// POST /api/netdisk/download (admin) — body: resourceIds
router.post('/download', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { resourceIds } = req.body ?? {};
    if (!Array.isArray(resourceIds) || resourceIds.length === 0) return res.status(400).json({ error: 'resourceIds 必填' });
    const resources = await prisma.videoResource.findMany({ where: { id: { in: resourceIds.map(Number) }, resourceType: 'document', fsId: { not: null } } });
    const results = [];
    for (const r of resources) {
      if (r.fsId == null) { results.push({ id: r.id, error: '无 fsId' }); continue; }
      try {
        const d = await netdisk.saveLocalFile(Number(r.fsId), r.title || `file-${r.id}`);
        await prisma.videoResource.update({ where: { id: r.id }, data: { fileUrl: d.fileUrl, fileSize: BigInt(d.size) } });
        results.push({ id: r.id, fileUrl: d.fileUrl, size: d.size });
      } catch (e: unknown) { results.push({ id: r.id, error: (e as Error).message }); }
    }
    res.json({ success: true, results });
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

export default router;
