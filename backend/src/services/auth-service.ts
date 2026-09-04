/**
 * Authentication Service
 * Handles password hashing, JWT generation, and session management
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface RegisterData {
  studentId: string;
  name: string;
  password: string;
  classId?: number;
  role?: string;
}

export interface LoginData {
  studentId: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  student?: {
    id: number;
    studentId: string;
    name: string;
    role: string;
  };
  token?: string;
  error?: string;
}

/**
 * Hash password using PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password against stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

/**
 * Generate JWT token
 */
export function generateToken(studentId: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    studentId,
    iat: Date.now(),
    exp: Date.now() + JWT_EXPIRES_IN
  })).toString('base64');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64');
  
  return `${header}.${payload}.${signature}`;
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): { studentId: number } | null {
  try {
    const [header, payload, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    if (decoded.exp < Date.now()) {
      return null;
    }
    
    return { studentId: decoded.studentId };
  } catch {
    return null;
  }
}

/**
 * Register a new student
 */
export async function registerStudent(data: RegisterData): Promise<AuthResult> {
  try {
    // Check if studentId already exists
    const existing = await prisma.student.findUnique({
      where: { studentId: data.studentId }
    });
    
    if (existing) {
      return {
        success: false,
        error: '学号已存在'
      };
    }
    
    // Create student with hashed password
    const student = await prisma.student.create({
      data: {
        studentId: data.studentId,
        name: data.name,
        passwordHash: hashPassword(data.password),
        classId: data.classId || null,
        role: data.role || 'student'
      }
    });
    
    // Generate token
    const token = generateToken(student.id);
    
    // Create session
    await prisma.session.create({
      data: {
        studentId: student.id,
        token,
        expiresAt: new Date(Date.now() + JWT_EXPIRES_IN)
      }
    });
    
    return {
      success: true,
      student: {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        role: student.role
      },
      token
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Login student
 */
export async function loginStudent(data: LoginData): Promise<AuthResult> {
  try {
    const student = await prisma.student.findUnique({
      where: { studentId: data.studentId }
    });
    
    if (!student) {
      return {
        success: false,
        error: '学号或密码错误'
      };
    }
    
    // Check if account is locked
    if (student.lockedUntil && student.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((student.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      return {
        success: false,
        error: `账号已被锁定，请${remainingTime}分钟后再试`
      };
    }
    
    // Verify password
    if (!verifyPassword(data.password, student.passwordHash)) {
      // Increment login attempts
      const attempts = student.loginAttempts + 1;
      let lockedUntil = null;
      
      // Lock after 5 failed attempts for 30 minutes
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      
      await prisma.student.update({
        where: { id: student.id },
        data: {
          loginAttempts: attempts,
          lockedUntil
        }
      });
      
      return {
        success: false,
        error: '学号或密码错误'
      };
    }
    
    // Reset login attempts on successful login
    await prisma.student.update({
      where: { id: student.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null
      }
    });
    
    // Generate token
    const token = generateToken(student.id);
    
    // Create session
    await prisma.session.create({
      data: {
        studentId: student.id,
        token,
        expiresAt: new Date(Date.now() + JWT_EXPIRES_IN)
      }
    });
    
    return {
      success: true,
      student: {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        role: student.role
      },
      token
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Logout student (delete session)
 */
export async function logoutStudent(token: string): Promise<boolean> {
  try {
    await prisma.session.delete({
      where: { token }
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get student by token
 */
export async function getStudentByToken(token: string) {
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }
  
  const session = await prisma.session.findUnique({
    where: { token },
    include: { student: true }
  });
  
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  
  return session.student;
}