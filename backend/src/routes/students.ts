/**
 * Student management routes
 * - list / create / update (incl. password reset) / delete
 * - batch import (CSV / JSON) and CSV export
 */

import { Router, Request, Response, NextFunction } from 'express';
import { BatchImportService } from '../services/batch-import-service';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin, requireOwnershipOrAdmin } from '../middleware/permission';
import { hashPassword } from '../services/auth-service';

const router = Router();
const prisma = new PrismaClient();
const importService = new BatchImportService();

const MIN_PASSWORD_LENGTH = 6;

function sanitize(s: any) {
  return {
    id: s.id,
    studentId: s.studentId,
    name: s.name,
    role: s.role,
    classId: s.classId,
    class: s.class ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function isUniqueViolation(error: any) {
  return error && (error.code === 'P2002' || String(error.message || '').includes('Unique constraint'));
}

/**
 * POST /api/students/import/csv
 */
router.post('/import/csv', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { csvContent, defaultPassword } = req.body;
    if (!csvContent) return res.status(400).json({ error: 'CSV content is required' });
    const result = await importService.importFromCSV(csvContent, defaultPassword);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/students/import/json
 */
router.post('/import/json', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { students, defaultPassword } = req.body;
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ error: 'Students array is required' });
    }
    const result = await importService.importFromJSON(students, defaultPassword);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/students/export/csv
 */
router.get('/export/csv', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const classId = req.query.classId ? parseInt(req.query.classId as string) : undefined;
    const csvContent = await importService.exportToCSV(classId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/students?page=&limit=&classId=&search=
 * Admin only
 */
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const classId = req.query.classId ? parseInt(req.query.classId as string) : undefined;
    const search = (req.query.search as string | undefined)?.trim();

    const where: any = {};
    if (classId) where.classId = classId;
    if (search) {
      where.OR = [{ studentId: { contains: search } }, { name: { contains: search } }];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { class: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { studentId: 'asc' },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      students: students.map(sanitize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/students
 * Create a single student. Admin only.
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const studentId = (req.body?.studentId ?? '').toString().trim();
    const name = (req.body?.name ?? '').toString().trim();
    const password = (req.body?.password ?? '').toString();
    const roleRaw = (req.body?.role ?? 'student').toString().trim();
    const role = roleRaw === 'admin' ? 'admin' : 'student';
    const classId = req.body?.classId ? parseInt(String(req.body.classId)) : null;

    if (!studentId) return res.status(400).json({ error: '学号不能为空' });
    if (!name) return res.status(400).json({ error: '姓名不能为空' });
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `密码至少 ${MIN_PASSWORD_LENGTH} 位` });
    }

    const exists = await prisma.student.findUnique({ where: { studentId } });
    if (exists) return res.status(409).json({ error: '学号已存在' });

    if (classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls) return res.status(400).json({ error: '班级不存在' });
    }

    const created = await prisma.student.create({
      data: {
        studentId,
        name,
        role,
        classId: classId ?? undefined,
        passwordHash: hashPassword(password),
      },
      include: { class: true },
    });

    res.status(201).json({ success: true, student: sanitize(created) });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: '学号已存在' });
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/students/:id
 */
router.get(
  '/:id',
  requireAuth,
  requireOwnershipOrAdmin((req) => parseInt(req.params.id as string)),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const student = await prisma.student.findUnique({ where: { id }, include: { class: true } });
      if (!student) return res.status(404).json({ error: 'Student not found' });
      res.json(sanitize(student));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/students/:id
 * Admin can update anyone; a student may update their own name/password.
 * Supplying `password` rotates the hash and invalidates existing sessions.
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid student id' });

    const requester = (req as any).user as { id: number; role: string };
    const isAdmin = requester?.role === 'admin';
    if (!isAdmin && requester?.id !== id) {
      return res.status(403).json({ error: '只能修改自己的信息' });
    }

    const target = await prisma.student.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Student not found' });

    const updateData: any = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: '姓名不能为空' });
      updateData.name = name;
    }
    if (isAdmin && req.body?.classId !== undefined) {
      const raw = req.body.classId;
      if (raw === null || raw === '' ) {
        updateData.classId = null;
      } else {
        const classId = parseInt(String(raw));
        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(400).json({ error: '班级不存在' });
        updateData.classId = classId;
      }
    }
    if (isAdmin && req.body?.role !== undefined) {
      const role = String(req.body.role).trim();
      if (role === 'admin' || role === 'student') updateData.role = role;
    }

    const password = req.body?.password;
    let passwordChanged = false;
    if (password !== undefined && password !== null && String(password) !== '') {
      const pwd = String(password);
      if (pwd.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `密码至少 ${MIN_PASSWORD_LENGTH} 位` });
      }
      updateData.passwordHash = hashPassword(pwd);
      passwordChanged = true;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    const student = await prisma.student.update({
      where: { id },
      data: updateData,
      include: { class: true },
    });

    if (passwordChanged) {
      await prisma.session.deleteMany({ where: { studentId: id } });
    }

    res.json({ success: true, passwordChanged, student: sanitize(student) });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: '学号已存在' });
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/students/:id
 * Admin only; cannot delete self.
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid student id' });

    const requester = (req as any).user as { id: number };
    if (requester?.id === id) return res.status(400).json({ error: '不能删除当前登录账号' });

    await prisma.student.delete({ where: { id } });
    res.json({ success: true, message: 'Student deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
