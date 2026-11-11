import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as netdisk from '../services/netdisk-service';
import { detectSubjectFromText } from '../services/netdisk-index-service';

const prisma = new PrismaClient();
const router = Router();

function toStatusCode(e: unknown): number {
  return (e as { statusCode?: number })?.statusCode ?? 500;
}

// GET /api/netdisk/status
// GET /api/netdisk/status (admin — 返回完整凭证用于表单回填)
// GET /api/netdisk/status/public —— 仅返回绑定状态，供学生端浏览资源时使用（不含任何凭证）
router.get('/status/public', requireAuth, async (_req, res) => {
  try {
    const s = await netdisk.getStatus();
    res.json({ success: true, bound: !!s.bound, status: s.status });
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

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
router.get('/files', requireAuth, async (req, res) => {
  try {
    const dir = (req.query.dir as string) || '/';
    const files = await netdisk.listFiles(dir);
    const subjectId = req.query.subjectId ? parseInt(String(req.query.subjectId), 10) : 0;
    let filtered = files;
    if (subjectId) {
      const sub = await prisma.subject.findUnique({ where: { id: subjectId }, select: { code: true } });
      const code = sub?.code;
      if (code) {
        // 只过滤能识别出学科的条目；识别不出的目录（如「视频教学」「教辅材料」）保留以便导航
        filtered = files.filter((f: any) => {
          const detected = detectSubjectFromText(`${f.path || ''} ${f.name || ''}`);
          return !detected || detected === code;
        });
      }
    }
    res.json({ success: true, dir, files: filtered });
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

// ============ 媒体流代理（video/iframe 无法带 Authorization 头 → 支持 ?token=） ============
async function mediaAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith('Bearer ') ? header.substring(7) : undefined;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = headerToken ?? queryToken;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const session = await prisma.session.findFirst({ where: { token, expiresAt: { gt: new Date() } }, include: { student: true } });
  if (!session) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = { id: session.student.id, studentId: session.student.studentId, name: session.student.name, role: session.student.role };
  next();
}

async function proxyDlink(req: Request, res: Response, fsId: number, disposition: 'inline' | 'attachment', filename?: string) {
  const { dlink, name, size } = await netdisk.getFileDlink(fsId);
  const range = req.headers.range;
  const upstream = await axios.get(dlink, {
    headers: {
      'User-Agent': 'pan.baidu.com',
      'Referer': 'https://pan.baidu.com/',
      ...(range ? { Range: range } : {}),
    },
    responseType: 'stream', timeout: 600000, maxContentLength: Infinity, maxBodyLength: Infinity,
    validateStatus: () => true,
  });
  if (upstream.status >= 400) {
    return res.status(502).json({ error: `网盘源返回 ${upstream.status}` });
  }
  res.status(upstream.status);
  const h = upstream.headers as Record<string, unknown>;
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    if (h[k]) res.setHeader(k, String(h[k]));
  }
  const fname = (filename || name || `file-${fsId}`);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(fname)}`);
  if (!h['content-length'] && size) res.setHeader('X-File-Size', String(size));
  (upstream.data as NodeJS.ReadableStream).pipe(res);
}

// GET /api/netdisk/stream?fsId=&token= — 视频流（浏览器 <video> 直接播放，支持 Range 拖动）
router.get('/stream', mediaAuth, async (req, res) => {
  try {
    const fsId = parseInt(String(req.query.fsId ?? ''), 10);
    if (!fsId) return res.status(400).json({ error: 'fsId 必填' });
    await proxyDlink(req, res, fsId, 'inline');
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

// GET /api/netdisk/file?fsId=&mode=inline|attachment&token= — 文件查看（inline PDF/图片）或下载
router.get('/file', mediaAuth, async (req, res) => {
  try {
    const fsId = parseInt(String(req.query.fsId ?? ''), 10);
    if (!fsId) return res.status(400).json({ error: 'fsId 必填' });
    const mode = req.query.mode === 'attachment' ? 'attachment' : 'inline';
    const name = typeof req.query.name === 'string' ? req.query.name : undefined;
    await proxyDlink(req, res, fsId, mode, name);
  } catch (e: unknown) { res.status(toStatusCode(e)).json({ error: (e as Error).message }); }
});

export default router;
