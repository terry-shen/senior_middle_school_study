import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as netdisk from '../services/netdisk-service';

const prisma = new PrismaClient();
const router = Router();

const VIDEO_EXTS = new Set(['mp4', 'mkv', 'mov', 'avi', 'flv', 'ts']);
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip']);

function detectType(filename: string): 'video' | 'document' | null {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (DOC_EXTS.has(ext)) return 'document';
  return null;
}

// ============ 列表 ============
router.get('/', requireAuth, async (req, res) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const type = req.query.type as string | undefined;
    const keyword = req.query.keyword as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const manage = req.query.manage === '1' && (req as any).user?.role === 'admin';

    const where: Record<string, unknown> = {};
    if (!manage) where.isActive = true;
    if (type) where.resourceType = type;
    if (keyword) where.title = { contains: keyword };
    // subjectId 过滤：null=全科可见；指定学科=该学科+全科
    if (subjectId) where.OR = [{ subjectId }, { subjectId: null }];

    const [total, data] = await Promise.all([
      prisma.videoResource.count({ where }),
      prisma.videoResource.findMany({
        where, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit, take: limit,
        include: { subject: { select: { id: true, name: true, icon: true } } },
      }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// ============ 详情 ============
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '无效 ID' });
    const r = await prisma.videoResource.findUnique({
      where: { id },
      include: { subject: { select: { id: true, name: true, icon: true } } },
    });
    if (!r) return res.status(404).json({ error: '资源不存在' });
    res.json(r);
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// ============ 创建 ============
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, subjectId, grade, chapter, resourceType, netdiskPath, fsId, description, sort } = req.body ?? {};
    if (!title || !netdiskPath) return res.status(400).json({ error: 'title/netdiskPath 必填' });
    const type = resourceType || detectType(netdiskPath) || 'video';
    const r = await prisma.videoResource.create({
      data: {
        title: String(title), netdiskPath: String(netdiskPath),
        resourceType: type,
        subjectId: subjectId ? Number(subjectId) : null,
        grade: grade ? String(grade) : null,
        chapter: chapter ? String(chapter) : null,
        fsId: fsId ? BigInt(fsId) : null,
        description: description ? String(description) : null,
        sort: sort ? Number(sort) : 0,
      },
    });
    res.json({ success: true, resource: r });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') return res.status(409).json({ error: '该网盘路径已存在（重复导入）' });
    res.status(500).json({ error: (e as Error).message });
  }
});

// ============ 更新 ============
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, subjectId, grade, chapter, description, sort, isActive, shareUrl, fileUrl } = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = String(title);
    if (subjectId !== undefined) data.subjectId = subjectId ? Number(subjectId) : null;
    if (grade !== undefined) data.grade = grade ? String(grade) : null;
    if (chapter !== undefined) data.chapter = chapter ? String(chapter) : null;
    if (description !== undefined) data.description = description ? String(description) : null;
    if (sort !== undefined) data.sort = Number(sort);
    if (isActive !== undefined) data.isActive = !!isActive;
    if (shareUrl !== undefined) data.shareUrl = shareUrl ? String(shareUrl) : null;
    if (fileUrl !== undefined) data.fileUrl = fileUrl ? String(fileUrl) : null;
    const r = await prisma.videoResource.update({ where: { id }, data });
    res.json({ success: true, resource: r });
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// ============ 删除 ============
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.videoResource.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// ============ 批量导入 ============
router.post('/import', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { items, subjectId, grade, chapter, downloadDocuments } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items 必填' });
    const results = { created: 0, skipped: 0, shareFailed: [] as number[], downloadFailed: [] as number[], resources: [] as number[] };
    for (const item of items) {
      const path = String(item.path || '');
      const type = detectType(path);
      if (!type) { results.skipped++; continue; }
      const exists = await prisma.videoResource.findUnique({ where: { netdiskPath: path } });
      if (exists) { results.skipped++; continue; }
      const title = path.split('/').pop() || path;
      const r = await prisma.videoResource.create({
        data: {
          title, netdiskPath: path, resourceType: type,
          fsId: item.fsId ? BigInt(item.fsId) : null,
          fileSize: item.size ? BigInt(item.size) : null,
          subjectId: subjectId ? Number(subjectId) : null,
          grade: grade ? String(grade) : null,
          chapter: chapter ? String(chapter) : null,
        },
      });
      results.created++; results.resources.push(r.id);
      if (type === 'video' && r.fsId != null) {
        try {
          const s = await netdisk.createShare([Number(r.fsId)]);
          await prisma.videoResource.update({ where: { id: r.id }, data: { shareUrl: s.shareUrl } });
        } catch { results.shareFailed.push(r.id); }
      }
      if (type === 'document' && downloadDocuments && r.fsId != null) {
        try {
          const d = await netdisk.saveLocalFile(Number(r.fsId), r.title);
          await prisma.videoResource.update({ where: { id: r.id }, data: { fileUrl: d.fileUrl, fileSize: BigInt(d.size) } });
        } catch { results.downloadFailed.push(r.id); }
      }
    }
    res.json({ success: true, ...results });
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

// ============ 播放/查看计数（5 分钟防抖） ============
const playDedup = new Map<string, number>();
router.post('/:id/play', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const studentId = (req as any).user?.id ?? 0;
    const key = `${id}:${studentId}`;
    const now = Date.now();
    if ((playDedup.get(key) ?? 0) > now - 5 * 60_000) return res.json({ success: true, counted: false });
    playDedup.set(key, now);
    await prisma.videoResource.update({ where: { id }, data: { playCount: { increment: 1 } } });
    res.json({ success: true, counted: true });
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
});

export default router;
