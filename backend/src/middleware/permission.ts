/**
 * Permission Middleware
 * Access control for different user roles (student/admin)
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        studentId: string;
        name: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to require authentication
 * Verifies JWT token and attaches user to request
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  // Verify session
  prisma.session.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() }
    },
    include: { student: true }
  })
  .then(session => {
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Attach user to request
    req.user = {
      id: session.student.id,
      studentId: session.student.studentId,
      name: session.student.name,
      role: session.student.role
    };
    
    next();
  })
  .catch(err => {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  });
}

/**
 * Middleware to require admin role
 * Can be used after requireAuth, or standalone (will authenticate first)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // If user is already attached by requireAuth, just check role
  if (req.user) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required',
        message: 'You do not have permission to perform this action'
      });
    }
    return next();
  }

  // If user not attached, run requireAuth logic first
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  prisma.session.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() }
    },
    include: { student: true }
  })
  .then(session => {
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Attach user to request
    req.user = {
      id: session.student.id,
      studentId: session.student.studentId,
      name: session.student.name,
      role: session.student.role
    };
    
    // Now check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required',
        message: 'You do not have permission to perform this action'
      });
    }
    
    next();
  })
  .catch(err => {
    console.error('Admin auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  });
}

/**
 * Middleware to require student role (or admin)
 * Can be used after requireAuth, or standalone (will authenticate first)
 */
export function requireStudent(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    if (req.user.role !== 'student' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Student access required',
        message: 'You do not have permission to perform this action'
      });
    }
    return next();
  }

  // If user not attached, run requireAuth logic first
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  prisma.session.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
    include: { student: true }
  })
  .then(session => {
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = {
      id: session.student.id,
      studentId: session.student.studentId,
      name: session.student.name,
      role: session.student.role
    };
    
    if (req.user.role !== 'student' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Student access required',
        message: 'You do not have permission to perform this action'
      });
    }
    
    next();
  })
  .catch(err => {
    console.error('Student auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  });
}

/**
 * Middleware to check if user owns the resource or is admin
 * Can be used after requireAuth, or standalone (will authenticate first)
 * Used for: students viewing/updating their own profile
 */
export function requireOwnershipOrAdmin(getUserIdFromParams: (req: Request) => number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // If user already attached by requireAuth, just check ownership
    if (req.user) {
      if (req.user.role === 'admin') {
        return next();
      }
      const resourceId = getUserIdFromParams(req);
      if (req.user.id !== resourceId) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only access your own resources'
        });
      }
      return next();
    }

    // If user not attached, run requireAuth logic first
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    
    prisma.session.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
      include: { student: true }
    })
    .then(session => {
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      req.user = {
        id: session.student.id,
        studentId: session.student.studentId,
        name: session.student.name,
        role: session.student.role
      };
      
      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Check ownership
      const resourceId = getUserIdFromParams(req);
      if (req.user.id !== resourceId) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only access your own resources'
        });
      }
      
      next();
    })
    .catch(err => {
      console.error('Ownership auth error:', err);
      res.status(500).json({ error: 'Authentication failed' });
    });
  };
}

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const token = authHeader.substring(7);
  
  prisma.session.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() }
    },
    include: { student: true }
  })
  .then(session => {
    if (session) {
      req.user = {
        id: session.student.id,
        studentId: session.student.studentId,
        name: session.student.name,
        role: session.student.role
      };
    }
    next();
  })
  .catch(err => {
    console.error('Optional auth error:', err);
    next(); // Continue without user
  });
}

/**
 * Role-based access control configuration
 * Maps routes to required roles
 */
export const rolePermissions: Record<string, string[]> = {
  // Admin only routes
  '/api/students/import': ['admin'],
  '/api/students/export': ['admin'],
  '/api/classes': ['admin'],
  
  // Student accessible routes
  '/api/auth/me': ['student', 'admin'],
  '/api/students/:id': ['owner', 'admin'], // owner = student themselves
  
  // Public routes
  '/api/auth/register': [],
  '/api/auth/login': [],
  '/api/health': []
};