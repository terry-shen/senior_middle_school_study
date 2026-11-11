import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import classRoutes from './routes/classes';
import netdiskRoutes from './routes/netdisk';
import subjectRoutes from './routes/subjects';
import aiAssistantRoutes from './routes/ai-assistants';
import chapterRoutes from './routes/chapters';
import netdiskIndexRoutes from './routes/netdisk-index';
import learningRoutes from './routes/learning';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim();
app.use(
  cors({
    // 生产容器内经 nginx 同源访问，无需跨域；如需跨域在 CORS_ORIGIN 指定（逗号分隔）
    origin: CORS_ORIGIN ? CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
    // Expose Content-Disposition so cross-origin blob downloads can read the server-provided filename
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'High School Learning System API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to High School Learning System API',
    version: '3.0.0',
    endpoints: {
      auth: '/api/auth',
      students: '/api/students',
      classes: '/api/classes',
      subjects: '/api/subjects',
      chapters: '/api/chapters',
      learning: '/api/learning',
      netdisk: '/api/netdisk',
      netdiskIndex: '/api/netdisk-index',
      aiAssistants: '/api/ai-assistants',
    },
  });
});

// Auth routes
try {
  app.use('/api/auth', authRoutes);
  console.log('Auth routes registered at /api/auth');
} catch (error) {
  console.error('Failed to register Auth routes:', error);
}

// Student routes
try {
  app.use('/api/students', studentRoutes);
  console.log('Student routes registered at /api/students');
} catch (error) {
  console.error('Failed to register Student routes:', error);
}

// Class routes
try {
  app.use('/api/classes', classRoutes);
  console.log('Class routes registered at /api/classes');
} catch (error) {
  console.error('Failed to register Class routes:', error);
}

// Subject routes (read-only directory)
try {
  app.use('/api/subjects', subjectRoutes);
  console.log('Subject routes registered at /api/subjects');
} catch (error) {
  console.error('Failed to register Subject routes:', error);
}

// Chapter taxonomy routes
try {
  app.use('/api/chapters', chapterRoutes);
  console.log('Chapter routes registered at /api/chapters');
} catch (error) {
  console.error('Failed to register Chapter routes:', error);
}

// Chapter learning routes (resources / progress / video series)
try {
  app.use('/api/learning', learningRoutes);
  console.log('Learning routes registered at /api/learning');
} catch (error) {
  console.error('Failed to register Learning routes:', error);
}

// Netdisk routes (browse + stream)
try {
  app.use('/api/netdisk', netdiskRoutes);
  console.log('Netdisk routes registered at /api/netdisk');
} catch (error) {
  console.error('Failed to register Netdisk routes:', error);
}

// Netdisk indexing / mapping routes
try {
  app.use('/api/netdisk-index', netdiskIndexRoutes);
  console.log('Netdisk index routes registered at /api/netdisk-index');
} catch (error) {
  console.error('Failed to register Netdisk index routes:', error);
}

// AI assistant directory routes
try {
  app.use('/api/ai-assistants', aiAssistantRoutes);
  console.log('AI assistant routes registered at /api/ai-assistants');
} catch (error) {
  console.error('Failed to register AI assistant routes:', error);
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints: http://localhost:${PORT}/api`);
});

export default app;
