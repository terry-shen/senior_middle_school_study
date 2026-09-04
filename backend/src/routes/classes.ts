/**
 * Class Management Routes
 * API endpoints for class management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/classes
 * Create a new class
 * Admin only
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, grade } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Class name is required' });
    }
    
    // Check if class already exists
    const existing = await prisma.class.findFirst({
      where: { name }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Class with this name already exists' });
    }
    
    const newClass = await prisma.class.create({
      data: {
        name,
        grade: grade || null
      }
    });
    
    res.status(201).json(newClass);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/classes/list
 * Public endpoint: list all classes (no auth required)
 * Used by registration page to populate class dropdown
 * Returns simplified list (id, name, grade only)
 */
router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classes = await prisma.class.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        grade: true,
      },
    });

    res.json({
      classes: classes.map(c => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/classes
 * List all classes with student count
 * Admin only
 */
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { grade, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (grade) {
      where.grade = grade as string;
    }
    
    const classes = await prisma.class.findMany({
      where,
      include: {
        _count: {
          select: { students: true }
        }
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { name: 'asc' }
    });
    
    const total = await prisma.class.count({ where });
    
    res.json({
      classes: classes.map(c => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        studentCount: c._count.students,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/classes/:id
 * Get a specific class with students
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          select: {
            id: true,
            studentId: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { studentId: 'asc' }
        },
        _count: {
          select: { students: true }
        }
      }
    });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json({
      id: classData.id,
      name: classData.name,
      grade: classData.grade,
      studentCount: classData._count.students,
      students: classData.students,
      createdAt: classData.createdAt,
      updatedAt: classData.updatedAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/classes/:id
 * Update class information
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, grade } = req.body;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (grade !== undefined) updateData.grade = grade;
    
    const updatedClass = await prisma.class.update({
      where: { id },
      data: updateData
    });
    
    res.json(updatedClass);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/classes/:id
 * Delete a class (only if no students assigned)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    
    // Check if class has students
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    if (classData._count.students > 0) {
      return res.status(400).json({ 
        error: `Cannot delete class with ${classData._count.students} students. Remove or reassign students first.` 
      });
    }
    
    await prisma.class.delete({
      where: { id }
    });
    
    res.json({ success: true, message: 'Class deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/classes/:id/assign/:studentId
 * Assign a student to this class
 */
router.post('/:id/assign/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = parseInt(req.params.id as string);
    const studentId = parseInt(req.params.studentId as string);
    
    // Verify class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Update student's class
    const student = await prisma.student.update({
      where: { id: studentId },
      data: { classId },
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
 * POST /api/classes/:id/unassign/:studentId
 * Remove a student from this class
 */
router.post('/:id/unassign/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = parseInt(req.params.studentId as string);
    
    // Set student's classId to null
    const student = await prisma.student.update({
      where: { id: studentId },
      data: { classId: null }
    });
    
    res.json({ success: true, message: 'Student removed from class' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/classes/grade/:grade
 * Get all classes for a specific grade
 */
router.get('/grade/:grade', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const grade = req.params.grade as string;
    
    const classes = await prisma.class.findMany({
      where: { grade },
      include: {
        _count: {
          select: { students: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(classes.map((c: any) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      studentCount: c._count.students
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;