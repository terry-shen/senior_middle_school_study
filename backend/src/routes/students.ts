/**
 * Student Batch Import Routes
 * API endpoints for importing and exporting students
 */

import { Router, Request, Response, NextFunction } from 'express';
import { BatchImportService } from '../services/batch-import-service';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin, requireOwnershipOrAdmin } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();
const importService = new BatchImportService();

/**
 * POST /api/students/import/csv
 * Import students from CSV content
 * Admin only
 */
router.post('/import/csv', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { csvContent, defaultPassword } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({ error: 'CSV content is required' });
    }
    
    const result = await importService.importFromCSV(csvContent, defaultPassword);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/students/import/json
 * Import students from JSON array
 * Admin only
 */
router.post('/import/json', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
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
 * Export students to CSV
 * Admin only
 */
router.get('/export/csv', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
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
 * GET /api/students
 * List all students with pagination
 * Admin only
 */
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const classId = req.query.classId ? parseInt(req.query.classId as string) : undefined;
    
    const where: any = {};
    if (classId) {
      where.classId = classId;
    }
    
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { class: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { studentId: 'asc' }
      }),
      prisma.student.count({ where })
    ]);
    
    // Remove password hash from response
    const sanitizedStudents = students.map(s => ({
      id: s.id,
      studentId: s.studentId,
      name: s.name,
      role: s.role,
      class: s.class,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));
    
    res.json({
      students: sanitizedStudents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/students/:id
 * Get a specific student
 * Student can view own profile, Admin can view any
 */
router.get('/:id', requireAuth, requireOwnershipOrAdmin((req) => parseInt(req.params.id as string)), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    
    const student = await prisma.student.findUnique({
      where: { id },
      include: { class: true }
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Remove password hash
    const { passwordHash, ...sanitized } = student;
    
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/students/:id
 * Update a student
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, classId, password } = req.body;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (classId) updateData.classId = classId;
    if (password) {
      const bcrypt = require('bcrypt');
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    
    const student = await prisma.student.update({
      where: { id },
      data: updateData,
      include: { class: true }
    });
    
    // Remove password hash
    const { passwordHash, ...sanitized } = student;
    
    res.json(sanitized);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/students/:id
 * Delete a student
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    
    await prisma.student.delete({
      where: { id }
    });
    
    res.json({ success: true, message: 'Student deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;