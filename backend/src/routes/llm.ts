/**
 * LLM Routes
 * API endpoints for LLM model management
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LLMService } from '../services/llm-service';

const router = Router();
const prisma = new PrismaClient();
const llmService = new LLMService(prisma);

// Test route to verify router is working
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'LLM routes are working!' });
});

/**
 * GET /api/llm/models
 * Get all active LLM configurations
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await llmService.getActiveModels();
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/llm/models/:id
 * Get a specific LLM configuration
 */
router.get('/models/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    // Note: This requires adding a getModel method to LLMService
    // For now, return 501 Not Implemented
    res.status(501).json({ error: 'Not implemented' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/llm/models
 * Add a new LLM configuration
 */
router.post('/models', async (req: Request, res: Response) => {
  try {
    const model = await llmService.addModel(req.body);
    res.status(201).json(model);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/llm/models/:id
 * Update an existing LLM configuration
 */
router.put('/models/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    // Note: This requires adding an updateModel method to LLMService
    // For now, return 501 Not Implemented
    res.status(501).json({ error: 'Not implemented' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/llm/models/:id
 * Delete an LLM configuration
 */
router.delete('/models/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    // Note: This requires adding a deleteModel method to LLMService
    // For now, return 501 Not Implemented
    res.status(501).json({ error: 'Not implemented' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/llm/models/:id/test
 * Test connection to an LLM provider
 */
router.post('/models/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const result = await llmService.testConnection(id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/llm/models/:id/default
 * Set default model
 */
router.post('/models/:id/default', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await llmService.setDefaultModel(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/llm/stats
 * Get call statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId ? parseInt(req.query.modelId as string) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const stats = await llmService.getCallStats(modelId, startDate, endDate);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/llm/calls
 * Get recent call logs
 */
router.get('/calls', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const modelId = req.query.modelId ? parseInt(req.query.modelId as string) : undefined;
    
    const calls = await llmService.getRecentCalls(limit, modelId);
    res.json(calls);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;