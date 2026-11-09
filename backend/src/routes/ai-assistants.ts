import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();

function toId(v: unknown): number {
  return parseInt(String(v), 10);
}

function clip(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

// AI 助理列表（介绍 + 跳转地址）
router.get('/', requireAuth, async (_req, res) => {
  try {
    const data = await prisma.aiAssistant.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true, url: true, icon: true, description: true, order: true },
    });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || '加载失败' });
  }
});

// ===== 管理员：站点维护 =====
router.get('/admin/all', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const data = await prisma.aiAssistant.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || '加载失败' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const code = clip(req.body?.code, 40);
    const name = clip(req.body?.name, 40);
    if (!code || !name) return res.status(400).json({ error: '请填写标识与名称' });
    const created = await prisma.aiAssistant.create({
      data: {
        code,
        name,
        url: clip(req.body?.url, 500) || '',
        icon: clip(req.body?.icon, 20),
        description: clip(req.body?.description, 200),
        order: Number(req.body?.order) || 0,
        isActive: req.body?.isActive === undefined ? true : !!req.body.isActive,
      },
    });
    res.status(201).json({ success: true, assistant: created });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: '该标识已存在' });
    res.status(500).json({ error: e?.message || '创建失败' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的 ID' });
    const exists = await prisma.aiAssistant.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: '未找到该 AI 助理' });

    const data: any = {};
    if (req.body?.name !== undefined) data.name = clip(req.body.name, 40) || exists.name;
    if (req.body?.url !== undefined) data.url = clip(req.body.url, 500) || '';
    if (req.body?.icon !== undefined) data.icon = clip(req.body.icon, 20);
    if (req.body?.description !== undefined) data.description = clip(req.body.description, 200);
    if (req.body?.order !== undefined) data.order = Number(req.body.order) || 0;
    if (req.body?.isActive !== undefined) data.isActive = !!req.body.isActive;

    const updated = await prisma.aiAssistant.update({ where: { id }, data });
    res.json({ success: true, assistant: updated });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || '更新失败' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的 ID' });
    await prisma.aiAssistant.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || '停用失败' });
  }
});

export default router;
