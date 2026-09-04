/**
 * Prompt Template Routes
 * API endpoints for prompt template management with version control
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/prompts/templates
 * List all prompt templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { taskType, active } = req.query;
    
    const where: any = {};
    if (taskType) {
      where.taskType = taskType as string;
    }
    if (active !== undefined) {
      where.isActive = active === 'true';
    }
    
    const templates = await prisma.promptTemplate.findMany({
      where,
      orderBy: [
        { taskType: 'asc' },
        { version: 'desc' }
      ]
    });
    
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prompts/templates/:id
 * Get a specific prompt template
 */
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    
    const template = await prisma.promptTemplate.findUnique({
      where: { id }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prompts/templates/type/:taskType
 * Get active template for a specific task type
 */
router.get('/templates/type/:taskType', async (req: Request, res: Response) => {
  try {
    const taskType = req.params.taskType as string;
    
    const template = await prisma.promptTemplate.findFirst({
      where: {
        taskType,
        isActive: true
      },
      orderBy: {
        version: 'desc'
      }
    });
    
    if (!template) {
      return res.status(404).json({ 
        error: `No active template found for task type: ${taskType}` 
      });
    }
    
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prompts/templates/type/:taskType/versions
 * Get all versions of a specific task type
 */
router.get('/templates/type/:taskType/versions', async (req: Request, res: Response) => {
  try {
    const taskType = req.params.taskType as string;
    
    const templates = await prisma.promptTemplate.findMany({
      where: { taskType },
      orderBy: { version: 'desc' }
    });
    
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompts/templates
 * Create a new prompt template
 */
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { taskType, name, template, isActive } = req.body;
    
    // Validate required fields
    if (!taskType || !name || !template) {
      return res.status(400).json({ 
        error: 'Missing required fields: taskType, name, template' 
      });
    }
    
    // Find the highest version for this taskType
    const latestTemplate = await prisma.promptTemplate.findFirst({
      where: { taskType },
      orderBy: { version: 'desc' }
    });
    
    const version = latestTemplate ? latestTemplate.version + 1 : 1;
    
    // If isActive is true, deactivate other versions of the same taskType
    if (isActive !== false) {
      await prisma.promptTemplate.updateMany({
        where: {
          taskType,
          isActive: true
        },
        data: { isActive: false }
      });
    }
    
    const newTemplate = await prisma.promptTemplate.create({
      data: {
        taskType,
        name,
        template,
        version,
        isActive: isActive !== false
      }
    });
    
    res.status(201).json(newTemplate);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/prompts/templates/:id
 * Update a prompt template
 */
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, template, isActive } = req.body;
    
    // Check if template exists
    const existing = await prisma.promptTemplate.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // If isActive is being set to true, deactivate other versions
    if (isActive === true && !existing.isActive) {
      await prisma.promptTemplate.updateMany({
        where: {
          taskType: existing.taskType,
          isActive: true,
          id: { not: id }
        },
        data: { isActive: false }
      });
    }
    
    const updated = await prisma.promptTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(template && { template }),
        ...(isActive !== undefined && { isActive })
      }
    });
    
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/prompts/templates/:id
 * Delete a prompt template
 */
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    
    const existing = await prisma.promptTemplate.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await prisma.promptTemplate.delete({
      where: { id }
    });
    
    res.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompts/templates/:id/activate
 * Activate a specific template version
 */
router.post('/templates/:id/activate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    
    const template = await prisma.promptTemplate.findUnique({
      where: { id }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Deactivate all other versions of the same taskType
    await prisma.promptTemplate.updateMany({
      where: {
        taskType: template.taskType,
        isActive: true,
        id: { not: id }
      },
      data: { isActive: false }
    });
    
    // Activate this template
    const activated = await prisma.promptTemplate.update({
      where: { id },
      data: { isActive: true }
    });
    
    res.json(activated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prompts/task-types
 * Get list of supported task types
 */
router.get('/task-types', (req: Request, res: Response) => {
  const taskTypes = [
    'knowledge_identification',
    'analysis_generation',
    'answer_generation',
    'difficulty_assessment',
    'choice_grading',
    'fill_grading',
    'essay_grading'
  ];
  
  res.json(taskTypes);
});

export default router;