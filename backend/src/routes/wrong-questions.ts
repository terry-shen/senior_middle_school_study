/**
 * Student Wrong Questions Routes
 *
 * 学生自主录入错题本：拍照/手动，重练自评，掌握度概览，浏览器打印导出。
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as WrongQuestionsService from '../services/wrong-questions-service';
import { requireAuth } from '../middleware/permission';

const router = Router();

// 拍照题图片上传配置
const wrongImageDir = path.join(__dirname, '../../uploads/wrong-questions');
if (!fs.existsSync(wrongImageDir)) {
  fs.mkdirSync(wrongImageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, wrongImageDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `wq-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    // Accept by MIME type OR by file extension (some clients omit MIME type)
    const ext = path.extname(file.originalname || '').toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic'];
    if (/^image\//.test(file.mimetype || '') || imageExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片上传'));
    }
  },
});

// 创建错题（手动录入，JSON body）
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const data = req.body ?? {};
    const created = await WrongQuestionsService.createWrongQuestion(studentId, {
      source: 'manual',
      content: data.content ?? null,
      options: data.options ?? null,
      myAnswer: data.myAnswer ?? null,
      correctAnswer: data.correctAnswer ?? null,
      analysis: data.analysis ?? null,
      questionType: data.questionType ?? 'unknown',
      difficulty: data.difficulty ?? 'unknown',
      knowledgePointTags: data.knowledgePointTags ?? null,
      notes: data.notes ?? null,
    });
    res.status(201).json({ success: true, wrongQuestion: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 拍照上传错题（multipart/form-data, field: image）
router.post('/upload-photo', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未收到图片文件' });
    }
    const studentId = req.user!.id;
    const imageUrl = `/uploads/wrong-questions/${req.file.filename}`;
    const data = req.body ?? {};
    const created = await WrongQuestionsService.createWrongQuestion(studentId, {
      source: 'photo',
      imageUrl,
      content: data.content || null,
      questionType: data.questionType || 'unknown',
      difficulty: data.difficulty || 'unknown',
      knowledgePointTags: data.knowledgePointTags || null,
      myAnswer: data.myAnswer || null,
      correctAnswer: data.correctAnswer || null,
      analysis: data.analysis || null,
      notes: data.notes || null,
    });
    res.status(201).json({ success: true, wrongQuestion: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 列表查询（多维筛选 + 分页 + 视图消减）
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const filters: WrongQuestionsService.WrongQuestionFilters = {
      questionType: (req.query.questionType as string) || undefined,
      difficulty: (req.query.difficulty as string) || undefined,
      tag: (req.query.tag as string) || undefined,
      reviewStatus: (req.query.reviewStatus as string) || undefined,
      viewMode: (req.query.viewMode as 'unmastered' | 'all') || 'unmastered',
      sortBy: (req.query.sortBy as 'createdAt' | 'lastReviewAt') || 'createdAt',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };
    const result = await WrongQuestionsService.getWrongQuestions(studentId, filters);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 掌握度概览
router.get('/mastery-overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const overview = await WrongQuestionsService.getMasteryOverview(studentId);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 打印导出数据
router.get('/print-export', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const idsRaw = (req.query.ids as string) || '';
    const ids = idsRaw
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) {
      return res.status(400).json({ error: '请选择至少一道错题' });
    }
    const includeAnswerAnalysis = req.query.includeAnswerAnalysis === 'true';
    const data = await WrongQuestionsService.getPrintExportData(
      studentId,
      ids,
      includeAnswerAnalysis
    );
    res.json({ success: true, items: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 详情
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const item = await WrongQuestionsService.getWrongQuestionById(id, studentId);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新（补录题面/编辑）
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const updated = await WrongQuestionsService.updateWrongQuestion(id, studentId, req.body ?? {});
    res.json({ success: true, wrongQuestion: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await WrongQuestionsService.deleteWrongQuestion(id, studentId);
    res.json({ success: true, deleted: result.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 重练自评
router.post('/:id/practice', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { selfAssessment, userAnswer } = req.body ?? {};
    if (selfAssessment !== 'correct' && selfAssessment !== 'wrong') {
      return res.status(400).json({ error: "selfAssessment must be 'correct' or 'wrong'" });
    }
    const result = await WrongQuestionsService.practiceWrongQuestion(
      id,
      studentId,
      selfAssessment,
      userAnswer
    );
    res.json({ success: true, wrongQuestion: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 标记/取消掌握
router.put('/:id/mastered', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { mastered } = req.body ?? {};
    const result = await WrongQuestionsService.setMastered(id, studentId, Boolean(mastered));
    res.json({ success: true, wrongQuestion: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
