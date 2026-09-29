/**
 * Online Exam Routes
 * API endpoints for online exam management
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as ExamService from '../services/exam-service';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for answer image uploads
const answerStorage = multer.diskStorage({
  destination: (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(__dirname, '../../uploads/answers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `answer-${uniqueSuffix}${ext}`);
  },
});

const uploadAnswerImage = multer({
  storage: answerStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/online-exams
 * Create a new exam (Admin only)
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, description, questionIds, totalScore, duration, startTime, endTime, paperId } = req.body;
    const creatorId = (req as any).user.id;
    
    const exam = await ExamService.createExam({
      title,
      description,
      questionIds,
      totalScore,
      duration,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      creatorId,
      paperId: paperId ? parseInt(paperId) : undefined,
    });
    
    res.status(201).json({ exam });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/online-exams/:id/publish
 * Publish exam to students/classes (Admin only)
 */
router.post('/:id/publish', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { classIds, studentIds } = req.body;
    
    const exam = await ExamService.publishExam(id, { classIds, studentIds });
    res.json({ exam });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/online-exams
 * List exams
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status } = req.query;
    
    const filters: any = {};
    if (status) filters.status = status as string;
    
    // Admin can see all exams, students can only see assigned exams
    if (user.role !== 'admin') {
      filters.studentId = user.id;
    } else {
      filters.creatorId = user.id;
    }
    
    const exams = await ExamService.listExams(filters);
    res.json(exams);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/online-exams/:id
 * Get exam details
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const exam = await ExamService.getExamById(id);
    
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json(exam);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/online-exams/:id/questions
 * Get questions for an exam
 */
router.get('/:id/questions', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const questions = await ExamService.getExamQuestions(id);
    
    if (!questions) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/online-exams/:id/start
 * Start exam for a student
 */
router.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const studentId = (req as any).user.id;
    
    const record = await ExamService.startExam(id, studentId);
    res.json(record);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/online-exams/:id/record
 * Get exam record for current student
 */
router.get('/:id/record', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const studentId = (req as any).user.id;
    
    const record = await ExamService.getExamRecord(id, studentId);
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/online-exams/records/:recordId/answer
 * Save answer for a question
 */
router.post('/records/:recordId/answer', requireAuth, async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.recordId as string);
    const { questionId, answer, timeSpent } = req.body;
    
    const result = await ExamService.saveAnswer(recordId, questionId, answer, timeSpent);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/online-exams/records/:recordId/image
 * Upload image answer (multipart: image file + questionId)
 */
router.post('/records/:recordId/image', requireAuth, uploadAnswerImage.single('image'), async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.recordId as string);
    const questionId = parseInt(req.body.questionId as string);
    const timeSpent = req.body.timeSpent ? parseInt(req.body.timeSpent as string) : undefined;

    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageUrl = `/uploads/answers/${file.filename}`;
    const result = await ExamService.uploadImageAnswer(recordId, questionId, imageUrl, timeSpent);
    res.json({ success: true, imageUrl, answer: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/online-exams/records/:recordId/submit
 * Submit exam
 */
router.post('/records/:recordId/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.recordId as string);
    
    const record = await ExamService.submitExam(recordId);
    res.json(record);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/online-exams/records/all
 * List exam records (Admin only)
 */
router.get('/records/all', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { examId, studentId, status } = req.query;
    
    const filters: any = {};
    if (examId) filters.examId = parseInt(examId as string);
    if (studentId) filters.studentId = parseInt(studentId as string);
    if (status) filters.status = status as string;
    
    const records = await ExamService.listExamRecords(filters);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/online-exams/:id
 * Update exam (Admin only)
 */
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { title, description, questionIds, totalScore, duration, startTime, endTime, status } = req.body;
    
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(questionIds && { questionIds: JSON.stringify(questionIds) }),
        ...(totalScore && { totalScore }),
        ...(duration !== undefined && { duration }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(status && { status }),
      },
    });
    
    res.json({ ...exam, questionIds: JSON.parse(exam.questionIds) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/online-exams/:id
 * Delete exam (Admin only)
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    
    await ExamService.deleteExam(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;