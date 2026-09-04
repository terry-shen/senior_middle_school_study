import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin } from '../middleware/permission';
import { parseDocx } from '../services/word-service';

const router = Router();
const prisma = new PrismaClient();

// Multer config: accept .docx/.doc, save to uploads/knowledge-points/
const kpUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../../uploads/knowledge-points');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Decode mojibake filename (UTF-8 read as latin1 by multer)
      const originalName = Buffer.isBuffer(file.originalname)
        ? file.originalname.toString('utf8')
        : Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName) || '.docx';
      const base = path.basename(originalName, ext).substring(0, 50);
      cb(null, `kp-${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 .docx 或 .doc 文件'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

// GET / — list all KP documents
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const docs = await prisma.knowledgePoint.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, contentMarkdown: true, createdAt: true, updatedAt: true }
    });
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:id — get single document
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const doc = await prisma.knowledgePoint.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST / — create new document
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, contentMarkdown } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const doc = await prisma.knowledgePoint.create({
      data: { name, contentMarkdown: contentMarkdown || null }
    });
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id — update document contentMarkdown
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const { name, contentMarkdown } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (contentMarkdown !== undefined) updateData.contentMarkdown = contentMarkdown;
    const doc = await prisma.knowledgePoint.update({ where: { id }, data: updateData });
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id — delete document
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    await prisma.knowledgePoint.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /import — upload .docx, convert via mammoth, create KnowledgePoint record
router.post('/import', requireAuth, requireAdmin, kpUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const baseName = path.basename(originalName, path.extname(originalName));
    const markdown = await parseDocx(filePath);
    const doc = await prisma.knowledgePoint.create({
      data: { name: baseName, contentMarkdown: markdown }
    });
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    res.status(201).json({ success: true, doc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
