/**
 * Exam Session Routes
 *
 * 统一考试会话 API（合并原 mock-exams + online-exams + exams/generate）。
 * - mode=whole_paper: 整卷考试（试卷库发布）
 * - mode=online: 在线逐题考试
 * - source=auto: 从题库自动组卷
 */

import { Router, Request, Response } from 'express';
import * as ExamSessionService from '../services/exam-session-service';
import * as GradingService from '../services/grading-service';
import { requireAuth, requireAdmin } from '../middleware/permission';

const router = Router();

// ===== Admin =====

// 创建考试会话（支持 source=auto 自动组卷 / manual 手动选题 / library 整卷）
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const session = await ExamSessionService.createExamSession({
      title: body.title,
      mode: body.mode || (body.paperId ? 'whole_paper' : 'online'),
      source: body.source,
      content: body.questionIds ? JSON.stringify(body.questionIds) : body.content,
      paperId: body.paperId ? parseInt(String(body.paperId)) : undefined,
      totalScore: body.totalScore ? Number(body.totalScore) : undefined,
      duration: body.duration ? parseInt(String(body.duration)) : undefined,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      creatorId: (req as any).user.id,
      generationParams: body.generationParams || (body.source === 'auto' ? body : undefined),
    });
    res.status(201).json({ success: true, examSession: session });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 预览自动组卷
router.post('/preview', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await ExamSessionService.previewExamSession(req.body ?? {});
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 列表（admin 全量，支持 status/mode 筛选）
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await ExamSessionService.listExamSessions({
      status: (req.query.status as string) || undefined,
      mode: (req.query.mode as string) || undefined,
      subjectId: req.query.subjectId ? parseInt(String(req.query.subjectId)) : undefined,
      page: req.query.page ? parseInt(String(req.query.page)) : 1,
      limit: req.query.limit ? parseInt(String(req.query.limit)) : 20,
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 批改统计（放在 /:id 之前避免路由捕获）
router.get('/grading-stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const examSessionId = req.query.examSessionId ? parseInt(String(req.query.examSessionId)) : undefined;
    const stats = await GradingService.getGradingStats({ examSessionId });
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 某考试的所有提交（批改用）
router.get('/:id/submissions', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const submissions = await ExamSessionService.listExamSubmissions(id);
    res.json({ data: submissions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 批量判分
router.post('/:id/batch-grade', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await GradingService.batchGradeExamSession(id);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 发布
router.post('/:id/publish', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const session = await ExamSessionService.publishExamSession(id, req.body ?? {});
    res.json({ success: true, examSession: session });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 手动调整分数
router.post('/:id/adjust-grade', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { studentId, newScore, feedback } = req.body ?? {};
    if (isNaN(id) || !studentId) return res.status(400).json({ error: 'Invalid params' });
    const result = await GradingService.adjustGrade(id, parseInt(String(studentId)), Number(newScore), feedback);
    res.json({ success: true, submission: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 人工批改单题（解答题）
router.post('/:id/grade-answer', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { studentId, questionId, score, feedback } = req.body ?? {};
    if (isNaN(id) || !studentId || !questionId) return res.status(400).json({ error: 'Invalid params' });
    const result = await GradingService.gradeAnswerManually(
      id, parseInt(String(studentId)), parseInt(String(questionId)), Number(score), feedback
    );
    res.json({ success: true, submission: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 详情
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const session = await ExamSessionService.getExamSessionById(id);
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 删除
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    await ExamSessionService.deleteExamSession(id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Student =====

// 学生可见考试列表（含作答状态）
router.get('/student/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessions = await ExamSessionService.listExamSessionsForStudent(
    (req as any).user.id,
    req.query.subjectId ? parseInt(String(req.query.subjectId)) : undefined,
  );
    res.json(sessions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 开始考试
router.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await ExamSessionService.startExamSession(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 重做考试（学生）：清空本人答题记录，可重新作答并再次提交
router.post('/:id/reset', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const submission = await ExamSessionService.resetExamSubmission(id, (req as any).user.id);
    res.json({ success: true, submission });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 查看答卷（学生）：全部题目 + 本人答案 + 正确答案 + 解析
router.get('/:id/review', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const review = await ExamSessionService.getExamReview(id, (req as any).user.id);
    res.json(review);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 取消考试（管理员）：保留数据，状态回退为草稿，学生端不再可见
router.post('/:id/cancel', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const session = await ExamSessionService.cancelExamSession(id);
    res.json({ success: true, examSession: session });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 考试题目（在线模式）
router.get('/:id/questions', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const questions = await ExamSessionService.getExamQuestions(id);
    res.json({ data: questions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 保存答案（在线模式）
router.post('/:id/answer', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { questionId, answer, timeSpent } = req.body ?? {};
    if (isNaN(id) || !questionId) return res.status(400).json({ error: 'Invalid params' });
    const submission = await ExamSessionService.saveAnswer(
      id, (req as any).user.id, parseInt(String(questionId)), String(answer ?? ''), timeSpent
    );
    res.json({ success: true, submissionId: submission.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 标记题目
router.post('/:id/mark/:questionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const qid = parseInt(String(req.params.questionId));
    if (isNaN(id) || isNaN(qid)) return res.status(400).json({ error: 'Invalid ID' });
    const submission = await ExamSessionService.toggleMark(id, (req as any).user.id, qid);
    res.json({ success: true, submissionId: submission.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 提交考试
router.post('/:id/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const submission = await ExamSessionService.submitExamSession(id, (req as any).user.id);
    res.json(submission);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 我的答题记录
router.get('/:id/record', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const submission = await ExamSessionService.getStudentSubmission(id, (req as any).user.id);
    if (!submission) return res.status(404).json({ error: 'Not found' });
    res.json(submission);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 考试结果
router.get('/:id/result', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await ExamSessionService.getExamSessionResult(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 对标分析
router.get('/:id/benchmark', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await ExamSessionService.getBenchmarkAnalysis(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
