/**
 * Authentication Routes
 * API endpoints for student registration, login, and session management
 */

import { Router, Request, Response } from 'express';
import {
  registerStudent,
  loginStudent,
  logoutStudent,
  getStudentByToken
} from '../services/auth-service';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new student
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { studentId, name, password, classId, role } = req.body;
    
    // Validate required fields
    if (!studentId || !name || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: studentId, name, password'
      });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少6位'
      });
    }
    
    const result = await registerStudent({
      studentId,
      name,
      password,
      classId,
      role
    });
    
    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Student login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { studentId, password } = req.body;
    
    if (!studentId || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: studentId, password'
      });
    }
    
    const result = await loginStudent({ studentId, password });
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(401).json(result);
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Student logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未提供认证令牌'
      });
    }
    
    const token = authHeader.substring(7);
    const success = await logoutStudent(token);
    
    return res.json({
      success,
      message: success ? '已退出登录' : '退出失败'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Get current student info
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未提供认证令牌'
      });
    }
    
    const token = authHeader.substring(7);
    const student = await getStudentByToken(token);
    
    if (!student) {
      return res.status(401).json({
        success: false,
        error: '令牌无效或已过期'
      });
    }
    
    return res.json({
      success: true,
      student: {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        role: student.role,
        classId: student.classId
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;