import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import llmRoutes from './routes/llm';
import promptTemplateRoutes from './routes/prompt-template';
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import classRoutes from './routes/classes';
import knowledgePointRoutes from './routes/knowledge-points';
import paperRoutes from './routes/papers';
import difficultyRoutes from './routes/difficulty';
import examRoutes from './routes/exams';
import onlineExamRoutes from './routes/online-exams';
import gradingRoutes from './routes/grading';
import wrongQuestionsRoutes from './routes/wrong-questions';
import mockExamRoutes from './routes/mock-exams';
import incentiveRoutes from './routes/incentive';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
      knowledgePoints: '/api/knowledge-points',
      papers: '/api/papers',
      difficulty: '/api/difficulty',
      exams: '/api/exams',
      onlineExams: '/api/online-exams',
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

// Knowledge Point routes
try {
  app.use('/api/knowledge-points', knowledgePointRoutes);
  console.log('Knowledge Point routes registered at /api/knowledge-points');
} catch (error) {
  console.error('Failed to register Knowledge Point routes:', error);
}

// Paper routes
try {
  app.use('/api/papers', paperRoutes);
  console.log('Paper routes registered at /api/papers');
} catch (error) {
  console.error('Failed to register Paper routes:', error);
}

// Difficulty routes
try {
  app.use('/api/difficulty', difficultyRoutes);
  console.log('Difficulty routes registered at /api/difficulty');
} catch (error) {
  console.error('Failed to register Difficulty routes:', error);
}

// Exam routes
try {
  app.use('/api/exams', examRoutes);
  console.log('Exam routes registered at /api/exams');
} catch (error) {
  console.error('Failed to register Exam routes:', error);
}

// Online Exam routes
try {
  app.use('/api/online-exams', onlineExamRoutes);
  console.log('Online Exam routes registered at /api/online-exams');
} catch (error) {
  console.error('Failed to register Online Exam routes:', error);
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

// Mock Exam routes
try {
  app.use('/api/mock-exams', mockExamRoutes);
  console.log('Mock Exam routes registered at /api/mock-exams');
} catch (error) {
  console.error('Failed to register Mock Exam routes:', error);
}

// Learning Incentive routes
try {
  app.use('/api/incentive', incentiveRoutes);
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