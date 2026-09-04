/**
 * Difficulty Management Routes
 * API endpoints for difficulty assessment and adjustment
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { DifficultyService } from '../services/difficulty-service';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();
const difficultyService = new DifficultyService();

/**
 * POST /api/difficulty/assess/:id
 * Assess difficulty for a single question
 */
router.post('/assess/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    
    const result = await difficultyService.assessDifficulty(id);
    
    res.json({
      questionId: id,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/difficulty/batch-assess
 * Batch assess difficulty for multiple questions
 */
router.post('/batch-assess', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { questionIds } = req.body;
    
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'questionIds array is required' });
    }
    
    const result = await difficultyService.batchAssessDifficulty(questionIds);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/difficulty/adjust/:id
 * Manually adjust question difficulty
 */
router.post('/adjust/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { newDifficulty, reason } = req.body;
    const adjustedBy = req.user!.id;
    
    if (!['easy', 'medium', 'hard', 'very_hard'].includes(newDifficulty)) {
      return res.status(400).json({ 
        error: 'Invalid difficulty. Must be: easy, medium, hard, or very_hard' 
      });
    }
    
    const result = await difficultyService.adjustDifficulty(id, newDifficulty, reason, adjustedBy);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/difficulty/adjustments/:questionId
 * Get adjustment history for a question
 */
router.get('/adjustments/:questionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const questionId = parseInt(req.params.questionId as string);
    
    const history = await difficultyService.getAdjustmentHistory(questionId);
    
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/difficulty/stats
 * Get difficulty statistics
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await difficultyService.getDifficultyStats();
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;