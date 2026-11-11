/**
 * Subject Routes — /api/subjects（只读）
 * 学科由种子脚本维护，界面不再提供 CRUD。
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (_req, res) => {
  try {
    const subjects = await prisma.subject.findMany({ orderBy: { order: 'asc' } });
    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
