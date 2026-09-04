/**
 * Wrong Questions Routes
 * API endpoints for wrong question collection and management
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as WrongQuestionsService from '../services/wrong-questions-service';
import { generateExamPDF, generateExamWord, ExportQuestion } from '../services/export-service';
import { requireAuth } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/wrong-questions
 * List wrong questions for current student
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.id;
    if (!studentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reviewStatus, knowledgePoint, questionType, difficulty } = req.query;

    const wrongQuestions = await WrongQuestionsService.getWrongQuestions(
      studentId,
      {
        reviewStatus: reviewStatus as string,
        knowledgePoint: knowledgePoint as string,
        questionType: questionType as string,
        difficulty: difficulty as string,
      }
    );

    res.json(wrongQuestions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wrong-questions/stats
 * Get wrong question statistics
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.id;
    if (!studentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await WrongQuestionsService.getWrongQuestionStats(studentId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wrong-questions/practice-history
 * Get practice history
 */
router.get('/practice-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.id;
    if (!studentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const history = await WrongQuestionsService.getPracticeHistory(studentId, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/wrong-questions/practice
 * Record a practice attempt
 */
router.post('/practice', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.id;
    if (!studentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { wrongQuestionId, questionId, userAnswer, isCorrect } = req.body;

    const practice = await WrongQuestionsService.recordPractice(
      wrongQuestionId,
      studentId,
      questionId,
      userAnswer,
      isCorrect
    );

    res.status(201).json(practice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/wrong-questions/:id/status
 * Update review status
 */
router.put('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status, notes } = req.body;

    const updated = await WrongQuestionsService.updateReviewStatus(id, status, notes);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wrong-questions/:id/variations
 * Get variation questions for a wrong question
 */
router.get('/:id/variations', requireAuth, async (req: Request, res: Response) => {
  try {
    const wrongQuestionId = parseInt(req.params.id as string);

    const wrongQuestion = await prisma.wrongQuestion.findUnique({
      where: { id: wrongQuestionId },
    });

    if (!wrongQuestion) {
      return res.status(404).json({ error: 'Wrong question not found' });
    }

    const variations = await WrongQuestionsService.getVariationQuestions(
      wrongQuestion.questionId
    );

    res.json(variations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/wrong-questions/:id/variations
 * Generate a new variation question
 */
router.post('/:id/variations', requireAuth, async (req: Request, res: Response) => {
  try {
    const wrongQuestionId = parseInt(req.params.id as string);

    const wrongQuestion = await prisma.wrongQuestion.findUnique({
      where: { id: wrongQuestionId },
    });

    if (!wrongQuestion) {
      return res.status(404).json({ error: 'Wrong question not found' });
    }

    const variation = await WrongQuestionsService.generateVariationQuestion(
      wrongQuestion.questionId
    );

    res.status(201).json(variation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/wrong-questions/:id
 * Remove a wrong question
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    await prisma.wrongQuestion.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wrong-questions/export/pdf
 * Export wrong questions as PDF (Task 16.8)
 */
router.get('/export/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.id;
    if (!studentId) return res.status(401).json({ error: 'Not authenticated' });

    const wrongQuestions: any[] = await prisma.wrongQuestion.findMany({
      where: { studentId },
      include: { question: true },
      orderBy: { lastWrongAt: 'desc' },
    });

    const items: ExportQuestion[] = wrongQuestions.map((wq) => ({
      id: wq.question?.id,
      questionNumber: wq.question?.questionNumber,
      content: wq.question?.content || '题目内容缺失',
      questionType: wq.question?.questionType,
      options: wq.question?.options,
      answer: wq.question?.answer,
      analysis: wq.question?.analysis,
      score: wq.question?.score,
    }));

    const filePath = await generateExamPDF({ title: '我的错题本', questions: items });
    res.download(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wrong-questions/export/word
 * Export wrong questions as Word (Task 16.8)
 */
router.get('/export/word', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.id;
    if (!studentId) return res.status(401).json({ error: 'Not authenticated' });

    const wrongQuestions: any[] = await prisma.wrongQuestion.findMany({
      where: { studentId },
      include: { question: true },
      orderBy: { lastWrongAt: 'desc' },
    });

    const items: ExportQuestion[] = wrongQuestions.map((wq) => ({
      id: wq.question?.id,
      questionNumber: wq.question?.questionNumber,
      content: wq.question?.content || '题目内容缺失',
      questionType: wq.question?.questionType,
      options: wq.question?.options,
      answer: wq.question?.answer,
      analysis: wq.question?.analysis,
      score: wq.question?.score,
    }));

    const filePath = await generateExamWord({ title: '我的错题本', questions: items });
    res.download(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;