import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/permission';
import {
  createMockExam,
  publishMockExam,
  startMockExam,
  saveAnswer,
  toggleMark,
  submitMockExam,
  getMockExamResult,
  getMockExamHistory,
  getBenchmarkAnalysis,
  getWrongQuestionAnalysis,
  listMockExams,
  getMockExam,
  deleteMockExam,
} from '../services/mock-exam-service';

const router = Router();

// Admin: Create mock exam
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const exam = await createMockExam({
      title: req.body.title,
      standard: req.body.standard,
      totalScore: req.body.totalScore,
      duration: req.body.duration,
      difficultyRatio: req.body.difficultyRatio,
      knowledgePointWeights: req.body.knowledgePointWeights,
      creatorId: (req as any).user.id,
    });
    res.status(201).json(exam);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Admin: List all mock exams
router.get('/', requireAuth, async (req, res) => {
  try {
    const exams = await listMockExams(req.query.status as string);
    res.json(exams);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get mock exam by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const exam = await getMockExam(id);
    if (!exam) return res.status(404).json({ error: 'Not found' });
    res.json(exam);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: Publish mock exam
router.post('/:id/publish', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const exam = await publishMockExam(id, req.body?.startTime, req.body?.endTime);
    res.json(exam);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Admin: Delete mock exam
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    await deleteMockExam(id);
    res.json({ message: 'Deleted' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Start mock exam
router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await startMockExam(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Save answer
router.post('/:id/answer', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const answer = await saveAnswer({
      mockExamId: id,
      studentId: (req as any).user.id,
      questionId: req.body.questionId,
      answer: req.body.answer,
      imageUrl: req.body.imageUrl,
      timeSpent: req.body.timeSpent,
    });
    res.json(answer);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Toggle mark for review
router.post('/:id/mark/:questionId', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const questionId = parseInt(String(req.params.questionId));
    if (isNaN(id) || isNaN(questionId)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await toggleMark(id, (req as any).user.id, questionId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Submit mock exam
router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await submitMockExam(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Get exam result
router.get('/:id/result', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await getMockExamResult(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Get benchmark analysis
router.get('/:id/benchmark', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await getBenchmarkAnalysis(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Get wrong question analysis
router.get('/:id/wrong-analysis', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const result = await getWrongQuestionAnalysis(id, (req as any).user.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Student: Get mock exam history
router.get('/history/all', requireAuth, async (req, res) => {
  try {
    const history = await getMockExamHistory((req as any).user.id);
    res.json(history);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
