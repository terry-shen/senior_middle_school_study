/**
 * Paper Library routes — 试卷库（整卷生命周期管理）
 *
 * Whole-paper (purpose=whole_paper) management:
 * - Multi-dimensional filtered query (subject/year/region/examType/school)
 * - Metadata edit (incl. subject/school)
 * - Publish a paper as a MockExam (whole-paper mode) + auto-assign all students
 * - Unpublish (delete the MockExam + its answer sheets)
 * - Recovery list: per-MockExam submission/grading progress
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/permission';
import * as ExamSessionService from '../services/exam-session-service';

const router = Router();
const prisma = new PrismaClient();

/** Convert a route param that Express 5 types as string | string[] to a number */
function toInt(v: unknown): number | null {
  const n = Array.isArray(v) ? v[0] : v;
  const r = parseInt(String(n), 10);
  return isNaN(r) ? null : r;
}

/**
 * GET /api/paper-library — multi-dimensional filter query (whole_paper only, paginated)
 * Query params: subject, year, region, examType, school, keyword, purpose(=whole_paper), page, limit
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = toInt(req.query.page) || 1;
    const limit = Math.min(toInt(req.query.limit) || 20, 100);
    const keyword = req.query.keyword as string | undefined;
    const where: any = {
      purpose: (req.query.purpose as string) || 'whole_paper',
      ...(req.query.subjectId ? { subjectId: toInt(req.query.subjectId) ?? undefined } : {}),
      ...(req.query.year ? { year: toInt(req.query.year) ?? undefined } : {}),
      ...(req.query.region ? { region: req.query.region as string } : {}),
      ...(req.query.examType ? { examType: req.query.examType as string } : {}),
      ...(req.query.school ? { school: { contains: req.query.school as string } } : {}),
      ...(keyword ? { title: { contains: keyword } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.examPaper.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, icon: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.examPaper.count({ where }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/paper-library/filters — distinct values for filter dropdowns
 * Returns subject/year/region/examType/school lists computed from whole_paper rows.
 */
router.get('/filters', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows, subjects] = await Promise.all([
      prisma.examPaper.findMany({
        where: { purpose: 'whole_paper' },
        select: { subjectId: true, year: true, region: true, examType: true, school: true },
      }),
      prisma.subject.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
    ]);
    const uniq = (arr: (string | number | null)[]) => Array.from(new Set(arr.filter((v) => v !== null && v !== ''))).map(v => String(v));
    const usedSubjectIds = new Set(rows.map((r) => r.subjectId).filter((v) => v !== null));
    res.json({
      // subjects: dictionary rows (id/name/color) — mark which ones actually have papers
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, color: s.color, hasPapers: usedSubjectIds.has(s.id) })),
      years: uniq(rows.map((r) => r.year)).sort((a, b) => Number(b) - Number(a)),
      regions: uniq(rows.map((r) => r.region)).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      examTypes: uniq(rows.map((r) => r.examType)).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      schools: uniq(rows.map((r) => r.school)).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/paper-library/:id — paper detail
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const paper = await prisma.examPaper.findUnique({
      where: { id },
      include: { subject: { select: { id: true, name: true, icon: true } } },
    });
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    res.json(paper);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /api/paper-library/:id — update metadata (incl. subject/school)
 */
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const { title, source, year, region, examType, totalScore, duration, subjectId, school, status } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (source !== undefined) data.source = source;
    if (year !== undefined) data.year = year === '' || year === null ? null : parseInt(String(year));
    if (region !== undefined) data.region = region;
    if (examType !== undefined) data.examType = examType;
    if (totalScore !== undefined) data.totalScore = totalScore === '' || totalScore === null ? null : parseInt(String(totalScore));
    if (duration !== undefined) data.duration = duration === '' || duration === null ? null : parseInt(String(duration));
    if (subjectId !== undefined) data.subjectId = subjectId === '' || subjectId === null ? null : parseInt(String(subjectId));
    if (school !== undefined) data.school = school === '' ? null : school;
    if (status !== undefined) data.status = status;
    const paper = await prisma.examPaper.update({ where: { id }, data });
    res.json(paper);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/paper-library/:id/publish — publish this whole paper as an ExamSession
 * Creates ExamSession(mode=whole_paper, source=library, paperId, questionIds=[])
 * then immediately publishes it (students see all published whole-paper exams).
 */
router.post('/:id/publish', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  let createdSessionId: number | null = null;
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const paper = await prisma.examPaper.findUnique({ where: { id } });
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.purpose !== 'whole_paper') return res.status(400).json({ error: 'Only whole_paper can be published as exam' });

    const adminId = (req as any).user?.id;
    const session = await ExamSessionService.createExamSession({
      title: paper.title,
      mode: 'whole_paper',
      source: 'library',
      paperId: paper.id,
      subjectId: paper.subjectId ?? undefined,
      totalScore: paper.totalScore || 100,
      duration: paper.duration || 120,
      startTime: req.body?.startTime ?? null,
      endTime: req.body?.endTime ?? null,
      creatorId: adminId,
    });
    createdSessionId = session.id;
    await ExamSessionService.publishExamSession(session.id, {});
    createdSessionId = null;
    // Mark the paper itself as published (2-state lifecycle: pending/published)
    await prisma.examPaper.update({ where: { id: paper.id }, data: { status: 'published' } });
    res.status(201).json({ success: true, mockExamId: session.id, examSessionId: session.id, examSession: { ...session, status: 'published' } });
  } catch (e: any) {
    // Roll back the draft so a failed publish does not leave an orphan session.
    if (createdSessionId !== null) {
      try {
        await ExamSessionService.deleteExamSession(createdSessionId);
      } catch (rollbackErr) {
        console.error('[paper-library] failed to roll back exam session', createdSessionId, rollbackErr);
      }
    }
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/paper-library/:id/unpublish — cancel a published whole-paper exam
 * Deletes the ExamSession and any answer sheets linked to it.
 */
router.delete('/:id/unpublish', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const session = await prisma.examSession.findFirst({ where: { paperId: id } });
    if (!session) return res.status(404).json({ error: 'No exam session found for this paper' });

    await ExamSessionService.deleteExamSession(session.id);
    // Reset paper back to pending (2-state lifecycle)
    await prisma.examPaper.update({ where: { id }, data: { status: 'pending' } });
    res.json({ success: true, removedMockExamId: session.id, removedExamSessionId: session.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/paper-library/recovery — recovery/grading progress per published paper
 * Groups answer sheets by ExamSession(paperId): uploaded/graded counts + student breakdown.
 */
router.get('/recovery/all', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.examSession.findMany({
      where: { paperId: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: {
        paper: { select: { id: true, title: true, subject: { select: { id: true, name: true } }, year: true, region: true } },
      },
    });
    const groups = [];
    for (const session of sessions) {
      const sheets = await prisma.answerSheet.findMany({
        where: { examSessionId: session.id },
        select: { id: true, studentId: true, status: true, totalScore: true, fileUrl: true, createdAt: true },
      });
      const sheetsByStudent = new Map<number, any>();
      for (const s of sheets) {
        sheetsByStudent.set(s.studentId, s);
      }
      groups.push({
        mockExamId: session.id,
        examSessionId: session.id,
        paper: session.paper,
        createdAt: session.createdAt,
        status: session.status,
        totalStudents: 0,
        uploaded: sheets.length,
        graded: sheets.filter((s) => s.status === 'graded').length,
        pending: sheets.filter((s) => s.status === 'submitted').length,
        sheetsByStudent: Array.from(sheetsByStudent.values()),
      });
    }
    res.json({ groups });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Publish body size — routes above handle their own bodies

export default router;