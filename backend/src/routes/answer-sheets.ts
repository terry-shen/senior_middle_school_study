import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();
const prisma = new PrismaClient();

// Multer storage for answer sheet files (images + word docs)
const sheetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/answer-sheets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Fix mojibake filename (latin1 -> utf8)
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `sheet-${uniqueSuffix}${ext}`);
  },
});

const sheetUpload = multer({
  storage: sheetStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.doc', '.docx'];
    if (allowed.includes(ext) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片（jpg/png/webp 等）或 Word 文档（.doc/.docx）'));
    }
  },
});

/**
 * POST /api/answer-sheets/upload
 * 学生上传答题纸。Body form-data: file (required), examId | mockExamId | wholePaperId (one of)
 */
router.post('/upload', requireAuth, sheetUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const studentId = req.user!.id;
    // 统一考试会话（兼容旧 examId/mockExamId/wholePaperId 参数名，全部映射到 examSessionId）
    const examSessionId = req.body.examSessionId
      ? parseInt(req.body.examSessionId)
      : req.body.examId
      ? parseInt(req.body.examId)
      : req.body.mockExamId
      ? parseInt(req.body.mockExamId)
      : req.body.wholePaperId
      ? parseInt(req.body.wholePaperId)
      : null;

    if (!examSessionId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '必须指定 examSessionId（或旧的 examId/mockExamId/wholePaperId）' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext) || req.file.mimetype.startsWith('image/');
    const fileType = isImage ? 'image' : 'word';

    // Replace this student's previous answer sheet for the same scene (re-upload)
    const where: any = { studentId, examSessionId };
    const existing = await prisma.answerSheet.findFirst({ where });
    if (existing) {
      // Delete previous file
      try {
        const prevPath = path.join(__dirname, '../..', existing.fileUrl);
        if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
        if (existing.gradedFileUrl) {
          const prevGraded = path.join(__dirname, '../..', existing.gradedFileUrl);
          if (fs.existsSync(prevGraded)) fs.unlinkSync(prevGraded);
        }
      } catch {
        /* ignore file cleanup errors */
      }
      await prisma.answerSheet.delete({ where: { id: existing.id } });
    }

    const sheet = await prisma.answerSheet.create({
      data: {
        studentId,
        examSessionId,
        fileUrl: `/uploads/answer-sheets/${req.file.filename}`,
        fileType,
        fileName: originalName,
        status: 'submitted',
      },
    });

    res.status(201).json({ success: true, answerSheet: sheet });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '上传失败' });
  }
});

/**
 * POST /api/answer-sheets/upload-graded
 * 老师上传批改版 Word 答题纸（离线批注后回传）。Body: file + id (answerSheetId)
 */
router.post('/upload-graded', requireAuth, requireAdmin, sheetUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未上传文件' });
    const id = parseInt(req.body.id);
    if (!id) return res.status(400).json({ error: '缺少答题纸 id' });

    const sheet = await prisma.answerSheet.findUnique({ where: { id } });
    if (!sheet) return res.status(404).json({ error: '答题纸不存在' });

    // Delete previous graded file
    if (sheet.gradedFileUrl) {
      try {
        const prev = path.join(__dirname, '../..', sheet.gradedFileUrl);
        if (fs.existsSync(prev)) fs.unlinkSync(prev);
      } catch {
        /* ignore */
      }
    }

    const updated = await prisma.answerSheet.update({
      where: { id },
      data: { gradedFileUrl: `/uploads/answer-sheets/${req.file.filename}` },
    });
    res.json({ success: true, answerSheet: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '上传失败' });
  }
});

/**
 * GET /api/answer-sheets/mine
 * 学生查看自己的答题纸列表（含批改状态）
 */
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const sheets = await prisma.answerSheet.findMany({
      where: { studentId },
      include: {
        // 给前端展示场景标题用
      },
      orderBy: { createdAt: 'desc' },
    });
    // Attach scene titles via separate queries (avoid complex Prisma joins across 3 optional FKs)
    const enriched = await Promise.all(
      sheets.map(async (s) => {
        let sceneTitle = '未知场景';
        let sceneType = '';
        if (s.examSessionId) {
          const es = await prisma.examSession.findUnique({ where: { id: s.examSessionId }, select: { title: true, mode: true } });
          sceneTitle = es?.title || '考试';
          sceneType = es?.mode === 'whole_paper' ? 'whole_paper' : 'online_exam';
        }
        return { ...s, sceneTitle, sceneType };
      })
    );
    res.json({ success: true, answerSheets: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '查询失败' });
  }
});

/**
 * GET /api/answer-sheets/pending
 * 老师查看待批改答题纸列表
 */
router.get('/pending', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'submitted';
    const where: any = {};
    if (status === 'submitted') where.status = 'submitted';
    else if (status === 'graded') where.status = 'graded';
    else if (status === 'all') {
      // no status filter
    } else {
      where.status = status;
    }

    const sheets = await prisma.answerSheet.findMany({
      where,
      include: { student: { select: { id: true, name: true, studentId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      sheets.map(async (s) => {
        let sceneTitle = '未知场景';
        let sceneType = '';
        if (s.examSessionId) {
          const es = await prisma.examSession.findUnique({ where: { id: s.examSessionId }, select: { title: true, mode: true } });
          sceneTitle = es?.title || '考试';
          sceneType = es?.mode === 'whole_paper' ? 'whole_paper' : 'online_exam';
        }
        return { ...s, sceneTitle, sceneType };
      })
    );
    res.json({ success: true, answerSheets: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '查询失败' });
  }
});

/**
 * GET /api/answer-sheets/:id
 * 查看单个答题纸（学生只看自己；老师可看任意）
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: '无效 ID' });

    const sheet = await prisma.answerSheet.findUnique({
      where: { id },
      include: { student: { select: { id: true, name: true, studentId: true } } },
    });
    if (!sheet) return res.status(404).json({ error: '答题纸不存在' });

    // Permission: student can only see own; admin can see all
    if (req.user!.role !== 'admin' && sheet.studentId !== req.user!.id) {
      return res.status(403).json({ error: '无权查看他人答题纸' });
    }

    let sceneTitle = '未知场景';
    let sceneType = '';
    if (sheet.examSessionId) {
      const es = await prisma.examSession.findUnique({ where: { id: sheet.examSessionId }, select: { title: true, mode: true } });
      sceneTitle = es?.title || '考试';
      sceneType = es?.mode === 'whole_paper' ? 'whole_paper' : 'online_exam';
    }
    res.json({ success: true, answerSheet: { ...sheet, sceneTitle, sceneType } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '查询失败' });
  }
});

/**
 * PUT /api/answer-sheets/:id/grade
 * 老师保存批改：批注 JSON + 总分 + 评语（gradedFileUrl 通过 /upload-graded 单独传）
 */
router.put('/:id/grade', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: '无效 ID' });

    const { annotations, totalScore, teacherComment } = req.body;
    const updated = await prisma.answerSheet.update({
      where: { id },
      data: {
        ...(annotations !== undefined && { annotations: typeof annotations === 'string' ? annotations : JSON.stringify(annotations) }),
        ...(totalScore !== undefined && { totalScore: parseInt(totalScore) }),
        ...(teacherComment !== undefined && { teacherComment }),
        gradedBy: req.user!.id,
        gradedAt: new Date(),
        status: 'graded',
      },
    });
    res.json({ success: true, answerSheet: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '批改失败' });
  }
});

/**
 * DELETE /api/answer-sheets/:id
 * 老师删除答题纸（含文件清理）
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: '无效 ID' });

    const sheet = await prisma.answerSheet.findUnique({ where: { id } });
    if (!sheet) return res.status(404).json({ error: '答题纸不存在' });

    // Cleanup files
    try {
      const fp = path.join(__dirname, '../..', sheet.fileUrl);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      if (sheet.gradedFileUrl) {
        const gp = path.join(__dirname, '../..', sheet.gradedFileUrl);
        if (fs.existsSync(gp)) fs.unlinkSync(gp);
      }
    } catch {
      /* ignore */
    }

    await prisma.answerSheet.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '删除失败' });
  }
});

export default router;