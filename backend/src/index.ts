import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import llmRoutes from './routes/llm';
import promptTemplateRoutes from './routes/prompt-template';
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import classRoutes from './routes/classes';
import paperRoutes from './routes/papers';
import examSessionRoutes from './routes/exam-sessions';
import netdiskRoutes from './routes/netdisk';
import videoLibraryRoutes from './routes/video-library';
import gradingRoutes from './routes/grading';
import wrongQuestionsRoutes from './routes/wrong-questions';
import incentiveRoutes from './routes/incentive';
import answerSheetRoutes from './routes/answer-sheets';
import paperLibraryRoutes from './routes/paper-library';
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
app.use(
  cors({
    // Expose Content-Disposition so cross-origin blob downloads can read the server-provided filename
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (answer images, paper images, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Math Learning System API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Math Learning System API',
    version: '1.0.0',
    endpoints: {
      llm: '/api/llm',
      prompts: '/api/prompts',
      auth: '/api/auth',
      students: '/api/students',
      classes: '/api/classes',
      papers: '/api/papers',
      paperLibrary: '/api/paper-library',
      examSessions: '/api/exam-sessions',
      answerSheets: '/api/answer-sheets',
      netdisk: '/api/netdisk',
      videoLibrary: '/api/video-resources',
      wrongQuestions: '/api/wrong-questions',
      incentive: '/api/incentive',
      subjects: '/api/subjects',
    },
  });
});

// LLM routes
try {
  app.use('/api/llm', llmRoutes);
  console.log('LLM routes registered at /api/llm');
} catch (error) {
  console.error('Failed to register LLM routes:', error);
}

// Prompt Template routes
try {
  app.use('/api/prompts', promptTemplateRoutes);
  console.log('Prompt Template routes registered at /api/prompts');
} catch (error) {
  console.error('Failed to register Prompt Template routes:', error);
}

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

// Paper routes
try {
  app.use('/api/papers', paperRoutes);
  console.log('Paper routes registered at /api/papers');
} catch (error) {
  console.error('Failed to register Paper routes:', error);
}

// Exam Session routes (unified: whole_paper + online)
try {
  app.use('/api/exam-sessions', examSessionRoutes);
  console.log('Exam Session routes registered at /api/exam-sessions');
} catch (error) {
  console.error('Failed to register Exam Session routes:', error);
}

// Netdisk + Video Library routes
try {
  app.use('/api/netdisk', netdiskRoutes);
  app.use('/api/video-resources', videoLibraryRoutes);
  console.log('Netdisk + Video Library routes registered');
} catch (error) {
  console.error('Failed to register Netdisk/Video routes:', error);
}

// Grading routes
try {
  app.use('/api/grading', gradingRoutes);
  console.log('Grading routes registered at /api/grading');
} catch (error) {
  console.error('Failed to register Grading routes:', error);
}

// Wrong Questions routes
try {
  app.use('/api/wrong-questions', wrongQuestionsRoutes);
  console.log('Wrong Questions routes registered at /api/wrong-questions');
} catch (error) {
  console.error('Failed to register Wrong Questions routes:', error);
}

// Learning Incentive routes
try {
  app.use('/api/incentive', incentiveRoutes);
app.use('/api/answer-sheets', answerSheetRoutes);
app.use('/api/paper-library', paperLibraryRoutes);
app.use('/api/subjects', subjectRoutes);
  app.use('/api/chapters', chapterRoutes);
  app.use('/api/netdisk-index', netdiskIndexRoutes);
  app.use('/api/learning', learningRoutes);
  app.use('/api/ai-assistants', aiAssistantRoutes);
  console.log('Incentive routes registered at /api/incentive');
} catch (error) {
  console.error('Failed to register Incentive routes:', error);
}

// Direct test route
app.get('/api/llm-direct-test', (_req: Request, res: Response) => {
  res.json({ message: 'Direct test route works!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints: http://localhost:${PORT}/api`);
});

export default app;