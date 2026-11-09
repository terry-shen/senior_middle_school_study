import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/permission';
import {
  TaxonomyError,
  getTaxonomyTree,
  listSectionsFlat,
  createTextbook,
  updateTextbook,
  deleteTextbook,
  createChapter,
  updateChapter,
  deleteChapter,
  createSection,
  updateSection,
  deleteSection,
  countSectionReferences,
} from '../services/chapter-taxonomy-service';

const router = Router();

function fail(res: any, e: unknown, fallback = '操作失败') {
  if (e instanceof TaxonomyError) {
    return res.status(e.statusCode).json({ error: e.message });
  }
  console.error('[chapters] error:', e);
  return res.status(500).json({ error: (e as Error)?.message || fallback });
}

function toId(raw: unknown): number {
  return parseInt(String(raw), 10);
}

// GET /api/chapters/tree?subjectId=2  —— 教材/章/节树
router.get('/tree', requireAuth, async (req, res) => {
  try {
    const subjectIdRaw = req.query.subjectId;
    const subjectId = subjectIdRaw ? toId(subjectIdRaw) : undefined;
    const data = await getTaxonomyTree(subjectId && !Number.isNaN(subjectId) ? subjectId : undefined);
    res.json({ success: true, data });
  } catch (e) {
    fail(res, e, '获取章节树失败');
  }
});

// GET /api/chapters/sections?subjectId=2 —— 扁平节列表
router.get('/sections', requireAuth, async (req, res) => {
  try {
    const subjectIdRaw = req.query.subjectId;
    const subjectId = subjectIdRaw ? toId(subjectIdRaw) : undefined;
    const data = await listSectionsFlat(subjectId && !Number.isNaN(subjectId) ? subjectId : undefined);
    res.json({ success: true, data });
  } catch (e) {
    fail(res, e, '获取小节列表失败');
  }
});

// ---------- Textbook ----------
router.post('/textbooks', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subjectId, name, edition, grade, order } = req.body || {};
    const sid = toId(subjectId);
    if (Number.isNaN(sid)) return res.status(400).json({ error: 'subjectId 无效' });
    const tb = await createTextbook({ subjectId: sid, name, edition, grade, order });
    res.status(201).json({ success: true, textbook: tb });
  } catch (e) {
    fail(res, e, '创建教材失败');
  }
});

router.put('/textbooks/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID 无效' });
    const { name, edition, grade, order } = req.body || {};
    const tb = await updateTextbook(id, { name, edition, grade, order });
    res.json({ success: true, textbook: tb });
  } catch (e) {
    fail(res, e, '更新教材失败');
  }
});

router.delete('/textbooks/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID 无效' });
    res.json(await deleteTextbook(id));
  } catch (e) {
    fail(res, e, '删除教材失败');
  }
});

// ---------- Chapter ----------
router.post('/chapters', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { textbookId, title, order } = req.body || {};
    const tid = toId(textbookId);
    if (Number.isNaN(tid)) return res.status(400).json({ error: 'textbookId 无效' });
    const ch = await createChapter({ textbookId: tid, title, order });
    res.status(201).json({ success: true, chapter: ch });
  } catch (e) {
    fail(res, e, '创建章节失败');
  }
});

router.put('/chapters/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID 无效' });
    const { title, order } = req.body || {};
    const ch = await updateChapter(id, { title, order });
    res.json({ success: true, chapter: ch });
  } catch (e) {
    fail(res, e, '更新章节失败');
  }
});

router.delete('/chapters/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID 无效' });
    res.json(await deleteChapter(id));
  } catch (e) {
    fail(res, e, '删除章节失败');
  }
});

// ---------- Section ----------
router.get('/sections/:id/references', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID 无效' });
    res.json({ success: true, ...(await countSectionReferences(id)) });
  } catch (e) {
    fail(res, e, '查询引用失败');
  }
});

router.post('/sections', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { chapterId, title, order } = req.body || {};
    const cid = toId(chapterId);
    if (Number.isNaN(cid)) return res.status(400).json({ error: 'chapterId 无效' });
    const sec = await createSection({ chapterId: cid, title, order });
    res.status(201).json({ success: true, section: sec });
  } catch (e) {
    fail(res, e, '创建小节失败');
  }
});

router.put('/sections/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID 无效' });
    const { title, order } = req.body || {};
    const sec = await updateSection(id, { title, order });
    res.json({ success: true, section: sec });
  } catch (e) {
    fail(res, e, '更新小节失败');
  }
});

router.delete('/sections/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID 无效' });
    res.json(await deleteSection(id));
  } catch (e) {
    fail(res, e, '删除小节失败');
  }
});

export default router;
