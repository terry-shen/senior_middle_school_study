/**
 * Exam Generation Routes
 * 自动出卷API路由
 */

import { Router, Request, Response } from 'express';
import { 
  ExamGenerationParams,
  generateExam,
  previewExam,
  replaceQuestion,
  getExam,
  getExams,
  updateExamStatus,
  deleteExam,
  saveAsTemplate,
  getTemplates,
  generateFromTemplate
} from '../services/exam-generation-service';
import { requireAuth, requireAdmin } from '../middleware/permission';
import { generateExamPDF, generateExamWord, ExportQuestion } from '../services/export-service';

const router = Router();

/**
 * POST /api/exams/generate
 * 生成试卷
 */
router.post('/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const params: ExamGenerationParams = req.body;
    const creatorId = (req as any).user.id;
    
    // 验证参数
    if (!params.name || !params.totalScore) {
      return res.status(400).json({ error: 'Missing required fields: name, totalScore' });
    }
    
    const result = await generateExam(params, creatorId);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exams/preview
 * 预览试卷（不保存）
 */
router.post('/preview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const params: ExamGenerationParams = req.body;
    const result = await previewExam(params);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exams
 * 获取试卷列表
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // 管理员可看所有，学生只看自己创建的
    const creatorId = user.role === 'admin' ? undefined : user.id;
    
    const result = await getExams(creatorId, status, page, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exams/:id
 * 获取试卷详情
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const exam = await getExam(id);
    
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json(exam);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exams/:id/replace
 * 替换试卷中的题目
 */
router.post('/:id/replace', requireAdmin, async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.id as string);
    const { questionIndex, newQuestionId } = req.body;
    
    if (questionIndex === undefined || !newQuestionId) {
      return res.status(400).json({ error: 'Missing required fields: questionIndex, newQuestionId' });
    }
    
    const result = await replaceQuestion(examId, questionIndex, newQuestionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/exams/:id/status
 * 更新试卷状态
 */
router.put('/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }
    
    await updateExamStatus(id, status);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/exams/:id
 * 删除试卷
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await deleteExam(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exams/templates
 * 保存为模板
 */
router.post('/templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const params: ExamGenerationParams = req.body;
    const creatorId = (req as any).user.id;
    
    const templateId = await saveAsTemplate(params, creatorId);
    res.status(201).json({ id: templateId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exams/templates
 * 获取模板列表
 */
router.get('/templates/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const templates = await getTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exams/templates/:id/generate
 * 从模板生成试卷
 */
router.post('/templates/:id/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id as string);
    const creatorId = (req as any).user.id;
    const customParams = req.body;
    
    const result = await generateFromTemplate(templateId, creatorId, customParams);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exams/:id/export/pdf
 * Export a generated exam as PDF (Task 10.5)
 */
router.get('/:id/export/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const exam = await getExam(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const items: ExportQuestion[] = exam.questions.map((q: any) => ({
      id: q.id,
      questionNumber: q.questionNumber,
      content: q.content,
      questionType: q.type || q.questionType,
      options: q.options,
      answer: q.answer,
      analysis: q.analysis,
      score: q.score,
    }));

    const filePath = await generateExamPDF({ title: exam.title, questions: items, totalScore: exam.totalScore });
    res.download(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exams/:id/export/word
 * Export a generated exam as Word (Task 10.6)
 */
router.get('/:id/export/word', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const exam = await getExam(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const items: ExportQuestion[] = exam.questions.map((q: any) => ({
      id: q.id,
      questionNumber: q.questionNumber,
      content: q.content,
      questionType: q.type || q.questionType,
      options: q.options,
      answer: q.answer,
      analysis: q.analysis,
      score: q.score,
    }));

    const filePath = await generateExamWord({ title: exam.title, questions: items, totalScore: exam.totalScore });
    res.download(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;