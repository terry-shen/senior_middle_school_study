/**
 * Subject Routes — /api/subjects
 * GET / 公开（学科切换器免登录）；POST/PUT/DELETE 管理员
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/permission';
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  checkSubjectInUse,
  SubjectConflictError,
  SubjectNotFoundError,
} from '../services/subject-service';

const router = Router();

// 学科列表（公开端点，供学科切换器使用）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const subjects = await getSubjects();
    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 新增学科
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { code, name, icon, color, order, isActive } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'code 和 name 为必填' });
    }
    const subject = await createSubject({
      code: String(code).trim(),
      name: String(name).trim(),
      icon: icon ?? null,
      color: color ?? null,
      order: order !== undefined ? parseInt(order) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });
    res.status(201).json(subject);
  } catch (error: any) {
    if (error instanceof SubjectConflictError) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// 编辑学科（code 不可修改）
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const { name, icon, color, order, isActive } = req.body;
    const subject = await updateSubject(id, {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(order !== undefined ? { order: parseInt(order) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    });
    res.json(subject);
  } catch (error: any) {
    if (error instanceof SubjectNotFoundError) return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// 删除学科（有关联数据 409）
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    await deleteSubject(id);
    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof SubjectNotFoundError) return res.status(404).json({ error: error.message });
    if (error instanceof SubjectConflictError) return res.status(409).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// 查看学科关联数据统计
router.get('/:id/usage', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    res.json(await checkSubjectInUse(id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
